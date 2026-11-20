import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";

register("./fixtures/ts-resolver.mjs", import.meta.url);

const { crawlSiteForSeo, mainTextOf } = await import("../lib/factory/seo-crawler.ts");

const ORIGIN = "https://example.com";
const NAV = Array.from({ length: 30 }, () => "NAVBOILER").join(" ");

const PAGES = {
  "/robots.txt": "User-agent: *\nDisallow: /private\n",
  "/sitemap.xml":
    '<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url><url><loc>https://example.com/private</loc></url></urlset>',
  "/": `<html><head>
      <title>Acme Plumbing | Home</title>
      <meta content="Acme fixes pipes fast." name="description">
      <meta property="og:title" content="Acme Plumbing">
      <script type="application/ld+json">{"@type":"LocalBusiness","name":"Acme"}</script>
    </head><body>
      <header><nav>${NAV}</nav></header>
      <main>
        <h1>Plumbing done right</h1>
        <p>We fix leaks and install water heaters across town.</p>
        <a href="/about">About</a> <a href="/contact">Contact</a>
        <a href="/private">Private</a> <a href="https://external.example/x">Partner</a>
        <img src="/a.jpg"> <img src="/b.jpg" alt="Our van">
        <form action="/quote" method="post"><input name="phone" type="tel"></form>
      </main>
      <footer>${NAV}</footer>
    </body></html>`,
  "/about": `<html><head><title>About Acme</title></head><body><main>
      <h1>About us</h1><p>Family owned since 1998.</p>
      <a href="/boom">Boom</a></main></body></html>`,
  "/contact": `<html><head><title>Contact Acme</title></head><body><main>
      <h1>Call us</h1><p>Reach the office any time.</p>
      <a href="/missing">Missing page</a></main></body></html>`,
  "/private": `<html><head><title>Private</title></head><body><main>secret</main></body></html>`,
};

function makeFetcher(calls) {
  return async (url) => {
    calls.push(url);
    const path = new URL(url).pathname;
    if (path === "/boom") throw new Error("socket hang up");
    if (path === "/missing") {
      return { ok: false, status: 404, body: "", ttfbMs: 12, bytes: 0, error: "HTTP 404", finalUrl: url, contentType: "" };
    }
    const body = PAGES[path];
    if (body === undefined) {
      return { ok: false, status: 404, body: "", ttfbMs: 5, bytes: 0, error: "HTTP 404", finalUrl: url, contentType: "" };
    }
    return { ok: true, status: 200, body, ttfbMs: 42, bytes: body.length, error: "", finalUrl: url, contentType: "text/html" };
  };
}

test("crawl discovers seeds + sitemap + links, honors robots, extracts clean records", async () => {
  const calls = [];
  const result = await crawlSiteForSeo(ORIGIN, { fetcher: makeFetcher(calls) });
  const paths = result.pages.map((p) => p.path);
  assert.deepEqual(paths, ["/", "/about", "/contact", "/missing"]);
  assert.ok(!calls.some((u) => u.includes("/private")), "robots-disallowed page must never be fetched");

  const byPath = Object.fromEntries(result.pages.map((p) => [p.path, p]));
  assert.equal(byPath["/"].discoveredVia, "seed");
  assert.equal(byPath["/about"].discoveredVia, "sitemap");
  assert.equal(byPath["/contact"].discoveredVia, "link");

  const home = byPath["/"];
  assert.equal(home.title, "Acme Plumbing | Home");
  assert.equal(home.metaDescription, "Acme fixes pipes fast."); // content-before-name order works
  assert.equal(home.ogTitle, "Acme Plumbing");
  assert.deepEqual(home.schemaTypes, ["LocalBusiness"]);
  assert.equal(home.missingAlt, 1);
  assert.equal(home.forms.length, 1);
  assert.equal(home.forms[0].action, "/quote");
  assert.ok(home.externalLinks.includes("https://external.example/x"));
  assert.equal(home.ttfbMs, 42);

  // The Firecrawl point: boilerplate is stripped, so text metrics describe content.
  assert.ok(!home.mainText.includes("NAVBOILER"));
  assert.ok(home.mainText.includes("We fix leaks and install water heaters"));
  assert.ok(!home.excerpt.includes("NAVBOILER"));
  assert.ok(home.wordCount < 25, `wordCount ${home.wordCount} should count main content only`);

  // A thrown fetch is a recorded failure, not a crashed crawl.
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].url, /\/boom$/);
  // A 404 is a page record with the error set, like the old crawler produced.
  assert.equal(byPath["/missing"].statusCode, 404);
  assert.match(byPath["/missing"].error, /404/);
  assert.equal(result.truncated, false);
});

test("page budget truncates and says so", async () => {
  const result = await crawlSiteForSeo(ORIGIN, { fetcher: makeFetcher([]), maxPages: 2 });
  assert.equal(result.pages.length, 2);
  assert.equal(result.truncated, true);
});

test("non-discovery mode fetches exactly the seeds", async () => {
  const calls = [];
  const result = await crawlSiteForSeo(ORIGIN, {
    fetcher: makeFetcher(calls),
    seeds: ["/", "/about"],
    discover: false,
  });
  assert.deepEqual(result.pages.map((p) => p.path), ["/", "/about"]);
  assert.ok(!calls.some((u) => u.endsWith("/contact")));
});

test("mainTextOf strips chrome but keeps main content", () => {
  const html = `<body><header>HEADWORD</header><main><p>Real content here.</p></main><footer>FOOTWORD</footer></body>`;
  const text = mainTextOf(html);
  assert.ok(text.includes("Real content here."));
  assert.ok(!text.includes("HEADWORD") && !text.includes("FOOTWORD"));
});

test("unsafe origins are refused", async () => {
  await assert.rejects(() => crawlSiteForSeo("http://127.0.0.1:3000", { fetcher: makeFetcher([]) }));
});
