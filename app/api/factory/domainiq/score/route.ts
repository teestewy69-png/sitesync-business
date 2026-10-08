import { NextRequest, NextResponse } from "next/server";
import { DOMAINIQ_ENGINE_VERSION, domainIQ } from "@/lib/domainiq";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { domain, niche?, primaryKeyword? } -> DomainIQ score breakdown (same engine as DomainIQ POST /score). */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const domain = String(body.domain || body.fullName || "").trim();
  if (!domain) return NextResponse.json({ ok: false, error: "domain required." }, { status: 400 });
  const niche = String(body.niche || "").trim();
  const primaryKeyword = String(body.primaryKeyword || "").trim() || null;
  try {
    const ctx = niche ? domainIQ.scoreContextForNiche(niche, primaryKeyword) : { primaryKeyword };
    return NextResponse.json({ ok: true, engine: DOMAINIQ_ENGINE_VERSION, score: domainIQ.score(domain, ctx) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Invalid domain." },
      { status: 400 }
    );
  }
}
