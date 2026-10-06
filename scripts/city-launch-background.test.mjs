// City Launch Netlify Background Function: handler auth/validation, trigger + fallback semantics, and an
// integration run of the REAL writing loop through the handler (isolated local store + in-process mock LLM).
//   node --test scripts/city-launch-background.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import http from "node:http";
register("./fixtures/ts-resolver.mjs", import.meta.url);

for (const k of ["NETLIFY", "CONTEXT", "SITE_ID", "NETLIFY_BLOBS_CONTEXT", "AWS_LAMBDA_FUNCTION_NAME", "FACTORY_ACCESS_TOKEN",
  "CITY_LAUNCH_LLM_API_KEY", "OPENROUTER_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "EMERGENT_LLM_KEY", "CITY_LAUNCH_BACKGROUND"]) delete process.env[k];
const work = mkdtempSync(path.join(tmpdir(), "cl-bg-"));
process.chdir(work); // isolated ./data store
process.env.SITESINC_STORE = "local";

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const bg = await import("../lib/factory/city-launch-background.ts");
const { sessionValue } = await import("../lib/factory/auth.ts");
const fnModule = await import("../netlify/functions/city-launch-background.mts");

const goodCookie = async () => `factory_session=${await sessionValue("local-dev-only")}`;
const post = (body, cookie, url = "https://sitesinc.co/.netlify/functions/city-launch-background") =>
  new Request(url, { method: "POST", headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });

test("handler: method, auth, validation", async () => {
  const calls = [];
  const marked = [];
  const runTick = async (...a) => { calls.push(a); return { ok: true, status: "completed", drafted: 1, failed: 0, remaining: 0, continued: "none" }; };
  const markStarted = async (...a) => { marked.push(a); };
  assert.equal((await bg.handleCityLaunchBackground(new Request("https://x/", { method: "GET" }), { runTick })).status, 405);
  assert.equal((await bg.handleCityLaunchBackground(post({ projectId: "p", batchId: "b" }), { runTick })).status, 401, "no cookie");
  assert.equal((await bg.handleCityLaunchBackground(post({ projectId: "p", batchId: "b" }, "factory_session=nope"), { runTick })).status, 401, "wrong cookie");
  assert.equal((await bg.handleCityLaunchBackground(post({ projectId: "../x", batchId: "b" }, await goodCookie()), { runTick })).status, 400);
  assert.equal(calls.length, 0);
  const res = await bg.handleCityLaunchBackground(post({ projectId: "proj_1", batchId: "clb_1" }, await goodCookie()), { runTick, markStarted });
  assert.equal(res.status, 200);
  assert.deepEqual(marked, [["proj_1", "clb_1"]], "proof of life recorded before writing");
  assert.deepEqual(calls[0], ["proj_1", "clb_1", { budgetMs: 13 * 60_000, hostOrigin: "https://sitesinc.co" }]);
  assert.equal(typeof fnModule.default, "function", "netlify/functions entry exports the handler");
});

test("trigger: only a 202 counts; everything else falls back to the chained tick", async () => {
  const seen = [];
  const fake = (status) => async (url, init) => { seen.push([url, init.headers.cookie, JSON.parse(init.body)]); return new Response("", { status }); };
  assert.equal(await bg.triggerBackground("https://sitesinc.co", "factory_session=abc", { projectId: "p", batchId: "b" }, fake(202)), true);
  assert.deepEqual(seen[0], ["https://sitesinc.co/.netlify/functions/city-launch-background", "factory_session=abc", { projectId: "p", batchId: "b" }]);
  assert.equal(await bg.triggerBackground("https://sitesinc.co", "c", { projectId: "p", batchId: "b" }, fake(404)), false, "function not deployed");
  assert.equal(await bg.triggerBackground("https://sitesinc.co", "c", { projectId: "p", batchId: "b" }, fake(200)), false, "a sync 200 is not a background accept");
  assert.equal(await bg.triggerBackground("https://sitesinc.co", "c", { projectId: "p", batchId: "b" }, async () => { throw new Error("ECONNREFUSED"); }), false);
  const hang = (url, init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
  assert.equal(await bg.triggerBackground("https://sitesinc.co", "c", { projectId: "p", batchId: "b" }, hang, 50), false, "timeout");
  // stuck detection: a hand-off nobody picked up within 90 s -> fall back to chained ticks
  const t0 = Date.parse("2026-10-05T12:00:00Z");
  assert.equal(bg.backgroundLooksStuck(undefined, t0), false);
  assert.equal(bg.backgroundLooksStuck({ requestedAt: "2026-10-05T11:59:30Z" }, t0), false, "still within grace");
  assert.equal(bg.backgroundLooksStuck({ requestedAt: "2026-10-05T11:58:00Z" }, t0), true, "never started");
  assert.equal(bg.backgroundLooksStuck({ requestedAt: "2026-10-05T11:58:00Z", startedAt: "2026-10-05T11:58:02Z" }, t0), false, "started");
  assert.equal(bg.backgroundLooksStuck({ requestedAt: "2026-10-05T11:58:00Z", startedAt: "2026-10-05T11:50:00Z" }, t0), true, "only an older run started");
  // pending: requested within the grace period and not started -> callers wait instead of re-triggering
  assert.equal(bg.backgroundPending({ requestedAt: "2026-10-05T11:59:30Z" }, t0), true);
  assert.equal(bg.backgroundPending({ requestedAt: "2026-10-05T11:58:00Z" }, t0), false, "past grace -> stuck, not pending");
  assert.equal(bg.backgroundPending({ requestedAt: "2026-10-05T11:59:30Z", startedAt: "2026-10-05T11:59:31Z" }, t0), false, "started");
  assert.equal(bg.backgroundPending(undefined, t0), false);
  assert.equal(bg.backgroundEnabled({}, true), true);
  assert.equal(bg.backgroundEnabled({}, false), false, "local dev keeps the in-process loop");
  assert.equal(bg.backgroundEnabled({ CITY_LAUNCH_BACKGROUND: "off" }, true), false);
  assert.equal(bg.backgroundEnabled({ CITY_LAUNCH_BACKGROUND: "on" }, false), true);
});

// ---- integration: the real writing loop through the background handler ----
function mockLlm() {
  const prose = (seed, n) => {
    const W = "pipe drain valve fixture faucet toilet heater tank sewer line gasket flange union elbow coupling spigot cartridge trap meter shutoff".split(" ");
    let x = seed >>> 0; const o = [];
    for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; o.push(W[(x >>> 8) % W.length]); }
    return o.join(" ") + ".";
  };
  const hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  let calls = 0;
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      calls += 1;
      const j = JSON.parse(body || "{}");
      const user = (j.messages || []).find((m) => m.role === "user")?.content || "";
      const city = (user.match(/CITY:\s*([^\n]+)/) || [])[1]?.trim() || "Somewhere";
      const s = hash(city);
      const content = {
        metaDescription: `Plumbing service in ${city}, AZ from our Phoenix base.`,
        h1: `Plumbing in ${city}`,
        heroSubhead: `${city} ${prose(s + 1, 12)}`,
        intro: `${city} ${prose(s + 2, 60)}`,
        serviceArea: `${city} is in Maricopa County.`,
        sections: [0, 1, 2, 3].map((i) => ({ heading: `${city} ${prose(s + 10 + i, 3)}`, body: `${city} ${prose(s + 20 + i, 100)}` })),
        localHighlights: [prose(s + 30, 8)],
        faq: [],
        ctaHeadline: `Need a plumber in ${city}?`,
        ctaText: prose(s + 50, 12),
      };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ model: "mock-bg", choices: [{ message: { role: "assistant", content: JSON.stringify(content) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, calls: () => calls })));
}

test("integration: background handler runs the real queue -> write -> gate loop to completion", async () => {
  const llm = await mockLlm();
  process.env.CITY_LAUNCH_LLM_API_KEY = "mock";
  process.env.CITY_LAUNCH_LLM_BASE_URL = `http://127.0.0.1:${llm.port}/v1`;
  try {
    const { appendProject, newId } = await import("../lib/store.ts");
    const { applyConfigToProject, buildClientConfig } = await import("../lib/factory/client-config.ts");
    const cl = await import("../lib/factory/city-launch.ts");
    const config = buildClientConfig({ name: "Desert Flow Plumbing", niche: "plumbing", businessType: "plumbing", city: "Phoenix", state: "AZ", phone: "(602) 555-0142", primaryGoal: "calls", label: "bg test" });
    const project = await appendProject(applyConfigToProject({ id: newId("proj"), source: "factory_intake", createdAt: new Date().toISOString(), label: "bg test" }, config));
    const pick = cl.pickCities(project, { mode: "radius", miles: 25, limit: 4, includeOrigin: false });
    assert.ok(pick.ok);
    const q = await cl.queueCityLaunchBatch(project.id, { cities: pick.cities, keyword: "Plumbing", targetWordCount: 400, concurrency: 2, requestsPerMinute: 600 }, "test", { autoStart: false });
    assert.ok(q.ok, q.error);

    const res = await bg.handleCityLaunchBackground(post({ projectId: project.id, batchId: q.batch.id }, await goodCookie(), "http://127.0.0.1:9/.netlify/functions/city-launch-background"));
    assert.equal(res.status, 200);
    const out = await res.json();
    assert.equal(out.status, "completed", JSON.stringify(out));
    assert.equal(out.drafted, 4);
    assert.equal(out.remaining, 0);
    assert.equal(out.continued, "none");
    const batch = await cl.readCityBatch(project.id, q.batch.id);
    assert.equal(batch.status, "completed");
    assert.ok(batch.background?.startedAt, "handler recorded proof of life on the batch");
    assert.equal(batch.lease, null, "lease released");
    const index = await cl.readCityIndex(project.id);
    for (const c of pick.cities) {
      assert.equal(index.pages[c.slug].status, "draft");
      assert.ok(index.pages[c.slug].gate, "gate ran");
    }
    assert.ok(llm.calls() >= 4);
    // a second invocation for a finished batch is a no-op
    const again = await (await bg.handleCityLaunchBackground(post({ projectId: project.id, batchId: q.batch.id }, await goodCookie()))).json();
    assert.equal(again.drafted, 0);
  } finally {
    llm.server.close();
    delete process.env.CITY_LAUNCH_LLM_API_KEY;
    delete process.env.CITY_LAUNCH_LLM_BASE_URL;
  }
});
