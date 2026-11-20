// The Bad-Website Hunter. Runs outside the warehouse web server, on a list of businesses WITH
// websites, and ranks the ones whose sites are not up to par — using the factory's own deep-audit
// engine (lib/siteflow/generators/seo-audit.ts). Local only; never deploys, never contacts anyone.
//
// Outreach rule (Tony, 2026-11-20): transparent only. The shortlist contains ONLY findings the
// audit actually verified on the business's own site — the pitch is "an external audit of your
// website noticed misplaced or non-existent details that would improve your business." No fake
// quote requests, no invented problems.
//
//   node scripts/hunter/hunt.mjs <targets.csv|targets.txt> [--max-pages 12] [--threshold 70] [--out scripts/hunter/out]
//
// targets.csv columns: name,url,city,phone,email   (only url is required)
// targets.txt: one URL per line.
import { register } from "node:module";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

register("../fixtures/ts-resolver.mjs", import.meta.url);

if (process.env.NETLIFY || process.env.CONTEXT) {
  console.error("This runner is local only.");
  process.exit(1);
}
delete process.env.NETLIFY;
delete process.env.CONTEXT;
delete process.env.SITE_ID;
delete process.env.NETLIFY_BLOBS_CONTEXT;
delete process.env.AWS_LAMBDA_FUNCTION_NAME;
process.env.SITESINC_STORE = "local";

const { crawlSite, auditIssues, healthScore, siteNap, publishedPhones, localBusinessNodes } =
  await import("../../lib/siteflow/generators/seo-audit.ts");

const args = process.argv.slice(2);
const inputPath = args.find((a) => !a.startsWith("--"));
if (!inputPath) {
  console.error("Usage: node scripts/hunter/hunt.mjs <targets.csv|targets.txt> [--max-pages N] [--threshold N] [--out DIR]");
  process.exit(1);
}
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
};
const maxPages = Math.max(1, parseInt(opt("max-pages", "12"), 10) || 12);
const threshold = Math.max(0, parseInt(opt("threshold", "70"), 10) || 70);
const outDir = opt("out", "scripts/hunter/out");
// --render adds the Firecrawl-class layer: a real headless browser (~/workspace/hunter-tools/
// render.mjs, Playwright/Chromium) loads each homepage the way a visitor sees it — JavaScript
// running — and checks whether a phone number is visible on the first screen or buried below
// the fold. Needs a normal network connection; the Muse sandbox's egress proxy refuses
// browser tunnels, so from the sandbox every render comes back as an error (never a finding).
const renderEnabled = args.includes("--render");
const renderScript = opt(
  "render-script",
  fileURLToPath(new URL("../../../../hunter-tools/render.mjs", import.meta.url))
);

function runRender(target, shotsDir) {
  const slug = (target.name || target.url).replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").slice(0, 40) || "site";
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [renderScript, target.url, shotsDir, slug],
      { timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
      (err, stdout) => {
        try {
          resolve(JSON.parse(stdout.trim().split("\n").pop()));
        } catch {
          resolve({ url: target.url, error: `render worker failed: ${err?.message ?? "no output"}` });
        }
      }
    );
  });
}

