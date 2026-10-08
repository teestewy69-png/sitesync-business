// Unit tests (no network, no Netlify): node --test scripts/migrate-factory-state.test.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { UsageError, collect, isDemoOrigin, parseArgs, scrubWorkspace, selectGroups, verifySite } from "./migrate-factory-state.mjs";

const ID = "site-123";
const TOKEN = "tok_SECRET_should_never_appear";

function mockFetch(site, status = 200, calls = []) {
  return async (url, init) => {
    calls.push({ url: String(url), init });
    return { ok: status >= 200 && status < 300, status, json: async () => site };
  };
}
const stagingSite = { id: ID, name: "sitesinc-test", url: "https://test.sitesinc.co", ssl_url: "https://test.sitesinc.co", custom_domain: "test.sitesinc.co", domain_aliases: [] };
const prodSite = { id: "prod-9", name: "sitesyncllc", url: "https://sitesinc.co", ssl_url: "https://sitesinc.co", custom_domain: "sitesinc.co", domain_aliases: ["www.sitesinc.co"] };

test("verifySite: staging site matches test.sitesinc.co; sends bearer token to /sites/{id}", async () => {
  const calls = [];
  const out = await verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: mockFetch(stagingSite, 200, calls) });
  assert.equal(out.name, "sitesinc-test");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.netlify.com/api/v1/sites/site-123");
  assert.equal(calls[0].init.headers.authorization, `Bearer ${TOKEN}`);
});

test("verifySite: production site matches sitesinc.co", async () => {
  const out = await verifySite({ siteId: "prod-9", expectHost: "sitesinc.co", target: "production", token: TOKEN, fetchImpl: mockFetch(prodSite) });
  assert.ok(out.hosts.includes("sitesinc.co"));
});

test("verifySite: refuses staging target with a non-test expect-host (before any fetch)", async () => {
  let called = false;
  await assert.rejects(verifySite({ siteId: ID, expectHost: "sitesinc.co", target: "staging", token: TOKEN, fetchImpl: async () => { called = true; } }), UsageError);
  assert.equal(called, false);
});

test("verifySite: refuses production target with a test expect-host", async () => {
  await assert.rejects(verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "production", token: TOKEN, fetchImpl: mockFetch(stagingSite) }), /cannot use a test host/);
});

test("verifySite: --target staging with a PRODUCTION site id is refused (host mismatch)", async () => {
  await assert.rejects(verifySite({ siteId: "prod-9", expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: mockFetch(prodSite) }), /does not serve test\.sitesinc\.co/);
});

test("verifySite: --target production with the STAGING site id is refused", async () => {
  await assert.rejects(verifySite({ siteId: ID, expectHost: "sitesinc.co", target: "production", token: TOKEN, fetchImpl: mockFetch(stagingSite) }), /does not serve sitesinc\.co/);
});

test("verifySite: production site that also has a test alias is refused", async () => {
  const mixed = { ...prodSite, domain_aliases: ["test.sitesinc.co"] };
  await assert.rejects(verifySite({ siteId: "prod-9", expectHost: "sitesinc.co", target: "production", token: TOKEN, fetchImpl: mockFetch(mixed) }), /test\.\/staging\. host/);
});

test("verifySite: API returns another site id / HTTP error / network error", async () => {
  await assert.rejects(verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: mockFetch({ ...stagingSite, id: "other" }) }), /different site id/);
  await assert.rejects(verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: mockFetch({}, 404) }), /HTTP 404/);
  await assert.rejects(verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: async () => { throw new TypeError("boom"); } }), /Could not reach/);
});

test("verifySite: error messages never contain the token", async () => {
  for (const attempt of [
    verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: mockFetch({}, 401) }),
    verifySite({ siteId: "prod-9", expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: mockFetch(prodSite) }),
    verifySite({ siteId: ID, expectHost: "test.sitesinc.co", target: "staging", token: TOKEN, fetchImpl: async () => { throw new Error(TOKEN); } }),
  ]) {
    await assert.rejects(attempt, (err) => !String(err.message).includes(TOKEN));
  }
});

