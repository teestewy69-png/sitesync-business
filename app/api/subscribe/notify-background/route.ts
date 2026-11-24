import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Retired 2026-11-23: on this Netlify/Next setup the background-route
// handoff did not release the subscribe response early, and a racing
// fallback produced a duplicate confirmation email (proven live). The
// forms now fire /api/subscribe/notify instead. This endpoint stays as a
// tombstone so any stale caller fails loudly instead of sending mail.
export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Gone. Use /api/subscribe/notify." },
    { status: 410 }
  );
}
