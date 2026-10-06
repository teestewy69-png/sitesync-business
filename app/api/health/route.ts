import { NextRequest, NextResponse } from "next/server";
import { workspaceHealth } from "@/lib/factory/workspace";
import { isMailConfigured } from "@/lib/mail";
import { docStoreHealth } from "@/lib/persistence";
import { siteflowHealth } from "@/lib/siteflow/summary";
import { isStripeConfigured } from "@/lib/stripe-checkout";
import { isStagingEnv } from "@/lib/site-env";
import { ensureBlobsFromRequest, storeInfo, storeWritable } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated, so the response stays minimal: booleans and short status words only, never
 * error text, key names or secrets. `ok` is false (HTTP 503) when the CRM store is not writable,
 * the factory document store fails its write/read probe, or the stored workspace is corrupt/unreadable.
 * A store that simply has no workspace yet ("not_initialized") is reported but is not unhealthy.
 * `siteflow` reports Stripe mode (test/live/unset/invalid), whether the webhook and download-signing
 * secrets are set, and when the last verified Stripe webhook arrived. Payments being unconfigured does
 * not make the site unhealthy.
 */
export async function GET(req: NextRequest) {
  ensureBlobsFromRequest(req);
  const writable = await storeWritable();
  const factoryStore = await docStoreHealth();
  const workspace = await workspaceHealth();
  const siteflow = await siteflowHealth();
  const ok = writable && factoryStore.ok && (workspace === "ok" || workspace === "not_initialized");
  return NextResponse.json(
    {
      ok,
      service: "sitesinc",
      smtp: isMailConfigured(),
      stripe: isStripeConfigured(),
      store: storeInfo(),
      storeWritable: writable,
      factoryStoreWritable: factoryStore.ok,
      workspace,
      siteflow,
      factory: "sitesinc-growth-case-study",
      ...(isStagingEnv() ? { siteEnv: "staging" as const } : {}),
    },
    { status: ok ? 200 : 503 }
  );
}
