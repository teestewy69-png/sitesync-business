#!/usr/bin/env node
/**
 * Copy the git-ignored local factory/SEO state (data/factory/**) into a durable target store.
 *
 *   node scripts/migrate-factory-state.mjs --target <local|staging|production> [options]
 *
 * SAFE BY DEFAULT
 *   - DRY RUN unless --apply is passed. A dry run reads local files only: no network, no writes,
 *     no credentials needed. It prints exactly which keys would be written and which are filtered out.
 *   - --target is required (there is no default).
 *   - --target production is refused unless --i-know-this-is-production is ALSO passed (even for a dry run).
 *   - Existing keys in the target are NEVER overwritten unless --overwrite is passed
 *     (create-only writes; already-present keys are reported as "exists, skipped").
 *   - Nothing is ever deleted. The source files are only read.
 *   - The workspace is NOT migrated unless you explicitly include it (see --only), and then you must
 *     choose --scrub-workspace or --workspace-as-is.
 *   - Demo/local-dev baselines (127.0.0.1, localhost, /demo/ origins) are skipped by default.
 *   - Applying to staging/production needs --expect-host and --confirm-site, and the script asks the
 *     Netlify API (GET /sites/{id}) whether that site really is the expected host BEFORE writing.
 *
 * What to copy
 *   --only <list>      comma list of groups: baselines,checklists,screenshots,workspace
 *                      (default when omitted: baselines,checklists,screenshots - NOT the workspace)
 *   --exclude <list>   remove groups from the selection
 *   --include-demo-baselines   also copy baselines whose origin is a demo/local site
 *                      (default: --exclude-demo-baselines behaviour, which is accepted as an explicit no-op flag)
 *   --scrub-workspace  when the workspace is included: strip intakeProjects, conversion events and
 *                      deployment records (keeps briefs, pages, stages, study, indexing, backlinks...)
 *   --workspace-as-is  when the workspace is included: copy it verbatim (explicit acknowledgement)
 *
 * Where to copy
 *   --source <dir>     data directory to read (default ./data; expects <dir>/factory/...)
 *   --dest <dir>       REQUIRED for --target local: data directory to write into (must differ from --source)
 *   --site-id <id>     Netlify site id for staging/production (or env NETLIFY_SITE_ID). Apply only.
 *   --expect-host <h>  host the site must serve, e.g. test.sitesinc.co (staging) or sitesinc.co (production).
 *                      Staging requires a host starting with "test."; production refuses any test./staging. host.
 *   --confirm-site <id> must equal the site id (typed confirmation; catches a pasted wrong id)
 *   --overwrite        replace keys that already exist in the target
 *   --apply            actually write (otherwise dry run)
 *
 * Credentials for staging/production (apply only): env NETLIFY_AUTH_TOKEN (personal access token with
 * access to that site) and the site id. The token is read from the environment only, never from argv,
 * and is never printed.
 *
 * Key layout (identical to lib/persistence.ts + lib/factory/*):
 *   factory/workspace            <- data/factory/workspace.json
 *   factory/baselines/<id>       <- data/factory/baselines/<id>.json
 *   factory/checklists/<project> <- data/factory/checklists/<project>.json
 *   factory/screenshots/<file>   <- data/factory/screenshots/<file>   (binary)
 * Blob store names: staging -> sitesinc-crm-staging, production -> sitesinc-crm.
 *
 * After a migration WITHOUT the workspace the store has no workspace document, so the public intake
 * mirror stays off (by design). Initialize it once with the operator action
 *   POST /api/factory/action  {"op":"init-workspace"}   (any /app operator action also creates it)
 * or include the workspace in the migration.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const STORE_NAMES = { staging: "sitesinc-crm-staging", production: "sitesinc-crm" };
export const GROUPS = ["baselines", "checklists", "screenshots", "workspace"];
export const DEFAULT_GROUPS = ["baselines", "checklists", "screenshots"];
const FACTORY_PROJECT_ID = "sitesinc-growth-case-study";
const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]*(\/[a-z0-9][a-z0-9_.-]*)*$/i;
const IMAGE_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const NETLIFY_API = "https://api.netlify.com/api/v1";

export class UsageError extends Error {}

function fail(message) {
  throw new UsageError(message);
}

function splitList(raw, flag) {
  const parts = String(raw)
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) fail(`${flag} needs at least one group (${GROUPS.join(", ")}).`);
  for (const part of parts) {
    if (!GROUPS.includes(part)) fail(`${flag}: unknown group "${part}" (valid: ${GROUPS.join(", ")}).`);
  }
  return parts;
}

export function parseArgs(argv) {
  const opts = {
    apply: false,
    overwrite: false,
    prodAck: false,
    source: "data",
    dest: "",
    target: "",
    siteId: "",
    only: null,
    exclude: [],
    includeDemo: false,
    scrubWorkspace: false,
    workspaceAsIs: false,
    expectHost: "",
    confirmSite: "",
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = () => {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) fail(`${arg} needs a value.`);
      i += 1;
      return next;
    };
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--overwrite") opts.overwrite = true;
    else if (arg === "--i-know-this-is-production") opts.prodAck = true;
    else if (arg === "--include-demo-baselines") opts.includeDemo = true;
    else if (arg === "--exclude-demo-baselines") opts.includeDemo = false;
    else if (arg === "--scrub-workspace") opts.scrubWorkspace = true;
    else if (arg === "--workspace-as-is") opts.workspaceAsIs = true;
    else if (arg === "--only") opts.only = splitList(value(), "--only");
    else if (arg === "--exclude") opts.exclude = splitList(value(), "--exclude");
    else if (arg === "--target") opts.target = value();
    else if (arg === "--source") opts.source = value();
    else if (arg === "--dest") opts.dest = value();
    else if (arg === "--site-id") opts.siteId = value();
    else if (arg === "--expect-host") opts.expectHost = value().trim().toLowerCase();
    else if (arg === "--confirm-site") opts.confirmSite = value().trim();
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else fail(`Unknown argument: ${arg}`);
  }
  if (opts.help) return opts;
  if (!["local", "staging", "production"].includes(opts.target)) {
    fail("--target is required and must be one of: local, staging, production.");
  }
  if (opts.target === "production" && !opts.prodAck) {
    fail("Refusing --target production without --i-know-this-is-production (applies to dry runs too).");
  }
  if (opts.prodAck && opts.target !== "production") {
    fail("--i-know-this-is-production only makes sense with --target production.");
  }
  if (opts.target === "local") {
    if (!opts.dest) fail("--target local requires --dest <data dir> (a directory different from --source).");
    if (path.resolve(opts.dest) === path.resolve(opts.source)) fail("--dest must differ from --source.");
  } else if (opts.dest) {
    fail("--dest is only valid with --target local.");
  }
  if ((opts.expectHost || opts.confirmSite) && opts.target === "local") {
    fail("--expect-host / --confirm-site only apply to --target staging or production.");
  }
  if (opts.scrubWorkspace && opts.workspaceAsIs) {
    fail("Choose only one of --scrub-workspace and --workspace-as-is.");
  }
  opts.groups = selectGroups(opts);
  const workspaceIn = opts.groups.includes("workspace");
  if (workspaceIn && !opts.scrubWorkspace && !opts.workspaceAsIs) {
    fail(
      "The workspace is included: choose --scrub-workspace (strip intakeProjects, conversion events and deployment records) " +
        "or --workspace-as-is (copy verbatim)."
    );
  }
  if (!workspaceIn && (opts.scrubWorkspace || opts.workspaceAsIs)) {
    fail("--scrub-workspace / --workspace-as-is only make sense when the workspace is selected (--only ...,workspace).");
  }
  return opts;
}

export function selectGroups(opts) {
  const base = opts.only ? opts.only : DEFAULT_GROUPS;
  return GROUPS.filter((group) => base.includes(group) && !opts.exclude.includes(group));
}

/** True when a baseline was captured from a local-dev / demo site rather than a real production site. */
export function isDemoOrigin(origin) {
  if (typeof origin !== "string" || !origin) return false;
  let url;
  try {
    url = new URL(origin);
  } catch {
    return /127\.0\.0\.1|localhost|\/demo\//i.test(origin);
  }
  const host = url.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "0.0.0.0" ||
    host === "[::1]" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    url.pathname.toLowerCase().includes("/demo/")
  );
}

