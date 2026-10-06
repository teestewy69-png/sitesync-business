// Client real-domain routing: host normalisation, Sitesinc-vs-client host split, path mapping, the actual
// middleware (rewrites / 404s / unchanged factory auth), sign-off qualification and what the domain publishes.
//   node --test scripts/client-domain.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const host = await import("../lib/client-domain/host.ts");
const { middleware, config } = await import("../middleware.ts");
const { NextRequest } = await import("next/server.js");
const domain = await import("../lib/factory/client-domain.ts");

test("normalizeHost / normalizeDomain / www pairing", () => {
  assert.equal(host.normalizeHost("Example.COM:443"), "example.com");
  assert.equal(host.normalizeHost("example.com."), "example.com");
  assert.equal(host.normalizeHost("a.com, b.com"), "a.com");
  assert.equal(host.normalizeHost("[::1]:3000"), "[::1]");
  assert.equal(host.normalizeDomain("https://www.DesertFlow.com/contact?x=1"), "www.desertflow.com");
  assert.equal(host.normalizeDomain("desertflow"), "", "no TLD");
  assert.equal(host.normalizeDomain("10.0.0.1"), "", "IPs are never client domains");
  assert.equal(host.normalizeDomain("bad_host.com"), "");
  assert.deepEqual(host.domainHosts("www.desertflow.com"), ["desertflow.com", "www.desertflow.com"]);
  assert.ok(host.sameClientDomain("desertflow.com", "WWW.desertflow.com"));
  assert.ok(!host.sameClientDomain("desertflow.com", "desertflow.co"));
  assert.ok(!host.sameClientDomain("shop.desertflow.com", "desertflow.com"), "other subdomains are not the same site");
});

test("Sitesinc, staging, Netlify preview and local hosts are never client domains", () => {
  for (const h of [
    "sitesinc.co", "www.sitesinc.co", "test.sitesinc.co", "SITESINC.CO:443",
    "sitesinc.netlify.app", "deploy-preview-12--sitesinc.netlify.app", "68a1b2--sitesinc.netlify.app", "x.netlify.live",
    "localhost", "localhost:3000", "127.0.0.1:3100", "[::1]:3000", "app.localhost", "devbox", "my-mac.local", "",
  ]) {
    assert.ok(host.isSitesincHost(h, {}), h || "(empty)");
  }
  // extra Sitesinc hosts from env (custom alias, deploy URLs)
  assert.ok(host.isSitesincHost("sitesinc.com", { SITESINC_HOSTS: "sitesinc.com, preview.example.org" }));
  assert.ok(host.isSitesincHost("www.sitesinc.com", { SITESINC_HOSTS: "sitesinc.com" }));
  assert.ok(host.isSitesincHost("staging.mysite.dev", { URL: "https://staging.mysite.dev" }));
  // client domains
  for (const h of ["desertflow.com", "www.desertflow.com", "desertflowplumbing.co"]) assert.ok(!host.isSitesincHost(h, {}), h);
  assert.ok(!host.isSitesincHost("sitesinc.co.evil.com", {}), "suffix match is on label boundaries only");
  assert.ok(!host.isSitesincHost("notsitesinc.co", {}));
});

