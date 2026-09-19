import { NextResponse } from "next/server";
import { isMailConfigured } from "@/lib/mail";
import { isStripeConfigured } from "@/lib/stripe-checkout";
import { storeInfo, storeWritable } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const writable = await storeWritable();
  return NextResponse.json({
    ok: true,
    service: "sitesinc",
    smtp: isMailConfigured(),
    stripe: isStripeConfigured(),
    store: storeInfo(),
    storeWritable: writable,
    factory: "sitesinc-growth-case-study",
  });
}
