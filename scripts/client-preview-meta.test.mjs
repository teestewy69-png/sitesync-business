// Client preview brand metadata: tab icon + share image from client uploads, never Sitesinc's.
//   node --test scripts/client-preview-meta.test.mjs     (no network)
import { register } from "node:module";
import { readFileSync, existsSync } from "node:fs";
register("./fixtures/ts-resolver.mjs", import.meta.url);
const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { clientPreviewBrand, clientPreviewBrandMetadata } = await import("../lib/factory/client-preview-meta.ts");
const { CLIENT_ASSET_ROLES } = await import("../lib/factory/client-content.ts");

const asset = (id, role, alt = "alt") => ({ id, filename: `${id}.png`, key: "", contentType: "image/png", bytes: 1, sha256: "", sourceName: "", alt, role, uploadedAt: "", uploadedBy: "" });
const page = { title: "T", description: "D", siteName: "FlipRadar" };

test("icon and share roles are accepted for uploads", () => {
  assert.ok(CLIENT_ASSET_ROLES.includes("icon"));
  assert.ok(CLIENT_ASSET_ROLES.includes("share"));
});

test("no uploads: Sitesinc icons are replaced and no share image is emitted", () => {
  const meta = clientPreviewBrandMetadata(clientPreviewBrand("proj_x", null, "https://test.sitesinc.co"), page);
  const json = JSON.stringify(meta.icons);
  assert.ok(!/logo\.png|favicon\.ico/.test(json));
  assert.equal(meta.openGraph, null);
  assert.equal(meta.twitter, null);
});

test("logo only: logo is the tab icon and the share image (absolute on the preview host)", () => {
  const content = { assets: [asset("ast_logo1", "logo", "FlipRadar logo")], artworks: [], updatedAt: "" };
  const brand = clientPreviewBrand("proj_x", content, "https://test.sitesinc.co");
  assert.equal(brand.icon.src, "/api/client-assets/proj_x/ast_logo1.png");
  const meta = clientPreviewBrandMetadata(brand, page);
  assert.equal(meta.icons.icon[0].url, "/api/client-assets/proj_x/ast_logo1.png");
  assert.equal(meta.openGraph.images[0].url, "https://test.sitesinc.co/api/client-assets/proj_x/ast_logo1.png");
  assert.equal(meta.twitter.card, "summary_large_image");
});

test("icon and share uploads win over the logo", () => {
  const content = { assets: [asset("ast_logo1", "logo"), asset("ast_icon1", "icon"), asset("ast_share1", "share")], artworks: [], updatedAt: "" };
  const brand = clientPreviewBrand("proj_x", content, null);
  assert.equal(brand.icon.src, "/api/client-assets/proj_x/ast_icon1.png");
  assert.equal(brand.logo.src, "/api/client-assets/proj_x/ast_logo1.png");
  assert.equal(brand.shareImage.url, "/api/client-assets/proj_x/ast_share1.png");
});

test("root layout declares the Sitesinc favicon in metadata, not as app/favicon.ico", () => {
  assert.ok(!existsSync(new URL("../app/favicon.ico", import.meta.url)));
  assert.ok(existsSync(new URL("../public/favicon.ico", import.meta.url)));
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
  assert.match(layout, /url: "\/favicon\.ico"/);
  for (const f of ["../app/demo/client/[projectId]/page.tsx", "../app/demo/client/[projectId]/[slug]/page.tsx"]) {
    assert.match(readFileSync(new URL(f, import.meta.url), "utf8"), /clientPreviewBrandMetadata\(/);
  }
});
