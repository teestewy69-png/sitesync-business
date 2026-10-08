// Client-supplied content: operator page copy, image uploads, artwork list, supplied-first previews, importer plan.
//   node --test scripts/client-content.test.mjs     (isolated local store, no network; Node >= 22.18)
import { register } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
register("./fixtures/ts-resolver.mjs", import.meta.url);

for (const k of ["NETLIFY", "CONTEXT", "SITE_ID", "NETLIFY_BLOBS_CONTEXT", "DEPLOY_PRIME_URL", "URL", "NEXT_PUBLIC_SITE_URL"]) delete process.env[k];
process.env.DOMAINIQ_AVAILABILITY = "off";
const work = mkdtempSync(path.join(tmpdir(), "client-content-"));
process.chdir(work); // isolated ./data store
process.env.SITESINC_STORE = "local";

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const content = await import("../lib/factory/client-content.ts");
const store = await import("../lib/factory/client-content-store.ts");
const { applyFactoryAction } = await import("../lib/factory/actions.ts");
const { readClientWorkspace, updateClientWorkspace } = await import("../lib/factory/client-workspace.ts");
const { findProjectById } = await import("../lib/store.ts");
const { configFromProject } = await import("../lib/factory/client-config.ts");
const { buildClientPreviewModel, findForbiddenPreviewClaim } = await import("../lib/factory/client-preview.ts");
const { publishedClientPages } = await import("../lib/factory/client-domain.ts");
const uploadRoute = await import("../app/api/factory/client-assets/route.ts");
const assetRoute = await import("../app/api/client-assets/[projectId]/[file]/route.ts");
const { buildImportPlan } = await import("./import-client-content.mjs");

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP"), Buffer.alloc(50, 2)]);
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
const BIG_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(content.MAX_CLIENT_ASSET_BYTES, 0)]);

const KURTIS = {
  businessName: "Kurtis Wells",
  contactName: "Kurtis Wells",
  email: "kurtis@example.com",
  phone: "",
  city: "Walnut",
  state: "CA",
  businessType: "Artist",
  offer: "Original contemporary figurative paintings",
  notes: "Originals: available on request.",
};
const STATEMENT =
  "With no formal training, I taught myself to paint.\n\nI've been painting for more than twenty-six years and have built a large, evolving body of work.";
const settle = () => new Promise((resolve) => setTimeout(resolve, 400));
const allText = (value) => JSON.stringify(value);

async function newClient(extra = {}) {
  const res = await applyFactoryAction("record-intake", { source: "factory_intake", ...KURTIS, ...extra });
  assert.equal(res.ok, true, res.error);
  await settle();
  return res.projectId;
}

function uploadRequest(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value && typeof value === "object" && "bytes" in value) form.append(key, new Blob([value.bytes], { type: value.type }), value.name);
    else form.append(key, value);
  }
  return new Request("http://127.0.0.1/api/factory/client-assets", { method: "POST", body: form });
}

/* --------------------------------- uploads -------------------------------- */

test("upload validation: real JPEG/PNG/WebP only, size limit, alt text required", () => {
  for (const [bytes, type] of [[JPEG, "image/jpeg"], [PNG, "image/png"], [WEBP, "image/webp"]]) {
    const ok = content.validateClientAssetUpload({ name: "a.img", type, bytes, alt: "A painting" });
    assert.equal(ok.ok, true, type);
    assert.equal(ok.contentType, type);
  }
  const big = content.validateClientAssetUpload({ name: "big.jpg", type: "image/jpeg", bytes: BIG_JPEG, alt: "Big" });
  assert.equal(big.ok, false);
  assert.equal(big.status, 413);
  assert.match(big.error, /too big/);
  const svg = content.validateClientAssetUpload({ name: "x.svg", type: "image/svg+xml", bytes: SVG, alt: "x" });
  assert.equal(svg.status, 415);
  // A text file renamed to .jpg is still rejected: the type comes from the bytes, not the name.
  const renamed = content.validateClientAssetUpload({ name: "fake.jpg", type: "image/jpeg", bytes: Buffer.from("hello, not an image"), alt: "x" });
  assert.equal(renamed.status, 415);
  const mismatch = content.validateClientAssetUpload({ name: "a.png", type: "image/png", bytes: JPEG, alt: "x" });
  assert.equal(mismatch.status, 415);
  const noAlt = content.validateClientAssetUpload({ name: "a.jpg", type: "image/jpeg", bytes: JPEG, alt: "  " });
  assert.equal(noAlt.status, 400);
  assert.match(noAlt.error, /Alt text/);
  assert.equal(content.validateClientAssetUpload({ name: "e.jpg", bytes: Buffer.alloc(0), alt: "x" }).ok, false);
});

