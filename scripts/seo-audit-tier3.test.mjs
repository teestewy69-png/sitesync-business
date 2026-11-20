// Local SEO audit (Tier 3, "the local moat"): NAP extraction + consistency, LocalBusiness
// completeness, GBP website-side signals (+ stubbed Places comparison), directory profile-link
// spot-check, and near-duplicate / doorway page detection. Fixtures are hand-built CrawlResults
// in the Tier 1/2 shape; the Places call is stubbed. No live network.
//   node --test scripts/seo-audit-tier3.test.mjs   (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");

const {
  auditIssues,
  renderSeoAuditReport,
  siteNap,
  localPresenceIssues,
  googleLinkStatus,
  linkedProfiles,
  nearDuplicateClusters,
  fetchPlacesNap,
  visibleText,
  detectMapEmbed,
  normalizePhoneKey,
  extractStreetAddresses,
  normalizeStreet,
  publishedPhones,
} = await import("../lib/siteflow/generators/seo-audit.ts");

const ORIGIN = "https://example.com";

/** A clean, healthy PageAudit (same shape as the Tier 1/2 fixtures); Tier 3 adds `text`/`jsonLd`. */
function page(path, over = {}) {
  return {
    url: `${ORIGIN}${path}`,
    path,
    statusCode: 200,
    title: `Title for ${path} from Example Plumbing`,
    metaDescription: `Unique description for ${path}: Example Plumbing serves Walnut homes and businesses.`,
    canonical: `${ORIGIN}${path}`,
    robots: "",
    wordCount: 520,
    headings: { h1: ["Example Plumbing"], h2: [], h3: [] },
    schemaTypes: ["Plumber"],
    ogTitle: "Example Plumbing",
    ogDescription: "Plumber in Walnut",
    ogImage: `${ORIGIN}/og.jpg`,
    images: [],
    missingAlt: 0,
    internalLinks: [],
    externalLinks: ["tel:+19095550100"],
    forms: [{ action: "/contact", method: "post", fields: ["email"] }],
    ttfbMs: 300,
    bytes: 48_000,
    error: "",
    ...over,
  };
}

function result(pages, over = {}) {
  return {
    origin: ORIGIN,
    pages,
    robotsOk: true,
    sitemapOk: true,
    https: true,
    sitemapPaths: pages.map((p) => p.path),
    blockedPaths: [],
    brokenLinks: [],
    ...over,
  };
}

const has = (issues, re, severity) =>
  issues.some((i) => re.test(i.issue) && (severity === undefined || i.severity === severity));

const LB = (over = {}) => [
  {
    "@type": "Plumber",
    name: "Walnut Plumbing Co",
    telephone: "+1-909-555-0100",
    address: { "@type": "PostalAddress", streetAddress: "1200 Main Street", addressLocality: "Walnut", addressRegion: "CA" },
    ...over,
  },
];

/* ------------------------------ extraction helpers ----------------------------------- */

test("visibleText strips markup/scripts; detectMapEmbed spots a Google Maps iframe", () => {
  const html = `<html><head><style>.x{}</style><script>var phone = "000-000-0000";</script></head>
<body><p>Call (909) 555-0142</p><iframe src="https://www.google.com/maps/embed?pb=xyz"></iframe></body></html>`;
  const text = visibleText(html);
  assert.match(text, /Call \(909\) 555-0142/);
  assert.doesNotMatch(text, /000-000-0000/);
  assert.equal(detectMapEmbed(html), true);
  assert.equal(detectMapEmbed("<p>no map</p>"), false);
  assert.equal(normalizePhoneKey("+1 (909) 555-0142"), "9095550142");
});

/* --------------------------------- NAP consistency ----------------------------------- */

test("two different phone numbers across pages fire ONE high finding naming both numbers and pages", () => {
  const home = page("/", { externalLinks: ["tel:+19095550142"], text: "Call us at (909) 555-0142 for fast service." });
  const contact = page("/contact", { externalLinks: ["tel:+19095550199"], text: "Reach the shop: 909-555-0199." });
  const issues = auditIssues(result([home, contact]));
  const conflicts = issues.filter((i) => /Phone numbers disagree/.test(i.issue));
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].severity, "high");
  assert.match(conflicts[0].issue, /555-0142/);
  assert.match(conflicts[0].issue, /555-0199/);
  assert.match(conflicts[0].issue, /\/contact/);
});

