/**
 * Build-time public production release snapshot.
 *
 * Writes lib/generated/production-release.json from Netlify COMMIT_REF only when
 * this is the live sitesyncllc production publish. Preview, branch, staging, and
 * local builds keep the committed stub (`present: false`) so /release.json 404s.
 *
 * Never reads request-time env. Never writes secrets or operational data.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRODUCTION_COMMIT_RE, PRODUCTION_RELEASE_SCHEMA, PRODUCTION_RELEASE_SITE, PRODUCTION_SITE_ID } from "./lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const GENERATED_RELEASE_PATH = path.join(ROOT, "lib", "generated", "production-release.json");

export const STUB_RELEASE = {
  schema: PRODUCTION_RELEASE_SCHEMA,
  present: false,
};

export function isNetlifyProductionPublish(env = process.env) {
  const netlify = String(env.NETLIFY || "").toLowerCase() === "true";
  const context = String(env.CONTEXT || "").trim();
  const siteId = String(env.SITE_ID || env.NETLIFY_SITE_ID || "").trim().toLowerCase();
  const siteEnv = String(env.NEXT_PUBLIC_SITE_ENV || env.SITE_ENV || "").trim().toLowerCase();
  return netlify && context === "production" && siteId === PRODUCTION_SITE_ID && siteEnv !== "staging";
}

export function productionReleaseFromEnv(env = process.env, { now = new Date() } = {}) {
  if (!isNetlifyProductionPublish(env)) return { ...STUB_RELEASE };
  const commit = String(env.COMMIT_REF || "").trim().toLowerCase();
  if (!PRODUCTION_COMMIT_RE.test(commit)) {
    const err = new Error("Production Netlify build requires COMMIT_REF as a 40-character git SHA. Refusing to publish without release metadata.");
    err.code = "invalid_commit_ref";
    throw err;
  }
  const publishedAt = now.toISOString();
  return {
    schema: PRODUCTION_RELEASE_SCHEMA,
    present: true,
    commit,
    context: "production",
    site: PRODUCTION_RELEASE_SITE,
    publishedAt,
  };
}

export function writeProductionReleaseManifest(filePath = GENERATED_RELEASE_PATH, env = process.env, extra = {}) {
  const body = productionReleaseFromEnv(env, extra);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  return { filePath, body };
}

function main() {
  const result = writeProductionReleaseManifest();
  if (result.body.present) {
    console.log(`Wrote production release metadata for ${result.body.commit}`);
  } else {
    console.log("Not a sitesyncllc production publish; /release.json will 404.");
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : "unknown");
    process.exit(1);
  }
}