test("upload route: rejects too big (413) and bad types (415); stores a good image and serves it on the public preview route", async () => {
  const id = await newClient();
  const tooBig = await uploadRoute.POST(uploadRequest({ projectId: id, alt: "Big", file: { bytes: BIG_JPEG, type: "image/jpeg", name: "big.jpg" } }));
  assert.equal(tooBig.status, 413);
  const bad = await uploadRoute.POST(uploadRequest({ projectId: id, alt: "Bad", file: { bytes: SVG, type: "image/svg+xml", name: "x.svg" } }));
  assert.equal(bad.status, 415);
  const fake = await uploadRoute.POST(uploadRequest({ projectId: id, alt: "Fake", file: { bytes: Buffer.from("MZ executable"), type: "image/jpeg", name: "x.jpg" } }));
  assert.equal(fake.status, 415);
  const noAlt = await uploadRoute.POST(uploadRequest({ projectId: id, file: { bytes: JPEG, type: "image/jpeg", name: "a.jpg" } }));
  assert.equal(noAlt.status, 400);
  assert.equal((await readClientWorkspace(id)).clientContent?.assets?.length || 0, 0, "rejected uploads leave nothing behind");

  const good = await uploadRoute.POST(uploadRequest({ projectId: id, alt: "Crystal Ball, painting", role: "work", file: { bytes: JPEG, type: "image/jpeg", name: "crystal-ball.jpg" } }));
  assert.equal(good.status, 200);
  const data = await good.json();
  assert.equal(data.ok, true);
  assert.equal(data.asset.contentType, "image/jpeg");
  assert.equal(data.asset.alt, "Crystal Ball, painting");
  assert.equal(data.asset.sourceName, "crystal-ball.jpg");
  assert.match(data.url, new RegExp(`^/api/client-assets/${id}/ast_[a-z0-9]+\\.jpg$`));
  // Same store mode as the app: local file store under ./data when not on Netlify.
  assert.ok(existsSync(path.join(work, "data", "factory", "clients", id, "assets", data.asset.filename)));

  const again = await uploadRoute.POST(uploadRequest({ projectId: id, alt: "dup", file: { bytes: JPEG, type: "image/jpeg", name: "copy.jpg" } }));
  assert.equal((await again.json()).deduped, true, "same bytes = same asset");
  assert.equal(readdirSync(path.join(work, "data", "factory", "clients", id, "assets")).length, 1);

  const served = await assetRoute.GET(new Request(`http://127.0.0.1${data.url}`), { params: Promise.resolve({ projectId: id, file: data.asset.filename }) });
  assert.equal(served.status, 200);
  assert.equal(served.headers.get("content-type"), "image/jpeg");
  assert.equal(served.headers.get("x-robots-tag"), "noindex");
  assert.deepEqual(Buffer.from(await served.arrayBuffer()), JPEG);
  const missing = await assetRoute.GET(new Request("http://127.0.0.1/x"), { params: Promise.resolve({ projectId: id, file: "ast_nothere1.jpg" }) });
  assert.equal(missing.status, 404);
  const traversal = await assetRoute.GET(new Request("http://127.0.0.1/x"), { params: Promise.resolve({ projectId: id, file: "../workspace.json" }) });
  assert.equal(traversal.status, 404);

  // Alt edit + delete: a deleted image is no longer served.
  assert.equal((await applyFactoryAction("update-client-asset", { projectId: id, assetId: data.asset.id, alt: "" })).ok, false);
  assert.equal((await applyFactoryAction("update-client-asset", { projectId: id, assetId: data.asset.id, alt: "Crystal Ball (2020)", deferRecapture: "1" })).ok, true);
  assert.equal((await readClientWorkspace(id)).clientContent.assets[0].alt, "Crystal Ball (2020)");
  assert.equal((await applyFactoryAction("delete-client-asset", { projectId: id, assetId: data.asset.id, deferRecapture: "1" })).ok, true);
  const gone = await assetRoute.GET(new Request("http://127.0.0.1/x"), { params: Promise.resolve({ projectId: id, file: data.asset.filename }) });
  assert.equal(gone.status, 404);
});

/* -------------------------------- page copy ------------------------------- */