test("formatting-only phone differences do NOT fire (digits are compared, not punctuation)", () => {
  const home = page("/", {
    externalLinks: ["tel:+19095550142"],
    text: "Call (909) 555-0142 today.",
    jsonLd: LB({ telephone: "+1 (909) 555-0142" }),
  });
  const other = page("/services", { externalLinks: ["tel:9095550142"], text: "Or dial 909.555.0142 anytime." });
  const issues = auditIssues(result([home, other]));
  assert.equal(has(issues, /Phone numbers disagree/), false);
  assert.equal(siteNap(result([home, other])).phones.length, 1);
});

test("schema-vs-page phone mismatch fires: the schema number and the contact-page number disagree", () => {
  const home = page("/", { jsonLd: LB(), text: "Walnut Plumbing Co, 1200 Main Street. Call (909) 555-0100." });
  const contact = page("/contact", { externalLinks: [], text: "Emergencies only: (909) 555-0199." });
  const issues = auditIssues(result([home, contact]));
  assert.ok(has(issues, /Phone numbers disagree/, "high"));
  const conflict = issues.find((i) => /Phone numbers disagree/.test(i.issue));
  assert.match(conflict.issue, /555-0100/);
  assert.match(conflict.issue, /555-0199/);
});

test("address abbreviation differences do NOT fire; genuinely different street addresses fire high", () => {
  const same = result([
    page("/", { jsonLd: LB({ address: { "@type": "PostalAddress", streetAddress: "1200 Main St", addressLocality: "Walnut" } }), text: "Visit us at 1200 Main Street, Walnut." }),
  ]);
  assert.equal(has(auditIssues(same), /Street addresses disagree/), false);

  const different = result([
    page("/", { text: "Our shop: 1200 Main Street, Walnut." }),
    page("/contact", { text: "New location: 44 Oak Avenue, Walnut." }),
  ]);
  const issues = auditIssues(different);
  const conflict = issues.find((i) => /Street addresses disagree/.test(i.issue));
  assert.ok(conflict, "expected an address conflict");
  assert.equal(conflict.severity, "high");
  assert.match(conflict.issue, /1200 Main Street/);
  assert.match(conflict.issue, /44 Oak Avenue/);
});

test("business-name variants beyond LLC/Inc noise fire medium; suffix-only differences do not", () => {
  const variants = result([
    page("/", { jsonLd: LB({ name: "Walnut Plumbing Co" }) }),
    page("/about", { jsonLd: LB({ name: "Walnut Plumbers Inc" }) }),
  ]);
  assert.ok(has(auditIssues(variants), /business name is written 2 different ways/, "medium"));

  const suffixOnly = result([
    page("/", { jsonLd: LB({ name: "Walnut Plumbing Co" }) }),
    page("/about", { jsonLd: LB({ name: "Walnut Plumbing Company LLC" }) }),
  ]);
  assert.equal(has(auditIssues(suffixOnly), /business name is written/), false);
});

test("no schema and no extractable NAP fires the honest medium finding", () => {
  const bare = page("/", { externalLinks: [], forms: [], jsonLd: undefined, text: undefined });
  const issues = auditIssues(result([bare]));
  assert.ok(has(issues, /No machine-readable name, address or phone \(NAP\) found/, "medium"));
});

/* --------------------------- LocalBusiness completeness ------------------------------ */

test("missing recommended schema fields aggregate into ONE low finding listing them all", () => {
  const pages = [page("/", { jsonLd: LB() }), page("/services", { jsonLd: LB() })];
  const issues = auditIssues(result(pages));
  const gaps = issues.filter((i) => /missing recommended details/.test(i.issue));
  assert.equal(gaps.length, 1, "one aggregated finding, not one per field or page");
  assert.equal(gaps[0].severity, "low");
  for (const prop of ["openingHours", "geo", "sameAs", "image", "priceRange", "url"]) {
    assert.match(gaps[0].issue, new RegExp(prop));
  }
  assert.match(gaps[0].issue, /on 2 pages/);

  const complete = LB({
    openingHours: "Mo-Fr 08:00-17:00",
    geo: { "@type": "GeoCoordinates", latitude: 34.02, longitude: -117.86 },
    sameAs: ["https://www.yelp.com/biz/walnut-plumbing"],
    image: "https://example.com/shop.jpg",
    priceRange: "$$",
    url: "https://example.com/",
  });
  const done = auditIssues(result([page("/", { jsonLd: complete })]));
  assert.equal(has(done, /missing recommended details/), false);
});

