#!/usr/bin/env node
// SiteFlow → Stripe catalog sync. Source of truth: data/products.ts.
//
//   node scripts/siteflow/stripe-sync.mjs              dry run (prints the plan; no writes)
//   node scripts/siteflow/stripe-sync.mjs --apply      create/update products + prices
//   add --allow-live to touch a LIVE account (refused by default)
//
// Reads STRIPE_SECRET_KEY from the environment (or .env.local). The key is never printed.
// Without a key it prints an offline plan from the catalog only.
//
// Per priced, non-retired, non-contact-only entry with a stripeLookupKey:
//   product  id `sitesinc_<slug>` (deterministic, GET first): created, or name/description updated
//   price    looked up by lookup key: kept when amount/currency/interval match, otherwise a new price is
//            created with the same lookup key (transfer_lookup_key=true) and the old price is deactivated
// Then writes data/siteflow/stripe-status.json (source "sync-script") for the /app SiteFlow bay.
// Requires Node >= 22.18 (imports the TypeScript catalog with type stripping).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply");
const ALLOW_LIVE = args.has("--allow-live");

function envKey() {
  if (process.env.STRIPE_SECRET_KEY) return process.env.STRIPE_SECRET_KEY.trim();
  const file = path.join(ROOT, ".env.local");
  if (!existsSync(file)) return "";
  const line = readFileSync(file, "utf8")
    .split(/\r?\n/)
    .find((l) => /^\s*STRIPE_SECRET_KEY\s*=/.test(l));
  return line ? line.replace(/^\s*STRIPE_SECRET_KEY\s*=\s*/, "").replace(/^["']|["']$/g, "").trim() : "";
}

function keyMode(key) {
  if (!key) return "unset";
  if (/^(sk|rk)_test_/.test(key)) return "test";
  if (/^(sk|rk)_live_/.test(key)) return "live";
  return "invalid";
}

function encodeForm(params) {
  const out = new URLSearchParams();
  const walk = (prefix, value) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) return value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    if (typeof value === "object") return Object.entries(value).forEach(([k, v]) => walk(prefix ? `${prefix}[${k}]` : k, v));
    out.append(prefix, String(value));
  };
  Object.entries(params).forEach(([k, v]) => walk(k, v));
  return out;
}

const { catalog } = await import(new URL("../../data/products.ts", import.meta.url).href);
const key = envKey();
const mode = keyMode(key);

