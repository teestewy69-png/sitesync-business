import { NextRequest, NextResponse } from "next/server";
import { availabilityCheckingEnabled, checkDomainsAvailability } from "@/lib/domainiq/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_DOMAINS = 12;

/** POST { domains: string[] } -> keyless RDAP + DNS registration check. Never reserves or buys. */
export async function POST(req: NextRequest) {
  if (!availabilityCheckingEnabled()) {
    return NextResponse.json(
      { ok: false, error: "Availability checks disabled (DOMAINIQ_AVAILABILITY=off). Results stay unchecked." },
      { status: 400 }
    );
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const raw = Array.isArray(body.domains) ? body.domains : String(body.domains || body.domain || "").split(/[\n,]/);
  const domains = raw.map((d) => String(d).trim().toLowerCase()).filter(Boolean).slice(0, MAX_DOMAINS);
  if (!domains.length) return NextResponse.json({ ok: false, error: "domains required." }, { status: 400 });
  const results = await checkDomainsAvailability(domains);
  return NextResponse.json({ ok: true, results });
}