test("operator copy replaces the draft, survives a rebuild after a detail edit, and still needs approval", async () => {
  const id = await newClient();
  // Pretend the about page had been approved earlier: new words must go back through approval.
  await updateClientWorkspace(id, (ws) => {
    ws.pages = ws.pages.map((p) => (p.slug === "about" ? { ...p, status: "approved", approvedBy: "Tony", approvedAt: "2026-10-01T00:00:00.000Z" } : p));
    return ws;
  });
  const res = await applyFactoryAction("set-client-page-copy", {
    projectId: id,
    slug: "about",
    title: "About Kurtis Wells",
    body: `## Artist statement\n\n${STATEMENT}`,
    approvedBy: "Tony",
    deferRecapture: "1",
  });
  assert.equal(res.ok, true, res.error);
  let about = (await readClientWorkspace(id)).pages.find((p) => p.slug === "about");
  assert.equal(about.source, "operator");
  assert.equal(about.status, "ready_for_review");
  assert.equal(about.approvedBy, "");
  assert.equal(about.noindex, true);
  assert.equal(about.title, "About Kurtis Wells");
  assert.deepEqual(about.headings, ["Artist statement"]);
  assert.doesNotMatch(about.body, /FACTORY DRAFT|Client to supply/);
  assert.equal(publishedClientPages([about]).length, 0, "unapproved operator copy never reaches the client domain");

  // Detail edit -> template rebuild: operator copy is kept word for word, template drafts pick up the new city.
  const edit = await applyFactoryAction("update-client-config", { projectId: id, city: "Pomona", approvedBy: "Tony" });
  assert.equal(edit.ok, true, edit.error);
  assert.ok(edit.operatorKept.includes("about"), JSON.stringify(edit));
  assert.ok(!edit.refreshed.includes("about"));
  const ws = await readClientWorkspace(id);
  about = ws.pages.find((p) => p.slug === "about");
  assert.equal(about.source, "operator");
  assert.equal(about.body, `## Artist statement\n\n${STATEMENT}`);
  assert.match(ws.pages.find((p) => p.slug === "contact").body, /Pomona, CA/);

  // Re-drafting from the template cannot silently overwrite operator copy.
  await updateClientWorkspace(id, (w) => {
    w.briefs = w.briefs.map((b) => (b.slug === "about" ? { ...b, status: "approved" } : b));
    return w;
  });
  await assert.rejects(() => applyFactoryAction("draft-client-page", { projectId: id, slug: "about" }), /operator-supplied client copy/);

  // Clearing puts the template draft back (labeled draft, still needs approval).
  assert.equal((await applyFactoryAction("clear-client-page-copy", { projectId: id, slug: "about", deferRecapture: "1" })).ok, true);
  about = (await readClientWorkspace(id)).pages.find((p) => p.slug === "about");
  assert.equal(about.source, "template");
  assert.match(about.body, /FACTORY DRAFT/);
  assert.equal(about.status, "ready_for_review");
});

test("operator copy keeps the guarantees: no prices unless allowed, no reviews/testimonials, unknown pages refused", async () => {
  const id = await newClient();
  const price = await applyFactoryAction("set-client-page-copy", { projectId: id, slug: "portfolio", body: "Originals from $500." });
  assert.equal(price.ok, false);
  assert.match(price.error, /price/);
  const review = await applyFactoryAction("set-client-page-copy", { projectId: id, slug: "about", body: "Five stars! Read our reviews." });
  assert.equal(review.ok, false);
  assert.match(review.error, /reviews|ratings|testimonials/);
  const empty = await applyFactoryAction("set-client-page-copy", { projectId: id, slug: "about", body: "   " });
  assert.equal(empty.ok, false);
  const unknown = await applyFactoryAction("set-client-page-copy", { projectId: id, slug: "services", body: "Text" });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.status, 404);
  assert.deepEqual(content.clientCopyIssues("Originals from $500.", "Prices listed on each work"), []);
  assert.equal(content.pricingAllowsListedPrices("Available on request"), false);
  assert.equal(content.pricingAllowsListedPrices(""), false);
  assert.equal(content.pricingAllowsListedPrices("Prices listed on each work"), true);
});

/* -------------------------------- artworks -------------------------------- */

