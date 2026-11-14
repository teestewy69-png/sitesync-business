// Landing pages: /store/[slug] (per product) and /store/lane/[lane] read their
// facts from data/products.ts + lib/siteflow/lanes.ts. These assertions keep every
// public guide's landing facts complete and every lane used by the catalog defined.
// No network.
//   node --test scripts/landing-pages.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { existsSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const catalog = await import("../data/products.ts");
const { LANES, getLane } = await import("../lib/siteflow/lanes.ts");

/** The sellable guides: public products whose deliverable is an ebook PDF file. */
function publicGuides() {
  return catalog
    .getPublicProducts()
    .filter((p) => p.deliverable?.type === "file" && p.deliverable.fileKey.startsWith("ebooks/"));
}

test("landing facts: every listed+priced guide has gumroadUrl, audience and includes; lane on all but the Audit Kit", () => {
  const guides = publicGuides();
  assert.equal(guides.length, 12, "expected the 12 sellable guides to be public");
  for (const guide of guides) {
    assert.ok(guide.gumroadUrl, `${guide.slug}: gumroadUrl missing`);
    assert.match(guide.gumroadUrl, /^https:\/\/40sinc\.gumroad\.com\/l\//, `${guide.slug}: gumroadUrl is not a Gumroad product link`);
    assert.ok(guide.audience && guide.audience.trim().length > 0, `${guide.slug}: audience missing`);
    assert.ok(Array.isArray(guide.includes) && guide.includes.length >= 4, `${guide.slug}: includes needs at least 4 bullets`);
    for (const bullet of guide.includes) {
      assert.ok(typeof bullet === "string" && bullet.trim().length > 0, `${guide.slug}: empty includes bullet`);
    }
    if (guide.slug === "website-audit-kit") {
      // The Audit Kit is a business tool, not part of any audience lane: it carries no lane by design.
      assert.equal(guide.lane, undefined, "website-audit-kit: lane must stay unset");
    } else {
      assert.ok(guide.lane, `${guide.slug}: lane missing`);
    }
  }
});

test("lanes: the map covers every lane used by the catalog, with the Family Papers bundle", () => {
  const used = new Set(catalog.catalog.map((p) => p.lane).filter(Boolean));
  assert.ok(used.size > 0, "no catalog entry carries a lane");
  for (const slug of used) {
    assert.ok(LANES[slug], `lane "${slug}" used by the catalog but missing from LANES`);
    assert.equal(getLane(slug)?.slug, slug);
    assert.ok(LANES[slug].name.trim().length > 0, `lane "${slug}" has no display name`);
  }
  for (const expected of ["women-50", "family-sandwich", "travel-60", "home-daily"]) {
    assert.ok(LANES[expected], `expected lane "${expected}" in LANES`);
  }
  const bundle = LANES["family-sandwich"].bundle;
  assert.ok(bundle, "family-sandwich lane must carry the Family Papers Bundle");
  assert.equal(bundle.name, "The Family Papers Bundle");
  assert.equal(bundle.price, "$39");
  assert.equal(bundle.gumroadUrl, "https://40sinc.gumroad.com/l/zhtxog");
});

test("landing routes exist and unlisted guides stay invisible to getProduct", () => {
  assert.ok(existsSync(path.join(ROOT, "app/store/[slug]/page.tsx")), "app/store/[slug]/page.tsx missing");
  assert.ok(existsSync(path.join(ROOT, "app/store/lane/[lane]/page.tsx")), "app/store/lane/[lane]/page.tsx missing");
  for (const guide of publicGuides()) {
    assert.equal(catalog.getProduct(guide.slug)?.slug, guide.slug, `${guide.slug} must resolve through getProduct`);
  }
  // Parked pending expert review: priced but unlisted, so no landing page may exist.
  assert.equal(catalog.getProduct("strong-bones-after-50"), undefined);
  assert.equal(catalog.getProduct("padel-after-50"), undefined);
  assert.equal(catalog.getProduct("balance-after-60"), undefined);
});