/** Remove test intake data from a workspace copy. Pure; returns a new object and what was removed. */
export function scrubWorkspace(workspace) {
  const copy = structuredClone(workspace);
  const removed = {
    intakeProjects: Array.isArray(copy.intakeProjects) ? copy.intakeProjects.length : 0,
    conversionEvents: Array.isArray(copy.conversions?.events) ? copy.conversions.events.length : 0,
    deployments: Array.isArray(copy.deployments) ? copy.deployments.length : 0,
  };
  copy.intakeProjects = [];
  if (copy.conversions && typeof copy.conversions === "object") copy.conversions.events = [];
  copy.deployments = [];
  return { value: copy, removed };
}

async function listFiles(dir) {
  try {
    const names = await readdir(dir);
    const out = [];
    for (const name of names.sort()) {
      const info = await stat(path.join(dir, name));
      if (info.isFile()) out.push(name);
    }
    return out;
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

const sha = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 12);

/**
 * Build {items, skipped, problems} from the source directory.
 * items: what would be written. skipped: [{key, reason}] filtered out on purpose (not problems).
 */
export async function collect(sourceDir, options = {}) {
  const groups = options.groups || DEFAULT_GROUPS;
  const includeDemo = Boolean(options.includeDemo);
  const root = path.join(sourceDir, "factory");
  const items = [];
  const skipped = [];
  const problems = [];

  const wsFile = path.join(root, "workspace.json");
  if (!groups.includes("workspace")) {
    try {
      await stat(wsFile);
      skipped.push({ key: "factory/workspace", reason: "workspace not selected (use --only ...,workspace to include)" });
    } catch {
      /* no workspace file: nothing to report */
    }
  } else {
    try {
      const raw = await readFile(wsFile);
      const parsed = JSON.parse(raw.toString("utf8"));
      if (parsed?.project?.id !== FACTORY_PROJECT_ID) {
        problems.push(`workspace.json has unexpected project id; skipped.`);
      } else {
        let value = parsed;
        let scrubNote = "verbatim";
        if (options.scrubWorkspace) {
          const scrubbed = scrubWorkspace(parsed);
          value = scrubbed.value;
          scrubNote =
            `SCRUBBED (removed intakeProjects=${scrubbed.removed.intakeProjects} ` +
            `events=${scrubbed.removed.conversionEvents} deployments=${scrubbed.removed.deployments})`;
        }
        items.push({
          group: "workspace",
          key: "factory/workspace",
          kind: "json",
          value,
          size: Buffer.byteLength(JSON.stringify(value)),
          hash: sha(JSON.stringify(value)),
          note:
            `${scrubNote} briefs=${value.briefs?.length ?? 0} pages=${value.pages?.length ?? 0} ` +
            `intakeProjects=${value.intakeProjects?.length ?? 0} events=${value.conversions?.events?.length ?? 0} ` +
            `deployments=${value.deployments?.length ?? 0} screenshots=${value.screenshots?.length ?? 0}`,
        });
      }
    } catch (err) {
      if (err.code !== "ENOENT") problems.push(`workspace.json unreadable: ${err.message}`);
    }
  }

  for (const [sub, prefix] of [
    ["baselines", "factory/baselines/"],
    ["checklists", "factory/checklists/"],
  ]) {
    for (const name of await listFiles(path.join(root, sub))) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -5);
      const key = `${prefix}${id}`;
      if (!KEY_PATTERN.test(key)) {
        problems.push(`${sub}/${name}: unsafe name; skipped.`);
        continue;
      }
      if (!groups.includes(sub)) {
        skipped.push({ key, reason: `group "${sub}" not selected` });
        continue;
      }
      try {
        const raw = await readFile(path.join(root, sub, name));
        const parsed = JSON.parse(raw.toString("utf8"));
        if (sub === "baselines" && !includeDemo && isDemoOrigin(parsed.origin)) {
          skipped.push({ key, reason: `demo/local baseline (origin=${parsed.origin}); use --include-demo-baselines to copy` });
          continue;
        }
        const note =
          sub === "baselines"
            ? `origin=${parsed.origin ?? "?"} capturedAt=${parsed.capturedAt ?? "?"} pages=${parsed.pageInventory?.length ?? 0}`
            : `project=${parsed.projectId ?? "?"} sections=${parsed.sections?.length ?? 0}`;
        items.push({ group: sub, key, kind: "json", value: parsed, size: raw.length, hash: sha(raw), note });
      } catch (err) {
        problems.push(`${sub}/${name}: ${err.message}`);
      }
    }
  }

  for (const name of await listFiles(path.join(root, "screenshots"))) {
    const type = IMAGE_TYPES[path.extname(name).toLowerCase()];
    if (!type) continue; // .gitkeep etc.
    const key = `factory/screenshots/${name}`;
    if (!KEY_PATTERN.test(key)) {
      problems.push(`screenshots/${name}: unsafe name; skipped.`);
      continue;
    }
    if (!groups.includes("screenshots")) {
      skipped.push({ key, reason: 'group "screenshots" not selected' });
      continue;
    }
    const bytes = await readFile(path.join(root, "screenshots", name));
    items.push({ group: "screenshots", key, kind: "binary", bytes, contentType: type, size: bytes.length, hash: sha(bytes), note: type });
  }
  return { items, skipped, problems };
}

