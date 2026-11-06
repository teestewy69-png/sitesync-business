import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SLUGS = [
  "inland-empire-small-business-website-design",
  "affordable-small-business-website-1995",
  "rancho-cucamonga-small-business-web-design",
];

test("each Tony-approved SEO hub has a factory route stub like /website-design", () => {
  const sample = readFileSync(path.join(ROOT, "app/website-design/page.tsx"), "utf8");
  for (const slug of SLUGS) {
    const file = path.join(ROOT, "app", slug, "page.tsx");
    assert.ok(existsSync(file), file);
    const src = readFileSync(file, "utf8");
    assert.match(src, /factoryPageMetadata/);
    assert.match(src, /PublishedOrNotFound/);
    assert.match(src, new RegExp(`slug="${slug}"`));
    assert.match(src, /generateMetadata/);
    assert.equal(src.includes("PublishedOrNotFound"), sample.includes("PublishedOrNotFound"));
  }
});

test("seed workspace publishes the three SEO hubs so getPublishedPage / sitemap can see them", async () => {
  process.env.SITESINC_STORE = "local";
  const { readPublicWorkspace } = await import("../lib/factory/workspace.ts");
  const workspace = await readPublicWorkspace();
  assert.ok(workspace);
  for (const slug of SLUGS) {
    const page = workspace.pages.find((item) => item.slug === slug);
    assert.ok(page, slug);
    assert.equal(page.status, "published", slug);
    assert.equal(page.noindex, false, slug);
    assert.ok(page.body.trim(), slug);
    assert.equal(page.path, `/${slug}`);
    assert.ok(workspace.briefs.some((brief) => brief.slug === slug), slug);
    assert.ok(workspace.blueprint.some((item) => item.slug === slug), slug);
  }
});

test("applyRepoPublishedHubs overlays Tony's copy and marks the three hubs published", async () => {
  const { applyRepoPublishedHubs, PAGE_DRAFTS } = await import("../lib/factory/drafts.ts");
  const pages = applyRepoPublishedHubs(
    SLUGS.map((slug) => ({
      slug,
      path: `/${slug}`,
      title: "",
      metaDescription: "",
      status: "brief_required",
      briefId: "",
      wordCount: 0,
      headings: [],
      body: "",
      noindex: true,
      approvedBy: "",
      approvedAt: "",
      publishedAt: "",
    }))
  );
  for (const slug of SLUGS) {
    const page = pages.find((item) => item.slug === slug);
    assert.equal(page.status, "published");
    assert.equal(page.noindex, false);
    assert.equal(page.body, PAGE_DRAFTS[slug].body);
    assert.equal(page.approvedBy, "Tony Jones");
    assert.doesNotMatch(page.body, /1968 S Coast Hwy/);
  }
});

test("public sitemap lists the three SEO hubs from the published workspace pages", async () => {
  process.env.SITESINC_STORE = "local";
  const { default: sitemap } = await import("../app/sitemap.ts");
  const urls = (await sitemap()).map((entry) => entry.url);
  for (const slug of SLUGS) {
    assert.ok(urls.includes(`https://sitesinc.co/${slug}`), slug);
  }
});
