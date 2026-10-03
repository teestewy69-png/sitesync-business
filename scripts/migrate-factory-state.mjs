#!/usr/bin/env node
/**
 * Copy the git-ignored local factory/SEO state (data/factory/**) into a durable target store.
 *
 *   node scripts/migrate-factory-state.mjs --target <local|staging|production> [options]
 *
 * SAFE BY DEFAULT
 *   - DRY RUN unless --apply is passed. A dry run reads local files only: no network, no writes,
 *     no credentials needed. It prints exactly which keys would be written.
 *   - --target is required (there is no default).
 *   - --target production is refused unless --i-know-this-is-production is ALSO passed (even for a dry run).
 *   - Existing keys in the target are NEVER overwritten unless --overwrite is passed
 *     (create-only writes; already-present keys are reported as "exists, skipped").
 *   - Nothing is ever deleted. The source files are only read.
 *
 * Options
 *   --source <dir>   data directory to read (default ./data; expects <dir>/factory/...)
 *   --dest <dir>     REQUIRED for --target local: data directory to write into (must differ from --source)
 *   --site-id <id>   Netlify site id for staging/production (or env NETLIFY_SITE_ID). Apply only.
 *   --overwrite      replace keys that already exist in the target
 *   --apply          actually write (otherwise dry run)
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
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE_NAMES = { staging: "sitesinc-crm-staging", production: "sitesinc-crm" };
const FACTORY_PROJECT_ID = "sitesinc-growth-case-study";
const KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]*(\/[a-z0-9][a-z0-9_.-]*)*$/i;
const IMAGE_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function fail(message, code = 2) {
  console.error(`ERROR: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const opts = { apply: false, overwrite: false, prodAck: false, source: "data", dest: "", target: "", siteId: "" };
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
    else if (arg === "--target") opts.target = value();
    else if (arg === "--source") opts.source = value();
    else if (arg === "--dest") opts.dest = value();
    else if (arg === "--site-id") opts.siteId = value();
    else if (arg === "--help" || arg === "-h") {
      console.log("See the header comment of scripts/migrate-factory-state.mjs for usage.");
      process.exit(0);
    } else fail(`Unknown argument: ${arg}`);
  }
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
  return opts;
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

/** Build the list of {key, kind, bytes, note} items from the source directory. */
async function collect(sourceDir) {
  const root = path.join(sourceDir, "factory");
  const items = [];
  const problems = [];

  const wsFile = path.join(root, "workspace.json");
  try {
    const raw = await readFile(wsFile);
    const parsed = JSON.parse(raw.toString("utf8"));
    if (parsed?.project?.id !== FACTORY_PROJECT_ID) {
      problems.push(`workspace.json has unexpected project id; skipped.`);
    } else {
      items.push({
        key: "factory/workspace",
        kind: "json",
        value: parsed,
        size: raw.length,
        hash: sha(raw),
        note:
          `briefs=${parsed.briefs?.length ?? 0} pages=${parsed.pages?.length ?? 0} ` +
          `intakeProjects=${parsed.intakeProjects?.length ?? 0} events=${parsed.conversions?.events?.length ?? 0} ` +
          `screenshots=${parsed.screenshots?.length ?? 0}`,
      });
    }
  } catch (err) {
    if (err.code !== "ENOENT") problems.push(`workspace.json unreadable: ${err.message}`);
  }

  for (const [sub, prefix] of [["baselines", "factory/baselines/"], ["checklists", "factory/checklists/"]]) {
    for (const name of await listFiles(path.join(root, sub))) {
      if (!name.endsWith(".json")) continue;
      const id = name.slice(0, -5);
      const key = `${prefix}${id}`;
      if (!KEY_PATTERN.test(key)) {
        problems.push(`${sub}/${name}: unsafe name; skipped.`);
        continue;
      }
      try {
        const raw = await readFile(path.join(root, sub, name));
        const parsed = JSON.parse(raw.toString("utf8"));
        const note =
          sub === "baselines"
            ? `origin=${parsed.origin ?? "?"} capturedAt=${parsed.capturedAt ?? "?"} pages=${parsed.pageInventory?.length ?? 0}`
            : `project=${parsed.projectId ?? "?"} sections=${parsed.sections?.length ?? 0}`;
        items.push({ key, kind: "json", value: parsed, size: raw.length, hash: sha(raw), note });
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
    const bytes = await readFile(path.join(root, "screenshots", name));
    items.push({ key, kind: "binary", bytes, contentType: type, size: bytes.length, hash: sha(bytes), note: type });
  }
  return { items, problems };
}

/** Target adapters: exists(key), put(item, {overwrite}) -> "written" | "exists", readBackHash(item). */
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

async function blobsTarget(target, siteIdArg) {
  const siteID = siteIdArg || process.env.NETLIFY_SITE_ID || "";
  const token = process.env.NETLIFY_AUTH_TOKEN || "";
  if (!siteID) fail("Apply to staging/production needs --site-id <id> (or env NETLIFY_SITE_ID).");
  if (!token) fail("Apply to staging/production needs env NETLIFY_AUTH_TOKEN (never passed on the command line).");
  const { getStore } = await import("@netlify/blobs");
  const name = STORE_NAMES[target];
  const store = getStore({ name, siteID, token, consistency: "strong" });
  return {
    label: `Netlify Blobs store "${name}" on the given site id`,
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
  const { items, problems } = await collect(opts.source);

  console.log(`Factory state migration: ${opts.apply ? "APPLY" : "DRY RUN (no writes)"}`);
  console.log(`  source : ${path.resolve(opts.source)}`);
  console.log(`  target : ${opts.target}${opts.target === "local" ? ` (${path.resolve(opts.dest)})` : ` (store ${STORE_NAMES[opts.target]})`}`);
  console.log(`  mode   : ${opts.overwrite ? "OVERWRITE existing keys" : "create-only (existing keys are skipped)"}`);
  console.log("");
  for (const item of items) {
    console.log(`  ${item.kind.padEnd(6)} ${item.key}  ${item.size}B sha:${item.hash}  ${item.note}`);
  }
  for (const problem of problems) console.log(`  PROBLEM ${problem}`);
  const bytes = items.reduce((sum, item) => sum + item.size, 0);
  console.log(`\n${items.length} item(s), ${bytes} bytes, ${problems.length} problem(s).`);

  if (items.length === 0) {
    console.log("Nothing to migrate.");
    process.exit(problems.length ? 1 : 0);
  }
  if (!opts.apply) {
    console.log("\nDRY RUN: nothing was written. Re-run with --apply to write these keys.");
    process.exit(problems.length ? 1 : 0);
  }
  if (problems.length) fail("Refusing to apply while source problems exist; fix or remove them first.", 1);

  const adapter = opts.target === "local" ? await localTarget(opts.dest) : await blobsTarget(opts.target, opts.siteId);
  console.log(`\nWriting to ${adapter.label} ...`);
  let written = 0;
  let skipped = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const outcome = await adapter.put(item, { overwrite: opts.overwrite });
      if (outcome === "exists") {
        skipped += 1;
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
  console.log(`\nDone: ${written} written, ${skipped} skipped (already present), ${failed} failed.`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`ERROR: ${err instanceof Error ? err.message : "unknown"}`);
  process.exit(1);
});