function readTargets(file) {
  const raw = readFileSync(file, "utf8");
  if (/\.txt$/i.test(file)) {
    return raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map((url) => ({ name: "", url, city: "" }));
  }
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const col = (name) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    // Simple CSV: no quoted commas in our target lists (names/cities don't carry them).
    const cells = line.split(",").map((c) => c.trim());
    return {
      name: col("name") >= 0 ? cells[col("name")] ?? "" : "",
      url: cells[col("url")] ?? "",
      city: col("city") >= 0 ? cells[col("city")] ?? "" : "",
    };
  }).filter((t) => t.url);
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const YEAR_RE = /(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi;

function hunterSignals(result, nap) {
  let hasTapToCall = false;
  let hasEmail = false;
  let hasForm = false;
  const years = new Set();
  for (const page of result.pages) {
    for (const link of page.externalLinks ?? []) {
      if (/^tel:/i.test(link)) hasTapToCall = true;
      if (/^mailto:/i.test(link)) hasEmail = true;
    }
    if ((page.forms ?? []).length > 0) hasForm = true;
    if (page.text) {
      if (!hasEmail && EMAIL_RE.test(page.text)) hasEmail = true;
      EMAIL_RE.lastIndex = 0;
      for (const m of page.text.matchAll(YEAR_RE)) years.add(parseInt(m[1], 10));
    }
  }
  const newestYear = years.size ? Math.max(...years) : null;
  const thisYear = new Date().getFullYear();
  return {
    hasTapToCall,
    hasEmail,
    hasForm,
    hasPhonePublished: publishedPhones(nap).length > 0,
    hasLocalSchema: localBusinessNodes(result).length > 0,
    newestCopyrightYear: newestYear,
    outdated: newestYear !== null && newestYear <= thisYear - 2,
  };
}

async function huntOne(target) {
  const started = Date.now();
  try {
    const result = await crawlSite(target.url, { maxPages });
    const issues = auditIssues(result);
    const nap = siteNap(result);
    const signals = hunterSignals(result, nap);
    const counts = { high: 0, medium: 0, low: 0 };
    for (const i of issues) counts[i.severity] += 1;
    const score = healthScore(issues);

    const reasons = [];
    if (!signals.hasPhonePublished) reasons.push("No phone number published anywhere on the site");
    if (!signals.hasTapToCall) reasons.push("No tap-to-call phone link (mobile visitors can't tap to call)");
    if (!signals.hasEmail && !signals.hasForm) reasons.push("No email address and no contact form");
    if (signals.outdated) reasons.push(`Site looks stale — newest copyright year is ${signals.newestCopyrightYear}`);
    if (!signals.hasLocalSchema) reasons.push("No LocalBusiness structured data (Google can't verify the business from its site)");
    if (counts.high > 0) reasons.push(`${counts.high} high-severity problem${counts.high > 1 ? "s" : ""} found by the audit`);
    if (score < threshold) reasons.push(`Health score ${score}/100 (below the ${threshold} bar)`);

    const notUpToPar =
      score < threshold || counts.high > 0 || !signals.hasPhonePublished ||
      (!signals.hasEmail && !signals.hasForm) || signals.outdated;

    return {
      name: target.name || result.origin,
      url: target.url,
      origin: result.origin,
      city: target.city || "",
      pagesCrawled: result.pages.length,
      https: result.https,
      score,
      counts,
      signals,
      phones: publishedPhones(nap).map((p) => p.display),
      addresses: nap.addresses.map((a) => a.display),
      topIssues: issues.slice(0, 8).map((i) => ({ severity: i.severity, page: i.page, issue: i.issue })),
      notUpToPar,
      reasons,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      name: target.name || target.url,
      url: target.url,
      city: target.city || "",
      error: String(err?.message ?? err),
      notUpToPar: true,
      reasons: ["The site could not be loaded at all during the audit"],
      ms: Date.now() - started,
    };
  }
}

const targets = readTargets(inputPath);
console.log(`Hunting ${targets.length} site(s), up to ${maxPages} pages each, bar = score ${threshold}${renderEnabled ? ", render layer ON" : ""}…`);
const shotsDir = path.join(outDir, "shots");
const results = [];
for (const t of targets) {
  const r = await huntOne(t);
  if (renderEnabled && !r.error) {
    r.render = await runRender(t, shotsDir);
    const m = r.render.viewports?.mobile;
    if (r.render.error) {
      r.renderNote = `Render check unavailable: ${r.render.error}`;
    } else if (m) {
      if (!m.phones.length) {
        r.reasons.push("No phone number visible on the homepage as visitors actually see it (rendered page)");
        r.notUpToPar = true;
      } else if (m.phoneBelowFold) {
        r.reasons.push("Phone number is below the fold on a phone screen — visitors have to scroll to find it");
        r.notUpToPar = true;
      }
    }
  }
  results.push(r);
  console.log(`  ${r.error ? "ERROR" : `${r.score}/100`}  ${r.url}${r.notUpToPar ? "  ← not up to par" : ""}`);
}
results.sort((a, b) => (a.score ?? -1) - (b.score ?? -1));

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, `hunt-${stamp}.json`);
writeFileSync(jsonPath, JSON.stringify({ at: new Date().toISOString(), threshold, maxPages, results }, null, 2));

const flagged = results.filter((r) => r.notUpToPar);
const md = [
  `# Bad-website hunt — ${new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })} PT`,
  "",
  `${results.length} site(s) audited · ${flagged.length} not up to par · bar: health score ${threshold}, any high-severity finding, no published phone, no email/form, or a stale copyright year.`,
  "Every reason below was verified on the business's own site by the audit engine — nothing invented.",
  "",
  ...flagged.flatMap((r, i) => [
    `## ${i + 1}. ${r.name}${r.city ? ` — ${r.city}` : ""}`,
    `${r.url}${r.error ? ` — ERROR: ${r.error}` : ` — score ${r.score}/100 (${r.counts.high} high, ${r.counts.medium} medium, ${r.counts.low} low), ${r.pagesCrawled} pages crawled`}`,
    ...r.reasons.map((x) => `- ${x}`),
    ...(r.render?.viewports?.mobile
      ? [`- Rendered homepage on a phone screen: ${r.render.viewports.mobile.phones.length ? `first phone number at ${r.render.viewports.mobile.firstPhoneTop}px down a ${r.render.viewports.mobile.viewportHeight}px-tall first screen` : "no phone number visible"} · screenshot: ${r.render.viewports.mobile.screenshot}`]
      : []),
    ...(r.renderNote ? [`- ${r.renderNote}`] : []),
    ...(r.topIssues ?? []).slice(0, 5).map((x) => `- [${x.severity}] ${x.issue}`),
    "",
  ]),
].join("\n");
const mdPath = path.join(outDir, `hunt-${stamp}.md`);
writeFileSync(mdPath, md);
console.log(`\n${flagged.length} of ${results.length} site(s) not up to par.`);
console.log(`Full results: ${jsonPath}`);
console.log(`Shortlist:    ${mdPath}`);
