// Client baseline isolation (no network, no Netlify).
//   node --test scripts/client-baseline.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  isDemoBaseline,
  newestCaseStudyBaseline,
  pickCaseStudyBaseline,
} from "../lib/factory/baseline-pick.ts";
import { FACTORY_PROJECT_ID } from "../lib/factory/types.ts";

const row = (id, capturedAt, origin, siteId) => ({
  id,
  capturedAt,
  origin,
  siteId,
  projectId: siteId,
});

/** Mirrors lib/factory/seo-sites.ts helpers (kept local so this test stays import-light). */
function clientPreviewOrigin(projectId, hostOrigin) {
  const host = String(hostOrigin || "http://127.0.0.1:3000").replace(/\/$/, "");
  const origin = new URL(host).origin;
  return `${origin}/demo/client/${encodeURIComponent(projectId)}`;
}

function clientCrawlPaths(pages) {
  if (!pages?.length) return ["/"];
  const paths = pages.map((page) => {
    if (page.slug === "home" || page.path === "/") return "/";
    const fromPath = (page.path || "").trim();
    if (fromPath && fromPath !== "/") return fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
    return `/${page.slug}`;
  });
  return [...new Set(paths)];
}

test("client preview origin and crawl paths are project-scoped", () => {
  const origin = clientPreviewOrigin("proj_acme", "http://127.0.0.1:3000");
  assert.equal(origin, "http://127.0.0.1:3000/demo/client/proj_acme");
  assert.deepEqual(
    clientCrawlPaths([
      { slug: "home", path: "/" },
      { slug: "services", path: "/services" },
      { slug: "contact", path: "/contact" },
    ]),
    ["/", "/services", "/contact"]
  );
  assert.notEqual("proj_acme", FACTORY_PROJECT_ID);
});

test("client /demo/client baseline is demo-class for case-study picker (never Day 0)", () => {
  const client = row(
    "b_client",
    "2026-10-05T12:00:00.000Z",
    "http://127.0.0.1:3000/demo/client/proj_acme",
    "proj_acme"
  );
  const sitesinc = row("b_site", "2026-09-01T10:00:00.000Z", "https://sitesinc.co", FACTORY_PROJECT_ID);
  assert.equal(isDemoBaseline(client), true);
  assert.equal(newestCaseStudyBaseline([client, sitesinc])?.id, "b_site");
});

test("pickCaseStudyBaseline never selects a client preview baseline", async () => {
  const client = row(
    "b_client_new",
    "2026-10-05T18:00:00.000Z",
    "https://sitesinc.co/demo/client/proj_acme",
    "proj_acme"
  );
  const sitesinc = row("b_site", "2026-09-01T10:00:00.000Z", "https://sitesinc.co", FACTORY_PROJECT_ID);
  const byId = new Map([
    [client.id, client],
    [sitesinc.id, sitesinc],
  ]);
  const picked = await pickCaseStudyBaseline({
    latestBaselineId: "",
    latestBaselineBySite: { proj_acme: client.id },
    read: async (id) => byId.get(id) ?? null,
    list: async () => [client, sitesinc],
  });
  assert.equal(picked?.id, "b_site");
  assert.notEqual(picked?.siteId, "proj_acme");
});

test("site-scoped pick: client baseline id differs from Sitesinc baseline id", () => {
  const client = row(
    "b_client_only",
    "2026-10-05T12:00:00.000Z",
    "http://127.0.0.1:3000/demo/client/proj_acme",
    "proj_acme"
  );
  const sitesinc = row("b_sitesinc_only", "2026-10-05T12:00:00.000Z", "https://sitesinc.co", FACTORY_PROJECT_ID);
  assert.notEqual(client.id, sitesinc.id);
  assert.notEqual(client.siteId, sitesinc.siteId);
  assert.equal(isDemoBaseline(sitesinc), false);
  assert.equal(isDemoBaseline(client), true);
});