test("parseArgs: workspace skipped by default; including it needs scrub or as-is", () => {
  const base = ["--target", "local", "--dest", "x-dest", "--source", "x-src"];
  assert.deepEqual(parseArgs(base).groups, ["baselines", "checklists", "screenshots"]);
  assert.deepEqual(parseArgs([...base, "--only", "baselines,checklists"]).groups, ["baselines", "checklists"]);
  assert.throws(() => parseArgs([...base, "--only", "workspace"]), /--scrub-workspace/);
  assert.deepEqual(parseArgs([...base, "--only", "workspace,baselines", "--scrub-workspace"]).groups, ["baselines", "workspace"]);
  assert.throws(() => parseArgs([...base, "--scrub-workspace"]), /only make sense/);
  assert.throws(() => parseArgs([...base, "--only", "workspace", "--scrub-workspace", "--workspace-as-is"]), /only one/);
  assert.throws(() => parseArgs([...base, "--only", "nope"]), /unknown group/);
  assert.deepEqual(selectGroups({ only: null, exclude: ["screenshots"] }), ["baselines", "checklists"]);
  assert.equal(parseArgs(base).includeDemo, false);
  assert.equal(parseArgs([...base, "--include-demo-baselines"]).includeDemo, true);
});

test("parseArgs: production still needs the acknowledgement; local rejects site flags", () => {
  assert.throws(() => parseArgs(["--target", "production"]), /i-know-this-is-production/);
  assert.throws(() => parseArgs(["--target", "local", "--dest", "d", "--expect-host", "x.co"]), /only apply to/);
});

test("isDemoOrigin", () => {
  assert.equal(isDemoOrigin("http://127.0.0.1:3010/demo/smith-plumbing"), true);
  assert.equal(isDemoOrigin("http://localhost:3000"), true);
  assert.equal(isDemoOrigin("https://sitesinc.co/demo/x"), true);
  assert.equal(isDemoOrigin("https://sitesinc.co"), false);
  assert.equal(isDemoOrigin("https://test.sitesinc.co"), false);
});

test("scrubWorkspace strips intakeProjects, conversion events and deployments only", () => {
  const ws = { project: { id: "sitesinc-growth-case-study" }, intakeProjects: [1, 2], conversions: { events: [1, 2, 3], checks: ["a"] }, deployments: [1], briefs: [1] };
  const { value, removed } = scrubWorkspace(ws);
  assert.deepEqual(removed, { intakeProjects: 2, conversionEvents: 3, deployments: 1 });
  assert.deepEqual(value.intakeProjects, []);
  assert.deepEqual(value.conversions, { events: [], checks: ["a"] });
  assert.deepEqual(value.deployments, []);
  assert.deepEqual(value.briefs, [1]);
  assert.equal(ws.intakeProjects.length, 2, "input is not mutated");
});

test("collect: default selection skips workspace and demo baselines; counts by group", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "mig-"));
  const root = path.join(dir, "factory");
  await mkdir(path.join(root, "baselines"), { recursive: true });
  await mkdir(path.join(root, "checklists"), { recursive: true });
  const put = (rel, obj) => writeFile(path.join(root, rel), JSON.stringify(obj));
  await put("workspace.json", { project: { id: "sitesinc-growth-case-study" }, intakeProjects: [{}], conversions: { events: [{}] }, deployments: [{}] });
  await put("baselines/b1.json", { origin: "https://sitesinc.co", capturedAt: "2026-01-01", pageInventory: [] });
  await put("baselines/b2.json", { origin: "https://sitesinc.co", capturedAt: "2026-01-02", pageInventory: [] });
  await put("baselines/b3.json", { origin: "http://127.0.0.1:3010/demo/kurtis", capturedAt: "2026-01-03", pageInventory: [] });
  await put("checklists/sitesinc-growth-case-study.json", { projectId: "sitesinc-growth-case-study", sections: [] });
  await writeFile(path.join(root, "baselines/bad.json"), "{not json");

  const first = await collect(dir, { groups: ["baselines", "checklists"] });
  assert.deepEqual(first.items.map((i) => i.key).sort(), ["factory/baselines/b1", "factory/baselines/b2", "factory/checklists/sitesinc-growth-case-study"]);
  assert.ok(first.skipped.some((s) => s.key === "factory/workspace"));
  assert.ok(first.skipped.some((s) => s.key === "factory/baselines/b3" && /demo/.test(s.reason)));
  assert.equal(first.problems.length, 1, "the corrupt baseline is reported as a problem");

  const withDemo = await collect(dir, { groups: ["baselines"], includeDemo: true });
  assert.equal(withDemo.items.filter((i) => i.group === "baselines").length, 3);

  const scrubbed = await collect(dir, { groups: ["workspace"], scrubWorkspace: true });
  assert.equal(scrubbed.items[0].value.intakeProjects.length, 0);
  assert.equal(scrubbed.items[0].value.deployments.length, 0);
  const asIs = await collect(dir, { groups: ["workspace"] });
  assert.equal(asIs.items[0].value.intakeProjects.length, 1);
});