/* ------------------------------ GBP website-side signals ------------------------------ */

const GBP_LINKS = [
  "tel:+19095550100",
  "https://www.google.com/maps/place/Walnut+Plumbing+Co",
  "https://g.page/r/CXyzExample/review",
];

test("GBP: maps + review links present means no GBP findings; absent means lows and the scope line renders", () => {
  const linked = result([page("/", { jsonLd: LB(), externalLinks: GBP_LINKS })]);
  const linkedIssues = auditIssues(linked);
  assert.equal(has(linkedIssues, /doesn't link to your Google Maps listing/), false);
  assert.equal(has(linkedIssues, /no Google review link/), false);
  const status = googleLinkStatus(linked);
  assert.deepEqual(status, { mapsLinked: true, reviewLinked: true, mapEmbedded: false });

  const unlinked = result([page("/", { jsonLd: LB(), externalLinks: ["tel:+19095550100"] })]);
  const issues = auditIssues(unlinked);
  assert.ok(has(issues, /doesn't link to your Google Maps listing/, "low"));
  assert.ok(has(issues, /no Google review link/, "low"));

  const html = renderSeoAuditReport(unlinked, { places: null });
  assert.match(html, /Local presence/);
  assert.match(html, /can't be verified without the business owner's Google access/);
  assert.match(html, /not a full citation audit across directories/);
  assert.match(html, /live comparison with your Google listing wasn't run/);
});

/* ------------------------------ Places comparison ------------------------------------ */

function placesResponse(place) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ places: [place] }),
  };
}

test("Places: one text-search call parses name/address/phone; a phone mismatch vs the site fires high", async () => {
  let seenUrl = "";
  let seenInit = null;
  const places = await fetchPlacesNap("Walnut Plumbing Co", "Walnut", {
    apiKey: "TESTKEY",
    fetchImpl: async (url, init) => {
      seenUrl = String(url);
      seenInit = init;
      return placesResponse({
        displayName: { text: "Walnut Plumbing Co" },
        formattedAddress: "1200 Main Street, Walnut, CA 91789",
        nationalPhoneNumber: "(909) 555-9999",
      });
    },
  });
  assert.deepEqual(places, { name: "Walnut Plumbing Co", address: "1200 Main Street, Walnut, CA 91789", phone: "(909) 555-9999" });
  assert.match(seenUrl, /places\.googleapis\.com\/v1\/places:searchText/);
  assert.equal(seenInit.headers["X-Goog-Api-Key"], "TESTKEY");
  assert.match(seenInit.body, /Walnut Plumbing Co Walnut/);

  const site = result([
    page("/", { jsonLd: LB(), text: "Walnut Plumbing Co, 1200 Main Street. Call (909) 555-0100." }),
  ]);
  const withPlaces = localPresenceIssues(site, { places });
  const mismatch = withPlaces.find((i) => /Google listing shows the phone number/.test(i.issue));
  assert.ok(mismatch, "expected a listing-vs-site phone mismatch");
  assert.equal(mismatch.severity, "high");
  assert.match(mismatch.issue, /555-9999/);
  assert.match(mismatch.issue, /555-0100/);
  // Same street on both sides (abbreviation/city/zip aside) = no address finding.
  assert.equal(has(withPlaces, /Google listing shows the address/), false);
  // Without a Places result there is nothing to compare — silently absent.
  assert.equal(has(localPresenceIssues(site), /Google listing shows/), false);
});

test("Places: missing key or a failed lookup degrades to null (website-side checks alone)", async () => {
  const noKey = await fetchPlacesNap("Walnut Plumbing Co", "Walnut", {
    apiKey: "",
    fetchImpl: async () => {
      throw new Error("must not be called without a key");
    },
  });
  assert.equal(noKey, null);
  const failed = await fetchPlacesNap("Walnut Plumbing Co", "Walnut", {
    apiKey: "TESTKEY",
    fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }),
  });
  assert.equal(failed, null);
  const noMatch = await fetchPlacesNap("Walnut Plumbing Co", "Walnut", {
    apiKey: "TESTKEY",
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ places: [] }) }),
  });
  assert.equal(noMatch, null);
});

