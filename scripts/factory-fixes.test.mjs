// Factory fixes from the FlipRadar audit (no network).
//   node --test scripts/factory-fixes.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { crawlablePath, enqueue, newDiscovery, robotsDisallows } from "../lib/factory/crawl-discovery.ts";
import {
  applyRealSitePlan,
  clientFacingEmail,
  draftFromRealPage,
  seoFindings,
  slugFromPath,
  usableRealPages,
} from "../lib/factory/client-real-site.ts";

const O = "https://flipradar-app.netlify.app";
const page = (path, extra = {}) => ({
  url: `${O}${path === "/" ? "" : path}`, path, statusCode: 200, title: `T ${path}`, metaDescription: "m".repeat(130),
  canonical: `${O}${path === "/" ? "" : path}`, robots: "", wordCount: 500,
  headings: { h1: [`H1 ${path}`], h2: ["How it works"], h3: [] }, schemaTypes: ["WebSite"], ogTitle: "x", ogDescription: "",
  ogImage: "x", images: [], missingAlt: 0, internalLinks: [], externalLinks: [], forms: [], ttfbMs: 10, bytes: 10, error: "",
  excerpt: "Pick an NBA player, a stat and a line.", ...extra,
});

test("crawlablePath keeps same-origin pages and drops assets, api, other hosts", () => {
  assert.equal(crawlablePath(O, "/props?x=1#y"), "/props");
  assert.equal(crawlablePath(O, `${O}/premium/`), "/premium");
  assert.equal(crawlablePath(O, "/_next/static/a.js"), "");
  assert.equal(crawlablePath(O, "/api/odds"), "");
  assert.equal(crawlablePath(O, "/logo.png"), "");
  assert.equal(crawlablePath(O, "https://example.com/x"), "");
  assert.equal(crawlablePath(O, "mailto:a@b.co"), "");
});

test("crawlablePath is relative to a path-prefixed preview origin", () => {
  const P = "http://127.0.0.1:3100/demo/client/proj_1";
  assert.equal(crawlablePath(P, "/demo/client/proj_1/services"), "/services");
  assert.equal(crawlablePath(P, "/demo/client/proj_1"), "/");
  assert.equal(crawlablePath(P, "/app"), "");
});

test("discovery caps dynamic page groups and honors robots disallow", () => {
  const dis = robotsDisallows("User-agent: *\nDisallow: /account\n\nUser-agent: bad\nDisallow: /");
  assert.deepEqual(dis, ["/account"]);
  const q = newDiscovery(["/"]);
  for (const p of ["/props/a/points", "/props/b/points", "/props/c/points", "/props/d/points"]) enqueue(q, p, 3, dis);
  assert.equal(q.queue.filter((p) => p.startsWith("/props/")).length, 3);
  assert.equal(enqueue(q, "/account/settings", 3, dis), false);
  assert.equal(enqueue(q, "/", 3, dis), false);
});

test("Sitesinc addresses never become client contact details", () => {
  assert.equal(clientFacingEmail("save@sitesinc.co"), "");
  assert.equal(clientFacingEmail("hello@flipradar.co"), "hello@flipradar.co");
});

test("seoFindings reports measured issues incl. canonical mismatch", () => {
  const p = page("/", { canonical: "https://propcheck-tony.netlify.app", title: "x".repeat(70), ogImage: "" });
  const codes = seoFindings(p).map((f) => f.code);
  assert.ok(codes.includes("canonical_mismatch"));
  assert.ok(codes.includes("title_long"));
  assert.ok(codes.includes("og_incomplete"));
});

test("real pages replace template pages; 404/noindex skipped; operator copy kept", () => {
  const snapshot = {
    id: "base_1", capturedAt: "2026-10-19T00:00:00.000Z",
    pageInventory: [
      page("/"), page("/props"), page("/premium"),
      page("/services", { statusCode: 404, error: "HTTP 404" }),
      page("/sign-up", { robots: "noindex" }),
      page("/sign-in"), page("/forgot-password"),
    ],
  };
  assert.deepEqual(usableRealPages(snapshot).map((p) => p.path), ["/", "/props", "/premium"]);
  const current = {
    blueprint: [{ slug: "services", path: "/services" }],
    pages: [
      { slug: "services", path: "/services", status: "ready_for_review", source: "template", body: "x" },
      { slug: "about", path: "/about", status: "ready_for_review", source: "operator", body: "mine" },
    ],
  };
  const out = applyRealSitePlan(current, snapshot, { businessName: "FlipRadar" });
  assert.equal(out.imported, 3);
  assert.deepEqual(out.blueprint.map((b) => b.path), ["/", "/props", "/premium"]);
  assert.ok(out.blueprint.every((b) => b.existing));
  const paths = out.pages.map((p) => p.path);
  assert.ok(!paths.includes("/services"), "template page for a non-existent path is dropped");
  assert.ok(paths.includes("/about"), "operator copy kept");
  const home = out.pages.find((p) => p.path === "/");
  assert.match(home.body, /Pick an NBA player/);
  assert.doesNotMatch(home.body, /service area|sitesinc/i);
  assert.equal(slugFromPath("/props/luka-doncic/points"), "props-luka-doncic-points");
});

test("draftFromRealPage keeps the real title/meta", () => {
  const d = draftFromRealPage(page("/props"), { businessName: "FlipRadar", capturedAt: "2026-10-19", baselineId: "b" });
  assert.equal(d.title, "T /props");
  assert.deepEqual(d.headings, ["H1 /props", "How it works"]);
});