test("artwork list: all fields optional, unknown images/availability refused, prices only when the pricing note allows", () => {
  const ids = ["ast_abc123"];
  const ok = content.sanitizeArtworks(
    [
      { title: " Crystal Ball ", medium: "Acrylic and oil bar on canvas", size: "45 × 45 in", year: "2020", availability: "unknown", imageId: "ast_abc123", featured: true, price: "$4,000" },
      { title: "Keith", series: "Faces" },
      {},
      { imageId: "ast_abc123" },
    ],
    { assetIds: ids, pricingNote: "Available on request" }
  );
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.artworks.length, 3, "empty rows are skipped");
  assert.equal(ok.artworks[0].title, "Crystal Ball");
  assert.equal(ok.artworks[0].price, undefined, "price dropped under 'on request'");
  assert.match(ok.warnings.join(" "), /price/);
  assert.equal(ok.artworks[1].year, undefined);
  const listed = content.sanitizeArtworks([{ title: "A", price: "$900" }], { assetIds: [], pricingNote: "Prices listed on each work" });
  assert.equal(listed.artworks[0].price, "$900");
  assert.match(content.artworkCaption(listed.artworks[0], "Prices listed on each work"), /\$900/);
  assert.doesNotMatch(content.artworkCaption(listed.artworks[0], "Available on request"), /\$/);
  assert.match(content.sanitizeArtworks([{ title: "A", imageId: "ast_missing" }], { assetIds: ids }).errors[0], /not an uploaded asset/);
  assert.match(content.sanitizeArtworks([{ title: "A", availability: "maybe" }], { assetIds: ids }).errors[0], /availability/);
  assert.equal(content.sanitizeArtworks([{ title: "A", availability: "Private collection" }], { assetIds: [] }).artworks[0].availability, "private_collection");
});

test("supplied content shows first: artwork list on portfolio + home Selected work, operator copy in sections, placeholders only where missing", async () => {
  const id = await newClient();
  const { asset } = await store.saveClientAsset(id, { name: "flower.jpg", type: "image/jpeg", bytes: JPEG, alt: "What Happened to Flower Power, painting" });
  const { asset: photo } = await store.saveClientAsset(id, { name: "kurtis.png", type: "image/png", bytes: PNG, alt: "Kurtis Wells in the studio", role: "artist-photo" });
  const works = [
    { title: "What Happened to Flower Power", series: "Popsicle", medium: "Acrylic, house paint, oil bar, pens", imageId: asset.id, featured: true },
    { title: "Crystal Ball", medium: "Acrylic and oil bar on canvas", size: "45 × 45 in", year: "2020" },
    { title: "Keith", series: "Faces", medium: "Acrylic, house paint, oil bar, pens", price: "$1,000" },
  ];
  const saved = await applyFactoryAction("set-client-artworks", { projectId: id, artworks: works, deferRecapture: "1" });
  assert.equal(saved.ok, true, saved.error);
  assert.equal(saved.count, 3);
  assert.match(saved.warnings.join(" "), /price/);
  const bad = await applyFactoryAction("set-client-artworks", { projectId: id, artworks: [{ title: "X", imageId: "ast_nope" }] });
  assert.equal(bad.ok, false);

  await applyFactoryAction("set-client-page-copy", { projectId: id, slug: "about", body: STATEMENT, deferRecapture: "1" });
  await applyFactoryAction("set-client-page-copy", { projectId: id, slug: "home", body: "Political, thought-provoking, driven, humorous, and whimsical.", deferRecapture: "1" });

  const ws = await readClientWorkspace(id);
  const portfolio = ws.pages.find((p) => p.slug === "portfolio");
  assert.equal(portfolio.source, "template");
  assert.match(portfolio.body, /- What Happened to Flower Power \(Popsicle\) — Acrylic, house paint, oil bar, pens/);
  assert.match(portfolio.body, /- Crystal Ball — Acrylic and oil bar on canvas · 45 × 45 in · 2020/);
  assert.doesNotMatch(portfolio.body, /Client to supply: images of the work/, "no 'supply images' placeholder once works are supplied");
  assert.match(portfolio.body, /\[Client to confirm: image for 2 of 3 works; size for 2 of 3 works; year for 2 of 3 works; availability for all of 3 works\.\]/);
  assert.doesNotMatch(portfolio.body, /\$/);
  assert.match(ws.pages.find((p) => p.slug === "about").body, /twenty-six years/);

  const project = await findProjectById(id);
  const config = configFromProject(project);
  const model = buildClientPreviewModel(config, { projectId: id, content: ws.clientContent, pages: ws.pages });
  assert.equal(findForbiddenPreviewClaim(allText(model)), null);
  assert.equal(model.workCount, 3);
  assert.equal(model.selectedWorks[0].title, "What Happened to Flower Power");
  assert.equal(model.selectedWorks[0].image.src, `/api/client-assets/${id}/${asset.filename}`);
  assert.equal(model.selectedWorks[0].image.alt, "What Happened to Flower Power, painting");
  assert.equal(model.selectedWorks[1].image, null);
  assert.equal(model.heroImage.src, model.selectedWorks[0].image.src);
  assert.equal(model.artistPhoto.alt, "Kurtis Wells in the studio");
  assert.equal(model.artistPhoto.src, `/api/client-assets/${id}/${photo.filename}`);
  assert.equal(model.intro, "Political, thought-provoking, driven, humorous, and whimsical.");
  const sec = Object.fromEntries(model.sections.map((s) => [s.slug, s]));
  assert.equal(sec.about.placeholder, false);
  assert.match(sec.about.text, /taught myself to paint/);
  assert.equal(sec.portfolio.placeholder, false);
  assert.match(sec.portfolio.text, /3 works · series: Popsicle, Faces/);
  assert.equal(sec.exhibitions.placeholder, true, "nothing supplied for exhibitions -> placeholder stays");
  assert.doesNotMatch(allText(model), /\$/);

  // Nothing supplied: the same template shows only placeholders (unchanged behaviour).
  const bare = buildClientPreviewModel(config, { projectId: id, content: null, pages: [] });
  assert.deepEqual(bare.selectedWorks, []);
  assert.equal(bare.heroImage, null);
  assert.ok(bare.sections.filter((s) => s.slug !== "contact").every((s) => s.placeholder));

  // Operator copy also survives an artwork-list rebuild.
  const again = await applyFactoryAction("set-client-artworks", { projectId: id, artworks: works.slice(0, 1), deferRecapture: "1" });
  assert.ok(again.operatorKept.includes("about") && again.operatorKept.includes("home"));
  assert.match((await readClientWorkspace(id)).pages.find((p) => p.slug === "about").body, /twenty-six years/);
});