/* ------------------------------ profile-link spot-check ------------------------------- */

test("profile links: missing big three named in one low finding; linked profiles are reported", () => {
  const onlyInsta = result([
    page("/", { jsonLd: LB(), externalLinks: ["tel:+19095550100", "https://www.instagram.com/walnutplumbing"] }),
  ]);
  const issues = auditIssues(onlyInsta);
  const finding = issues.find((i) => /doesn't link your/.test(i.issue));
  assert.ok(finding, "expected the missing-profiles finding");
  assert.equal(finding.severity, "low");
  assert.match(finding.issue, /Yelp\/Facebook\/Apple Maps/);
  assert.match(finding.issue, /ties your citations together/);
  assert.deepEqual(linkedProfiles(onlyInsta), ["Instagram"]);

  const allLinked = result([
    page("/", {
      jsonLd: LB(),
      externalLinks: [
        "tel:+19095550100",
        "https://www.yelp.com/biz/walnut-plumbing-co",
        "https://www.facebook.com/walnutplumbing",
        "https://maps.apple.com/?q=Walnut+Plumbing+Co",
      ],
    }),
  ]);
  assert.equal(has(auditIssues(allLinked), /doesn't link your/), false);
  assert.deepEqual(linkedProfiles(allLinked), ["Yelp", "Facebook", "Apple Maps"]);
});

/* ------------------------------ near-duplicate pages ---------------------------------- */

const BODY_TEXT = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ") +
  " our licensed plumbers fix leaks drains water heaters and sewer lines fast same day service guaranteed workmanship upfront pricing";

test("two near-identical city pages cluster into ONE medium doorway finding", () => {
  const walnut = page("/plumbing-walnut/", {
    title: "Plumbing in Walnut | Walnut Plumbing Co",
    metaDescription: "Plumbers in Walnut: drains, leaks and water heaters.",
    text: BODY_TEXT,
  });
  const pomona = page("/plumbing-pomona/", {
    title: "Plumbing in Pomona | Walnut Plumbing Co",
    metaDescription: "Plumbers in Pomona: drains, leaks and water heaters.",
    text: BODY_TEXT,
  });
  const res = result([page("/"), walnut, pomona]);
  const clusters = nearDuplicateClusters(res);
  assert.equal(clusters.length, 1);
  assert.deepEqual(clusters[0].pages, ["/plumbing-pomona/", "/plumbing-walnut/"]);

  const issues = auditIssues(res);
  const dups = issues.filter((i) => /Near-duplicate/.test(i.issue));
  assert.equal(dups.length, 1, "one finding per cluster");
  assert.equal(dups[0].severity, "medium");
  assert.match(dups[0].issue, /doorway pages/);
  assert.match(dups[0].issue, /differ mainly by city name/);
});

test("genuinely different pages do not cluster; tiny pages are skipped", () => {
  const a = page("/a", { text: Array.from({ length: 80 }, (_, i) => `alpha${i}`).join(" ") });
  const b = page("/b", { text: Array.from({ length: 80 }, (_, i) => `bravo${i}`).join(" ") });
  const tiny1 = page("/t1", { text: "short page text here" });
  const tiny2 = page("/t2", { text: "short page text here" });
  const res = result([a, b, tiny1, tiny2]);
  assert.deepEqual(nearDuplicateClusters(res), []);
  assert.equal(has(auditIssues(res), /Near-duplicate/), false);
});

/* --------------------- quoted numbers & glued phone/address -------------------------- */

test("a competitor's number quoted in page text is a mention, not a disagreement (the Hibu case)", () => {
  // Mirrors sitesinc.co/compare/hibu-alternative: the page publishes the business's own number
  // (schema + tel: link + footer text) and quotes the rival's cancellation number in an article.
  const compare = page("/compare/rival-alternative", {
    jsonLd: LB(),
    externalLinks: ["tel:+19095550100"],
    text: "Rival Co's General Terms say you may cancel by telephoning (877) 555-0199, Monday through Friday. Questions? Call (909) 555-0100 or visit 1200 Main Street, Walnut.",
  });
  const res = result([compare]);
  const issues = auditIssues(res);
  assert.equal(has(issues, /Phone numbers disagree/), false);
  const note = issues.find((i) => /Another phone number appears/.test(i.issue));
  assert.ok(note, "expected the low mention note");
  assert.equal(note.severity, "low");
  assert.match(note.issue, /877\) 555-0199/);
  const nap = siteNap(res);
  assert.equal(nap.phones.length, 2);
  assert.equal(nap.phones.find((p) => p.key === "8775550199").mentionsOnly, true);
  assert.equal(publishedPhones(nap).length, 1);
});

test("a text-only number on a page that publishes no other number still counts (contact-page case)", () => {
  const home = page("/", { jsonLd: LB(), text: "Walnut Plumbing Co, 1200 Main Street. Call (909) 555-0100." });
  const contact = page("/contact", { externalLinks: [], text: "Emergencies only: (909) 555-0199." });
  const nap = siteNap(result([home, contact]));
  assert.equal(nap.phones.find((p) => p.key === "9095550199").mentionsOnly, false);
  assert.equal(publishedPhones(nap).length, 2);
});

test("a phone glued to the address in flattened text does not spawn a phantom address", () => {
  // Footer shape: "Phone: (909) 323-1575 1968 South Coast Hwy #3632, Laguna Beach, CA 92651" —
  // the phone's last four digits must not become the house number ("1575 1968 South Coast Hwy").
  const found = extractStreetAddresses("Phone: (909) 323-1575 1968 South Coast Hwy #3632, Laguna Beach, CA 92651");
  assert.equal(found.length, 1);
  assert.equal(found[0].display, "1968 South Coast Hwy");
  assert.equal(found[0].normalized, "1968 south coast highway");

  const res = result([
    page("/", {
      jsonLd: LB({ address: { "@type": "PostalAddress", streetAddress: "1968 South Coast Hwy #3632", addressLocality: "Laguna Beach" } }),
      externalLinks: ["tel:+19093231575"],
      text: "Phone: (909) 323-1575 1968 South Coast Hwy #3632, Laguna Beach, CA 92651",
    }),
  ]);
  const nap = siteNap(res);
  assert.equal(nap.addresses.length, 1);
  assert.equal(has(auditIssues(res), /Street addresses disagree/), false);
});

test("the same address abbreviated on one page and spelled out on another is one address", () => {
  // The Roofing Company case (first hunt, 2026-11-20): "1420 W 11th St" on the homepage and
  // "1420 West 11th Street" on the contact page are the same address, not a disagreement.
  assert.equal(normalizeStreet("1420 W 11th St"), normalizeStreet("1420 West 11th Street"));
  const res = result([
    page("/", { text: "Visit us at 1420 W 11th St, Pomona, CA." }),
    page("/contact-us", { text: "Our office: 1420 West 11th Street, Pomona, CA." }),
  ]);
  const nap = siteNap(res);
  assert.equal(nap.addresses.length, 1);
  assert.equal(has(auditIssues(res), /Street addresses disagree/), false);
});

test("a ZIP code glued onto the front of an address is not the house number", () => {
  // The SC Tree case (first hunt, 2026-11-20): flattened text "…Covina, CA 90502 519 N Curtis Ave"
  // made the ZIP pose as a house number ("90502 519 N Curtis Ave"), a phantom second address.
  const found = extractStreetAddresses("Covina, CA 90502 519 N Curtis Ave — stop by today");
  assert.equal(found.length, 1);
  assert.equal(found[0].display, "519 N Curtis Ave");

  const res = result([
    page("/", { text: "Southern California Tree and Landscape, 519 N Curtis Ave, Covina, CA 90502" }),
    page("/contact-us", { text: "Covina, CA 90502 519 N Curtis Ave" }),
  ]);
  const nap = siteNap(res);
  assert.equal(nap.addresses.length, 1);
  assert.equal(has(auditIssues(res), /Street addresses disagree/), false);
});
