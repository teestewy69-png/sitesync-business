#!/usr/bin/env node
// Load a client's own content (page copy, images, artwork list) into an existing client project through the
// factory's own endpoints: POST /api/factory/login, /api/factory/action and /api/factory/client-assets.
// Never touches the store directly. Dry run by default: nothing is sent without --apply.
//
//   node scripts/import-client-content.mjs --content kurtis-content.json --images ./public          (dry run)
//   node scripts/import-client-content.mjs --content kurtis-content.json --images ./public \
//        --base https://test.sitesinc.co --token-file /path/to/factory-token --apply
//
// The token is read from --token-file (or FACTORY_TOKEN_FILE) and is never printed. Production hosts
// (sitesinc.co) are refused unless --allow-production is passed as well.
//
// Content JSON:
// {
//   "projectId": "proj_...",
//   "details": { "offer": "...", "city": "...", ... },          // optional, update-client-config fields
//   "pages": { "about": { "title": "...", "body": "..." } },    // optional, per-page client copy
//   "images": [ { "key": "crystal-ball", "file": "works/crystal-ball.jpg", "alt": "...", "role": "work" } ],
//   "artworks": [ { "title": "...", "series": "...", "medium": "...", "year": "...", "size": "...",
//                   "availability": "unknown", "image": "crystal-ball", "featured": true } ]
// }
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_IMAGE_BYTES = 4_000_000; // same limit as lib/factory/client-content.ts
const ROLES = new Set(["work", "artist-photo", "logo", "other"]);
const AVAILABILITY = new Set(["available", "reserved", "sold", "private_collection", "not_for_sale", "unknown"]);
const DETAIL_FIELDS = new Set([
  "businessName", "contactName", "email", "phone", "city", "state", "businessType", "offer", "niche",
  "primaryGoal", "domain", "notes", "pricingNote",
]);
const PRODUCTION_HOSTS = new Set(["sitesinc.co", "www.sitesinc.co"]);

