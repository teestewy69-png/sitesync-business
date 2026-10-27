// Free website audit: SSRF guards, URL normalization, and the seven honest HTML checks.
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const audit = await import("../lib/site-audit.ts");

test("private and non-public addresses are blocked", () => {
  for (const a of ["127.0.0.1", "10.1.2.3", "192.168.0.5", "172.16.0.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
    assert.equal(audit.isPrivateAddress(a), true, a);
  }
  for (const a of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"]) {
    assert.equal(audit.isPrivateAddress(a), false, a);
  }
});

test("input normalization only accepts public http(s) hosts on standard ports", () => {
  assert.equal(audit.normalizeInputUrl("joesplumbing.com")?.toString(), "https://joesplumbing.com/");
  assert.equal(audit.normalizeInputUrl("http://joesplumbing.com/about")?.protocol, "http:");
  for (const bad of ["", "localhost", "http://localhost/x", "ftp://example.com", "file:///etc/passwd", "https://user:pw@example.com", "example.com:8080", "intranet", "a b.com", "http://printer.local", "javascript:alert(1)"]) {
    assert.equal(audit.normalizeInputUrl(bad), null, bad);
  }
});

const GOOD = `<html><head><title>Joe's Plumbing | Corona CA Plumber</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Joe's Plumbing repairs leaks, water heaters and drains for homes and small businesses across the Inland Empire."></head>
<body><a href="tel:+19095550100">Call</a><a href="mailto:joe@example.com">Email</a><a href="/contact">Contact</a>
<a href="https://maps.app.goo.gl/abc">Find us on Google</a></body></html>`;

test("a well-formed page passes all seven checks", () => {
  const checks = audit.analyzeHtml(GOOD, new URL("https://joes.example/"), 600, 3000, null);
  assert.equal(checks.length, 7);
  assert.deepEqual(checks.map((c) => c.status), Array(7).fill("pass"));
});

test("a bare http page fails the basics and says what was seen", () => {
  const checks = audit.analyzeHtml("<html><body>Hello</body></html>", new URL("http://old.example/"), 5000, 900_000, null);
  const by = Object.fromEntries(checks.map((c) => [c.id, c.status]));
  assert.equal(by.https, "fail");
  assert.equal(by.mobile, "fail");
  assert.equal(by.speed, "fail");
  assert.equal(by.title, "fail");
  assert.equal(by.description, "fail");
  assert.equal(by.contact, "fail");
  assert.equal(by.gbp, "warn");
});

test("a phone number in text without a tel: link is a warning, not a pass", () => {
  const checks = audit.analyzeHtml("<body>Call (909) 555-0100</body>", new URL("https://x.example/"), 100, 100, null);
  assert.equal(checks.find((c) => c.id === "contact").status, "warn");
});

test("auditUrl rejects non-public targets without fetching", async () => {
  for (const bad of ["http://127.0.0.1/", "https://169.254.169.254/latest/meta-data", "http://[::1]/"]) {
    const r = await audit.auditUrl(bad);
    assert.equal(r.ok, false, bad);
  }
});