test("client path mapping: only the client routes exist", () => {
  const r = (p) => host.clientDomainRoute("desertflow.com", p);
  assert.deepEqual(r("/"), { kind: "rewrite", pathname: "/client-domain/desertflow.com" });
  assert.deepEqual(r("/locations"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/locations" });
  assert.deepEqual(r("/locations/"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/locations" });
  assert.deepEqual(r("/locations/mesa-az"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/locations/mesa-az" });
  assert.deepEqual(r("/locations/mesa-az/"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/locations/mesa-az" });
  assert.deepEqual(r("/sitemap.xml"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/sitemap.xml" });
  assert.deepEqual(r("/robots.txt"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/robots.txt" });
  assert.deepEqual(r("/contact"), { kind: "rewrite", pathname: "/client-domain/desertflow.com/contact" });
  assert.deepEqual(r("/_next/static/chunks/a.js"), { kind: "pass" });
  for (const p of ["/app", "/app/clients/x", "/api/factory/city-launch", "/api/contact", "/demo/client/proj_x", "/client-domain/x.com",
    "/home", "/locations/Mesa AZ", "/locations/mesa-az/extra", "/logo.png", "/favicon.ico", "/shop/item", "/%E0%A4%A"]) {
    assert.equal(r(p).kind, "not_found", p);
  }
  assert.equal(host.clientDomainRoute("localhost", "/").kind, "not_found", "never for non-public hosts");
});

async function run(url, headers = {}) {
  const u = new URL(url);
  return middleware(new NextRequest(url, { headers: { host: u.host, ...headers } }));
}

test("middleware: client host rewrites, Sitesinc host unchanged", async () => {
  delete process.env.CLIENT_DOMAIN_ROUTING;
  // client domain -> internal rewrite (Next sets x-middleware-rewrite)
  let res = await run("https://www.desertflow.com/locations/mesa-az");
  assert.equal(new URL(res.headers.get("x-middleware-rewrite")).pathname, "/client-domain/www.desertflow.com/locations/mesa-az");
  res = await run("https://desertflow.com/");
  assert.equal(new URL(res.headers.get("x-middleware-rewrite")).pathname, "/client-domain/desertflow.com");
  // operator app / API never reachable on a client domain, even with a factory cookie
  res = await run("https://desertflow.com/app/clients", { cookie: "factory_session=whatever" });
  assert.equal(res.status, 404);
  res = await run("https://desertflow.com/api/factory/city-launch");
  assert.equal(res.status, 404);
  // assets pass through untouched
  res = await run("https://desertflow.com/_next/static/x.js");
  assert.equal(res.headers.get("x-middleware-rewrite"), null);
  assert.equal(res.headers.get("x-middleware-next"), "1");

  // Sitesinc: marketing pages pass straight through (no rewrite)
  for (const url of ["https://sitesinc.co/", "https://test.sitesinc.co/pricing", "https://deploy-preview-3--sitesinc.netlify.app/locations", "http://localhost:3000/"]) {
    res = await run(url);
    assert.equal(res.headers.get("x-middleware-rewrite"), null, url);
    assert.equal(res.headers.get("x-middleware-next"), "1", url);
  }
  // Sitesinc: factory auth exactly as before
  res = await run("https://sitesinc.co/app/clients");
  assert.equal(res.status, 307);
  assert.match(res.headers.get("location"), /\/app\/login\?next=%2Fapp%2Fclients$/);
  res = await run("https://sitesinc.co/api/factory/city-launch");
  assert.equal(res.status, 401);
  res = await run("https://sitesinc.co/app/login");
  assert.equal(res.headers.get("x-middleware-next"), "1");
  // the internal prefix is not reachable directly on Sitesinc hosts
  res = await run("https://sitesinc.co/client-domain/desertflow.com/locations");
  assert.equal(res.status, 404);
  // kill switch
  process.env.CLIENT_DOMAIN_ROUTING = "off";
  res = await run("https://desertflow.com/locations");
  assert.equal(res.headers.get("x-middleware-rewrite"), null);
  delete process.env.CLIENT_DOMAIN_ROUTING;
  // matcher excludes only Next static/image assets
  assert.deepEqual(config.matcher, ["/((?!_next/static|_next/image).*)"]);
});

test("serving requires selectedDomain match AND a production sign-off for that same domain", () => {
  const signed = (d) => ({ production: { status: "signed_off", domain: d } });
  assert.ok(domain.qualifiesForHost("desertflow.com", { selectedDomain: "desertflow.com" }, signed("desertflow.com")));
  assert.ok(domain.qualifiesForHost("www.desertflow.com", { selectedDomain: "desertflow.com" }, signed("desertflow.com")), "www alias");
  assert.ok(!domain.qualifiesForHost("desertflow.com", { selectedDomain: "desertflow.com" }, { production: { status: "not_requested" } }));
  assert.ok(!domain.qualifiesForHost("desertflow.com", { selectedDomain: "desertflow.com" }, { production: { status: "revoked", domain: "desertflow.com" } }));
  assert.ok(!domain.qualifiesForHost("desertflow.com", { selectedDomain: "desertflow.com" }, null));
  assert.ok(!domain.qualifiesForHost("other.com", { selectedDomain: "desertflow.com" }, signed("desertflow.com")));
  assert.ok(!domain.qualifiesForHost("newdomain.com", { selectedDomain: "newdomain.com" }, signed("desertflow.com")), "domain changed after sign-off -> needs a new sign-off");
  assert.ok(!domain.qualifiesForHost("desertflow.com", { selectedDomain: undefined }, signed("desertflow.com")));
});

test("the client domain publishes only approved, non-seed pages; sitemap matches", () => {
  const pages = domain.publishedClientPages([
    { slug: "home", title: "Desert Flow Plumbing | Phoenix", body: "# Home\n\nReal approved copy.", status: "approved" },
    { slug: "contact", title: "Contact", body: "Call us.", status: "published" },
    { slug: "services", title: "Services", body: "[FACTORY DRAFT - auto-seeded ...]\n\nx", status: "approved" },
    { slug: "emergency", title: "Emergency", body: "Draft text", status: "ready_for_review" },
    { slug: "about", title: "About", body: "   ", status: "approved" },
  ]);
  assert.deepEqual(pages.map((p) => p.slug), ["home", "contact"]);
  assert.equal(pages[0].path, "/");
  const urls = domain.clientSitemapUrls("https://desertflow.com", pages, [{ slug: "mesa-az", approvedAt: "2026-10-05T10:00:00Z" }]);
  assert.deepEqual(urls.map((u) => u.loc), ["https://desertflow.com/", "https://desertflow.com/contact", "https://desertflow.com/locations", "https://desertflow.com/locations/mesa-az"]);
  assert.equal(domain.clientSitemapUrls("https://desertflow.com", [], []).length, 1, "no locations entry without approved city pages");
  assert.match(domain.sitemapXml(urls), /<lastmod>2026-10-05<\/lastmod>/);
});