async function stripe(method, pathname, params, { idempotencyKey } = {}) {
  const url = new URL(`https://api.stripe.com${pathname}`);
  const init = { method, headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2025-08-27.basil" } };
  if (method === "GET" && params) url.search = encodeForm(params).toString();
  else if (params) {
    init.headers["Content-Type"] = "application/x-www-form-urlencoded";
    init.body = encodeForm(params).toString();
  }
  if (idempotencyKey) init.headers["Idempotency-Key"] = idempotencyKey;
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const plan = [];
const skipped = [];
for (const entry of catalog) {
  const reason = entry.retired
    ? "retired"
    : entry.contactOnly
      ? "contact-only (quote by email)"
      : entry.kind === "affiliate_out"
        ? "outbound affiliate link"
        : !entry.stripeLookupKey
          ? "no lookup key"
          : typeof entry.priceCents !== "number" || entry.priceCents <= 0
            ? "no price yet (Tony to decide)"
            : "";
  if (reason) skipped.push({ slug: entry.slug, reason });
  else plan.push(entry);
}

console.log(`SiteFlow Stripe sync · mode ${mode}${APPLY ? " · APPLY" : " · dry run"}`);
for (const s of skipped) console.log(`  skip  ${s.slug}: ${s.reason}`);

if (mode === "invalid") {
  console.error("STRIPE_SECRET_KEY is set but does not look like a Stripe secret/restricted key. Nothing done.");
  process.exit(1);
}
if (mode === "live" && !ALLOW_LIVE) {
  console.error("Refusing to touch a LIVE Stripe account. Use a test key, or pass --allow-live once Tony approves go-live.");
  process.exit(1);
}
if (mode === "unset") {
  console.log("No STRIPE_SECRET_KEY: offline plan only.");
  for (const e of plan) {
    console.log(`  plan  ${e.slug}: product sitesinc_${e.slug}, price ${e.priceCents}¢ usd${e.interval ? `/${e.interval}` : ""}, lookup ${e.stripeLookupKey}`);
  }
  process.exit(0);
}

const items = [];
let failures = 0;
for (const e of plan) {
  const productId = `sitesinc_${e.slug.replace(/[^a-z0-9_-]/gi, "_")}`;
  const want = { unit_amount: e.priceCents, currency: "usd", interval: e.kind === "subscription" ? e.interval || "month" : null };
  try {
    let product = null;
    try {
      product = await stripe("GET", `/v1/products/${productId}`);
    } catch (err) {
      if (err.status !== 404) throw err;
    }
    const description = e.description.slice(0, 1000);
    if (!product) {
      console.log(`  ${APPLY ? "create" : "would create"} product ${productId}`);
      if (APPLY) {
        product = await stripe("POST", "/v1/products", { id: productId, name: e.name, description, metadata: { slug: e.slug, siteflow: "1" } }, { idempotencyKey: `siteflow-product-${productId}` });
      }
    } else if (product.name !== e.name || (product.description || "") !== description || !product.active) {
      console.log(`  ${APPLY ? "update" : "would update"} product ${productId}`);
      if (APPLY) product = await stripe("POST", `/v1/products/${productId}`, { name: e.name, description, active: true });
    } else {
      console.log(`  ok    product ${productId}`);
    }

    const found = await stripe("GET", "/v1/prices", { lookup_keys: [e.stripeLookupKey], limit: 1 });
    const current = found.data?.[0];
    const matches =
      current &&
      current.active &&
      current.unit_amount === want.unit_amount &&
      current.currency === want.currency &&
      (current.recurring?.interval || null) === want.interval &&
      (typeof current.product === "string" ? current.product : current.product?.id) === productId;
    let priceId = current?.id;
    if (matches) {
      console.log(`  ok    price ${e.stripeLookupKey} = ${want.unit_amount}¢`);
    } else {
      console.log(
        `  ${APPLY ? "create" : "would create"} price ${e.stripeLookupKey} = ${want.unit_amount}¢${want.interval ? `/${want.interval}` : ""}` +
          (current ? ` (replacing ${current.unit_amount}¢, old price deactivated)` : "")
      );
      if (APPLY) {
        const created = await stripe(
          "POST",
          "/v1/prices",
          {
            product: productId,
            unit_amount: want.unit_amount,
            currency: want.currency,
            lookup_key: e.stripeLookupKey,
            transfer_lookup_key: true,
            metadata: { slug: e.slug, siteflow: "1" },
            ...(want.interval ? { recurring: { interval: want.interval } } : {}),
          },
          { idempotencyKey: `siteflow-price-${e.stripeLookupKey}-${want.unit_amount}-${want.interval || "once"}` }
        );
        if (current && current.id !== created.id && current.active) await stripe("POST", `/v1/prices/${current.id}`, { active: false });
        priceId = created.id;
      }
    }
    items.push({
      slug: e.slug,
      lookupKey: e.stripeLookupKey,
      catalogCents: e.priceCents,
      state: matches || APPLY ? "in_sync" : current ? "amount_mismatch" : "missing",
      ...(priceId && (matches || APPLY) ? { priceId } : {}),
      stripeCents: matches || APPLY ? want.unit_amount : current ? current.unit_amount : null,
    });
  } catch (err) {
    failures += 1;
    // Stripe error messages never contain the secret key; still keep them short.
    console.error(`  FAIL  ${e.slug}: ${String(err.message || err).slice(0, 200)}`);
    items.push({ slug: e.slug, lookupKey: e.stripeLookupKey, catalogCents: e.priceCents, state: "unchecked" });
  }
}
for (const s of skipped) {
  const entry = catalog.find((c) => c.slug === s.slug);
  if (entry?.stripeLookupKey && !entry.retired) items.push({ slug: s.slug, lookupKey: entry.stripeLookupKey, catalogCents: entry.priceCents ?? null, state: "unpriced" });
}

const status = {
  checkedAt: new Date().toISOString(),
  mode,
  source: "sync-script",
  ...(failures ? { error: `${failures} item(s) failed` } : {}),
  items,
};
// Local store path (lib/persistence.ts local docs live under data/). On Netlify, use the bay's "Check Stripe" button.
const dir = path.join(ROOT, "data", "siteflow");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "stripe-status.json"), `${JSON.stringify(status, null, 2)}\n`);
console.log(`Wrote data/siteflow/stripe-status.json · ${items.length} item(s) · ${failures} failure(s)${APPLY ? "" : " · dry run: nothing changed in Stripe"}`);
process.exit(failures ? 1 : 0);