/* -------------------------------- importer -------------------------------- */

test("importer plan: validates images (size/type/alt/path), never sends prices, maps artworks to image keys", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "import-plan-"));
  mkdirSync(path.join(dir, "works"));
  writeFileSync(path.join(dir, "works", "a.jpg"), JPEG);
  writeFileSync(path.join(dir, "works", "big.jpg"), BIG_JPEG);
  writeFileSync(path.join(dir, "works", "fake.jpg"), "not an image");
  writeFileSync(path.join(dir, "photo.png"), PNG);
  const good = buildImportPlan(
    {
      projectId: "proj_test1",
      details: { offer: "Original paintings" },
      pages: { about: { title: "About", body: STATEMENT } },
      images: [
        { key: "a", file: "works/a.jpg", alt: "A painting", role: "work" },
        { key: "me", file: "photo.png", alt: "The artist", role: "artist-photo" },
      ],
      artworks: [{ title: "A", image: "a", price: "$28", featured: true }, { title: "B", size: "45 × 45 in" }, {}],
    },
    { imagesDir: dir }
  );
  assert.deepEqual(good.errors, []);
  assert.equal(good.uploads.length, 2);
  assert.equal(good.uploads[1].type, "image/png");
  assert.equal(good.artworks.length, 2);
  assert.equal(good.artworks[0].price, undefined, "importer never sends prices");
  assert.match(good.warnings.join(" "), /price left out/);
  assert.equal(good.pages[0].slug, "about");
  assert.deepEqual(good.details, { offer: "Original paintings" });

  const bad = buildImportPlan(
    {
      projectId: "proj_test1",
      details: { password: "x" },
      pages: { contact: { body: "Prints $28" } },
      images: [
        { key: "big", file: "works/big.jpg", alt: "Big" },
        { key: "fake", file: "works/fake.jpg", alt: "Fake" },
        { key: "noalt", file: "works/a.jpg" },
        { key: "up", file: "../secret.jpg", alt: "x" },
        { key: "gone", file: "works/missing.jpg", alt: "x" },
      ],
      artworks: [{ title: "C", image: "nokey" }, { title: "D", availability: "maybe" }],
    },
    { imagesDir: dir }
  );
  const errs = bad.errors.join("\n");
  assert.match(errs, /details\.password/);
  assert.match(errs, /too big/);
  assert.match(errs, /not a JPEG, PNG or WebP/);
  assert.match(errs, /alt text is required/);
  assert.match(errs, /relative path inside the images folder/);
  assert.match(errs, /not found/);
  assert.match(errs, /image "nokey"/);
  assert.match(errs, /availability/);
  assert.match(errs, /contains a price/);
});
