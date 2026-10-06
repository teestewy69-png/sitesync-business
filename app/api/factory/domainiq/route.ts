import { NextResponse } from "next/server";
import { DOMAINIQ_ENGINE_VERSION, DOMAINIQ_MODE, domainIQ } from "@/lib/domainiq";
import { availabilityCheckingEnabled } from "@/lib/domainiq/availability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DomainIQ bay status. Generation + scoring run in-process: no server, no key. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    engine: DOMAINIQ_ENGINE_VERSION,
    mode: DOMAINIQ_MODE,
    requiresServer: false,
    requiresApiKey: false,
    availability: availabilityCheckingEnabled()
      ? { enabled: true, sources: ["rdap.verisign.com (.com/.net)", "cloudflare-dns.com NS"], keyless: true }
      : { enabled: false, detail: "DOMAINIQ_AVAILABILITY=off - candidates stay unchecked." },
    purchase: "manual - Sitesinc never buys domains",
    niches: domainIQ.selectorNiches(),
  });
}