function hostOf(value) {
  if (typeof value !== "string" || !value) return "";
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Ask Netlify which site this id is and refuse unless it is the site we expect.
 * Rules: the API must return the same id; --expect-host must be one of the site's hosts
 * (ssl_url, url, custom_domain, domain_aliases, <name>.netlify.app); a staging target requires a
 * test.* host; a production target refuses a site that has any test./staging. host.
 * The token is only sent as an Authorization header and never appears in a message.
 */
export async function verifySite({ siteId, expectHost, target, token, fetchImpl = globalThis.fetch }) {
  if (!siteId) fail("verifySite: site id is required.");
  if (!expectHost) fail("verifySite: --expect-host is required for staging/production apply.");
  if (!["staging", "production"].includes(target)) fail("verifySite: target must be staging or production.");
  const isTestHost = (host) => host.startsWith("test.") || host.startsWith("staging.");
  if (target === "staging" && !expectHost.startsWith("test.")) {
    fail(`--target staging requires --expect-host to start with "test." (got "${expectHost}").`);
  }
  if (target === "production" && isTestHost(expectHost)) {
    fail(`--target production cannot use a test host ("${expectHost}").`);
  }
  let res;
  try {
    res = await fetchImpl(`${NETLIFY_API}/sites/${encodeURIComponent(siteId)}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      redirect: "error",
    });
  } catch (err) {
    fail(`Could not reach the Netlify API to verify the site (${err instanceof Error ? err.name : "error"}). Nothing was written.`);
  }
  if (!res.ok) {
    fail(`Netlify API refused the site lookup (HTTP ${res.status}). Check the site id and token. Nothing was written.`);
  }
  let site;
  try {
    site = await res.json();
  } catch {
    fail("Netlify API returned an unreadable response. Nothing was written.");
  }
  if (!site || site.id !== siteId) {
    fail("Netlify API returned a different site id than requested. Nothing was written.");
  }
  const hosts = new Set(
    [
      hostOf(site.ssl_url),
      hostOf(site.url),
      hostOf(site.custom_domain),
      ...(Array.isArray(site.domain_aliases) ? site.domain_aliases.map(hostOf) : []),
      site.name ? `${String(site.name).toLowerCase()}.netlify.app` : "",
    ].filter(Boolean)
  );
  const name = String(site.name || "?");
  if (!hosts.has(expectHost)) {
    fail(`Site ${siteId} ("${name}") does not serve ${expectHost} (its hosts: ${[...hosts].join(", ") || "none"}). Refusing.`);
  }
  const hostList = [...hosts];
  if (target === "staging" && !hostList.some((host) => host === expectHost && host.startsWith("test."))) {
    fail(`Site ${siteId} ("${name}") is not a test.* site; refusing --target staging.`);
  }
  if (target === "production" && hostList.some(isTestHost)) {
    fail(`Site ${siteId} ("${name}") has a test./staging. host (${hostList.filter(isTestHost).join(", ")}); refusing --target production.`);
  }
  return { name, hosts: hostList };
}

/** Target adapters: put(item, {overwrite}) -> "written" | "exists", verify(item). */
async function localTarget(destDir) {
  const fileFor = (item) => path.join(destDir, item.kind === "json" ? `${item.key}.json` : item.key);
  return {
    label: `local directory ${path.resolve(destDir)}`,
    async put(item, { overwrite }) {
      const file = fileFor(item);
      let exists = true;
      try {
        await stat(file);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
        exists = false;
      }
      if (exists && !overwrite) return "exists";
      await mkdir(path.dirname(file), { recursive: true });
      if (item.kind === "json") await writeFile(file, `${JSON.stringify(item.value, null, 2)}\n`, "utf8");
      else await writeFile(file, item.bytes);
      return "written";
    },
    async verify(item) {
      const back = await readFile(fileFor(item));
      if (item.kind === "binary") return sha(back) === item.hash;
      return JSON.stringify(JSON.parse(back.toString("utf8"))) === JSON.stringify(item.value);
    },
  };
}

async function blobsTarget(opts) {
  const siteID = opts.siteId || process.env.NETLIFY_SITE_ID || "";
  const token = process.env.NETLIFY_AUTH_TOKEN || "";
  if (!siteID) fail("Apply to staging/production needs --site-id <id> (or env NETLIFY_SITE_ID).");
  if (!token) fail("Apply to staging/production needs env NETLIFY_AUTH_TOKEN (never passed on the command line).");
  if (!opts.expectHost) fail("Apply to staging/production needs --expect-host <host> (e.g. test.sitesinc.co or sitesinc.co).");
  if (opts.confirmSite !== siteID) fail("Apply to staging/production needs --confirm-site <id> equal to the site id.");
  const site = await verifySite({ siteId: siteID, expectHost: opts.expectHost, target: opts.target, token });
  console.log(`Verified site ${siteID}: "${site.name}" serves ${opts.expectHost} (hosts: ${site.hosts.join(", ")}).`);
  const { getStore } = await import("@netlify/blobs");
  const name = STORE_NAMES[opts.target];
  const store = getStore({ name, siteID, token, consistency: "strong" });
  return {
    label: `Netlify Blobs store "${name}" on site "${site.name}"`,
    async put(item, { overwrite }) {
      const cond = overwrite ? undefined : { onlyIfNew: true };
      const result =
        item.kind === "json"
          ? await store.setJSON(item.key, item.value, cond)
          : await store.set(item.key, new Uint8Array(item.bytes).buffer, {
              metadata: { contentType: item.contentType },
              ...(cond || {}),
            });
      return result.modified ? "written" : "exists";
    },
    async verify(item) {
      if (item.kind === "json") {
        const back = await store.get(item.key, { type: "json" });
        return JSON.stringify(back) === JSON.stringify(item.value);
      }
      const back = await store.get(item.key, { type: "arrayBuffer" });
      return Boolean(back) && sha(Buffer.from(back)) === item.hash;
    },
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log("See the header comment of scripts/migrate-factory-state.mjs for usage.");
    return 0;
  }
  const { items, skipped, problems } = await collect(opts.source, opts);

  console.log(`Factory state migration: ${opts.apply ? "APPLY" : "DRY RUN (no writes)"}`);
  console.log(`  source : ${path.resolve(opts.source)}`);
  console.log(`  target : ${opts.target}${opts.target === "local" ? ` (${path.resolve(opts.dest)})` : ` (store ${STORE_NAMES[opts.target]})`}`);
  console.log(`  groups : ${opts.groups.join(", ") || "(none)"}${opts.only ? "" : "  [default: workspace NOT included]"}`);
  console.log(`  demo baselines : ${opts.includeDemo ? "INCLUDED" : "excluded (default)"}`);
  console.log(`  mode   : ${opts.overwrite ? "OVERWRITE existing keys" : "create-only (existing keys are skipped)"}`);
  console.log("");
  for (const item of items) {
    console.log(`  ${item.kind.padEnd(6)} ${item.key}  ${item.size}B sha:${item.hash}  ${item.note}`);
  }
  for (const row of skipped) console.log(`  SKIP   ${row.key}  (${row.reason})`);
  for (const problem of problems) console.log(`  PROBLEM ${problem}`);
  const bytes = items.reduce((sum, item) => sum + item.size, 0);
  const counts = GROUPS.map((group) => `${group}=${items.filter((item) => item.group === group).length}`).join(" ");
  console.log(`\n${items.length} item(s) to write (${counts}), ${bytes} bytes, ${skipped.length} filtered out, ${problems.length} problem(s).`);

  if (items.length === 0) {
    console.log("Nothing to migrate.");
    return problems.length ? 1 : 0;
  }
  if (!opts.apply) {
    console.log("\nDRY RUN: nothing was written. Re-run with --apply to write these keys.");
    if (opts.target !== "local") {
      console.log("Apply to staging/production will also require --site-id, --expect-host, --confirm-site and env NETLIFY_AUTH_TOKEN.");
    }
    return problems.length ? 1 : 0;
  }
  if (problems.length) fail("Refusing to apply while source problems exist; fix or remove them first.");

  const adapter = opts.target === "local" ? await localTarget(opts.dest) : await blobsTarget(opts);
  console.log(`\nWriting to ${adapter.label} ...`);
  let written = 0;
  let skippedExisting = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const outcome = await adapter.put(item, { overwrite: opts.overwrite });
      if (outcome === "exists") {
        skippedExisting += 1;
        console.log(`  exists, skipped  ${item.key}`);
        continue;
      }
      const ok = await adapter.verify(item);
      if (!ok) throw new Error("read-back verification mismatch");
      written += 1;
      console.log(`  written+verified ${item.key}`);
    } catch (err) {
      failed += 1;
      console.error(`  FAILED ${item.key}: ${err instanceof Error ? err.message : "unknown"}`);
    }
  }
  console.log(`\nDone: ${written} written, ${skippedExisting} skipped (already present), ${failed} failed.`);
  if (!opts.groups.includes("workspace")) {
    console.log("Note: no workspace was migrated. Initialize the store once so the intake mirror works: POST /api/factory/action {\"op\":\"init-workspace\"}.");
  }
  return failed ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      if (err instanceof UsageError) {
        console.error(`ERROR: ${err.message}`);
        process.exit(2);
      }
      console.error(`ERROR: ${err instanceof Error ? err.message : "unknown"}`);
      process.exit(1);
    }
  );
}