export function sniffImage(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 12 && bytes.toString("latin1", 0, 4) === "RIFF" && bytes.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/**
 * Validate a content JSON + image folder and return what would be sent. Pure apart from reading the image files.
 * Errors block an import; warnings do not.
 */
export function buildImportPlan(content, { imagesDir }) {
  const errors = [];
  const warnings = [];
  if (!content || typeof content !== "object") return { errors: ["Content must be a JSON object."], warnings, uploads: [], artworks: [], pages: [], details: null };
  const projectId = String(content.projectId || "");
  if (!/^[a-z0-9_-]{1,80}$/i.test(projectId)) errors.push("projectId is missing or invalid.");

  let details = null;
  if (content.details && typeof content.details === "object") {
    details = {};
    for (const [key, value] of Object.entries(content.details)) {
      if (!DETAIL_FIELDS.has(key)) {
        errors.push(`details.${key} is not a client detail field.`);
        continue;
      }
      details[key] = String(value ?? "");
    }
    if (!Object.keys(details).length) details = null;
  }

  const uploads = [];
  const keys = new Set();
  for (const [index, image] of (Array.isArray(content.images) ? content.images : []).entries()) {
    const label = `images[${index}]${image?.key ? ` (${image.key})` : ""}`;
    const key = String(image?.key || "").trim();
    const file = String(image?.file || "").trim();
    const alt = String(image?.alt || "").replace(/\s+/g, " ").trim();
    const role = String(image?.role || "work");
    if (!key || keys.has(key)) {
      errors.push(`${label}: key is missing or duplicated.`);
      continue;
    }
    keys.add(key);
    if (!alt) errors.push(`${label}: alt text is required.`);
    if (!ROLES.has(role)) errors.push(`${label}: role must be one of ${[...ROLES].join(", ")}.`);
    if (!file || path.isAbsolute(file) || file.split(/[\\/]/).includes("..")) {
      errors.push(`${label}: file must be a relative path inside the images folder.`);
      continue;
    }
    const full = path.join(imagesDir || ".", ...file.split(/[\\/]/));
    let bytes;
    try {
      const size = statSync(full).size;
      if (size > MAX_IMAGE_BYTES) {
        errors.push(`${label}: ${file} is too big (${(size / 1e6).toFixed(1)} MB; limit ${MAX_IMAGE_BYTES / 1e6} MB).`);
        continue;
      }
      bytes = readFileSync(full);
    } catch {
      errors.push(`${label}: ${file} not found in the images folder.`);
      continue;
    }
    const type = sniffImage(bytes);
    if (!type) {
      errors.push(`${label}: ${file} is not a JPEG, PNG or WebP image.`);
      continue;
    }
    uploads.push({ key, file, path: full, alt, role, type, bytes: bytes.length });
  }

  const artworks = [];
  for (const [index, work] of (Array.isArray(content.artworks) ? content.artworks : []).entries()) {
    const label = `artworks[${index}]${work?.title ? ` (${work.title})` : ""}`;
    if (!work || typeof work !== "object") {
      errors.push(`${label}: not an object.`);
      continue;
    }
    if ("price" in work && String(work.price ?? "").trim()) {
      warnings.push(`${label}: price left out (the importer never sends prices; set them in the factory only when the pricing note allows).`);
    }
    if (work.availability && !AVAILABILITY.has(String(work.availability))) {
      errors.push(`${label}: availability must be one of ${[...AVAILABILITY].join(", ")}.`);
    }
    if (work.image && !keys.has(String(work.image))) errors.push(`${label}: image "${work.image}" is not in images[].`);
    const out = {};
    for (const field of ["id", "title", "series", "medium", "year", "size", "availability"]) {
      const value = String(work[field] ?? "").trim();
      if (value) out[field] = value;
    }
    if (work.featured === true) out.featured = true;
    if (work.image) out.image = String(work.image);
    if (!out.title && !out.image) {
      warnings.push(`${label}: skipped (no title and no image).`);
      continue;
    }
    artworks.push(out);
  }

  const pages = [];
  for (const [slug, page] of Object.entries(content.pages && typeof content.pages === "object" ? content.pages : {})) {
    const body = String(page?.body || "").trim();
    if (!/^[a-z0-9-]{1,60}$/.test(slug)) errors.push(`pages.${slug}: invalid page slug.`);
    else if (!body) errors.push(`pages.${slug}: body is empty.`);
    else {
      if (/\$\s?\d/.test(body)) errors.push(`pages.${slug}: contains a price ("$" amount); the importer never sends prices.`);
      pages.push({ slug, title: String(page?.title || "").trim(), metaDescription: String(page?.metaDescription || "").trim(), body });
    }
  }

  return { projectId, errors, warnings, uploads, artworks, pages, details };
}

function parseArgs(argv) {
  const args = { apply: false, allowProduction: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--apply") args.apply = true;
    else if (a === "--allow-production") args.allowProduction = true;
    else if (a.startsWith("--")) args[a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.content) {
    console.error("Usage: node scripts/import-client-content.mjs --content <file.json> --images <dir> [--base <url> --token-file <file> --apply]");
    process.exit(2);
  }
  const content = JSON.parse(readFileSync(args.content, "utf8"));
  const imagesDir = args.images || path.dirname(path.resolve(args.content));
  const plan = buildImportPlan(content, { imagesDir });
  console.log(`Project ${plan.projectId}: ${plan.uploads.length} image(s), ${plan.artworks.length} work(s), ${plan.pages.length} page(s) of copy${plan.details ? `, details: ${Object.keys(plan.details).join(", ")}` : ""}.`);
  for (const w of plan.warnings) console.log(`warning: ${w}`);
  for (const e of plan.errors) console.log(`error: ${e}`);
  if (plan.errors.length) process.exit(1);
  if (!args.apply) {
    for (const u of plan.uploads) console.log(`  image ${u.key}: ${u.file} (${u.type}, ${Math.round(u.bytes / 1000)} KB, role ${u.role})`);
    for (const p of plan.pages) console.log(`  page ${p.slug}: ${p.body.length} chars`);
    console.log("Dry run only. Nothing was sent. Add --base, --token-file and --apply to import.");
    return;
  }

  const base = String(args.base || "").replace(/\/+$/, "");
  let host = "";
  try {
    host = new URL(base).hostname.toLowerCase();
  } catch {
    console.error("--base must be a full URL such as https://test.sitesinc.co");
    process.exit(2);
  }
  if (PRODUCTION_HOSTS.has(host) && !args.allowProduction) {
    console.error(`Refusing to import into production (${host}) without --allow-production.`);
    process.exit(2);
  }
  const tokenFile = args.tokenFile || process.env.FACTORY_TOKEN_FILE;
  if (!tokenFile) {
    console.error("--token-file (or FACTORY_TOKEN_FILE) is required with --apply.");
    process.exit(2);
  }
  const password = readFileSync(tokenFile, "utf8").trim();
  const login = await fetch(`${base}/api/factory/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const cookie = (login.headers.getSetCookie?.() || [login.headers.get("set-cookie") || ""]).map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  if (!login.ok || !cookie) {
    console.error(`Login failed (HTTP ${login.status}).`);
    process.exit(1);
  }
  const act = async (payload) => {
    const res = await fetch(`${base}/api/factory/action`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ projectId: plan.projectId, hostOrigin: base, approvedBy: "import-client-content", ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(`${payload.op}: HTTP ${res.status} ${data.error || ""}`.trim());
    return data;
  };

  if (plan.details) {
    await act({ op: "update-client-config", ...plan.details });
    console.log(`details saved (${Object.keys(plan.details).join(", ")})`);
  }
  const ids = {};
  for (const u of plan.uploads) {
    const form = new FormData();
    form.append("projectId", plan.projectId);
    form.append("alt", u.alt);
    form.append("role", u.role);
    form.append("approvedBy", "import-client-content");
    form.append("file", new Blob([readFileSync(u.path)], { type: u.type }), path.basename(u.file));
    const res = await fetch(`${base}/api/factory/client-assets`, { method: "POST", headers: { cookie }, body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(`upload ${u.file}: HTTP ${res.status} ${data.error || ""}`.trim());
    ids[u.key] = data.asset.id;
    console.log(`image ${u.key} -> ${data.asset.id}${data.deduped ? " (already uploaded)" : ""}`);
  }
  const steps = [];
  if (plan.artworks.length) {
    steps.push({
      label: `artworks (${plan.artworks.length})`,
      payload: {
        op: "set-client-artworks",
        artworks: plan.artworks.map(({ image, ...work }) => (image ? { ...work, imageId: ids[image] } : work)),
      },
    });
  }
  for (const p of plan.pages) {
    steps.push({ label: `page ${p.slug}`, payload: { op: "set-client-page-copy", slug: p.slug, body: p.body, title: p.title, metaDescription: p.metaDescription } });
  }
  for (const [i, step] of steps.entries()) {
    // One preview recapture at the end instead of one per step.
    const data = await act({ ...step.payload, deferRecapture: i < steps.length - 1 });
    console.log(`${step.label} saved${data.warnings?.length ? ` (${data.warnings.join(" ")})` : ""}`);
  }
  console.log("Import done. Pages stay drafts (ready_for_review, noindex) until approved. Nothing was published.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
