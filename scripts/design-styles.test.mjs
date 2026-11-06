// Public /styles gallery: eight named layouts, no client-demo leakage.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { existsSync, readFileSync } = await import("node:fs");
const path = (await import("node:path")).default;
const { fileURLToPath } = await import("node:url");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const {
  DESIGN_STYLES,
  getDesignStyle,
  isDesignStyleId,
} = await import("../lib/design-styles.ts");

const EXPECTED_IDS = [
  "neon-glass",
  "purple-gradient",
  "minimal-dark",
  "split-hero",
  "card-grid",
  "bold-type",
  "photo-focus",
  "funnel-ready",
];

test("Sitesinc ships exactly eight named layouts", () => {
  assert.equal(DESIGN_STYLES.length, 8);
  assert.deepEqual(DESIGN_STYLES.map((s) => s.id), EXPECTED_IDS);
  assert.equal(new Set(DESIGN_STYLES.map((s) => s.name)).size, 8);
  for (const style of DESIGN_STYLES) {
    assert.ok(style.name.trim().length > 0, style.id);
    assert.ok(style.blurb.trim().length > 20, style.id);
    assert.match(style.accent, /^#[0-9a-f]{6}$/i);
    assert.equal(isDesignStyleId(style.id), true);
    assert.equal(getDesignStyle(style.id)?.id, style.id);
  }
  assert.equal(isDesignStyleId("not-a-style"), false);
  assert.equal(getDesignStyle("not-a-style"), undefined);
});

test("public /styles routes exist and stay off private client demos", () => {
  const index = path.join(ROOT, "app/styles/page.tsx");
  const detail = path.join(ROOT, "app/styles/[id]/page.tsx");
  assert.equal(existsSync(index), true);
  assert.equal(existsSync(detail), true);
  const indexSrc = readFileSync(index, "utf8");
  const detailSrc = readFileSync(detail, "utf8");
  const cardSrc = readFileSync(path.join(ROOT, "components/StylePreviewCard.tsx"), "utf8");
  for (const [rel, src] of [
    ["app/styles/page.tsx", indexSrc],
    ["app/styles/[id]/page.tsx", detailSrc],
    ["components/StylePreviewCard.tsx", cardSrc],
  ]) {
    assert.match(src, /DESIGN_STYLES|style\.id|SITESINC_SITE/, rel);
    assert.doesNotMatch(src, /\/demo\/client\//, rel);
    assert.doesNotMatch(src, /readClientWorkspace|findProjectById/, rel);
  }
  assert.match(indexSrc, /StylePreviewCard/);
  assert.match(detailSrc, /MiniSiteFrame/);
  assert.match(detailSrc, /generateStaticParams/);
});

test("nav, packages hub, and sitemap expose /styles", async () => {
  const nav = readFileSync(path.join(ROOT, "lib/site-nav.ts"), "utf8");
  assert.match(nav, /href: "\/styles"/);
  const { SITE_NAV, SITE_HUB_LINKS } = await import("../lib/site-nav.ts");
  assert.ok(SITE_NAV.some((link) => link.href === "/styles"));
  assert.ok(SITE_HUB_LINKS.some((link) => link.href === "/styles"));

  const { PUBLIC_PATHS } = await import("../lib/factory/pipeline.ts");
  assert.ok(PUBLIC_PATHS.includes("/styles"));

  process.env.SITESINC_STORE = "local";
  const { default: sitemap } = await import("../app/sitemap.ts");
  const urls = (await sitemap()).map((e) => e.url);
  assert.ok(urls.includes("https://sitesinc.co/styles"));
  for (const id of EXPECTED_IDS) {
    assert.ok(urls.includes(`https://sitesinc.co/styles/${id}`), id);
  }
});
