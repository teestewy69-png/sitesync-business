import { NextRequest, NextResponse } from "next/server";
import { conversionEvent } from "@/lib/factory/conversions";
import { updateWorkspace } from "@/lib/factory/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES = new Set([
  "cta_click",
  "intake_start",
  "intake_success",
  "email_notification",
  "internal_project",
  "mobile_complete",
]);

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { type?: string; path?: string; meta?: string };
  if (!body.type || !TYPES.has(body.type)) {
    return NextResponse.json({ ok: false, error: "Unknown event type." }, { status: 400 });
  }
  const event = conversionEvent(body.type as "cta_click", body.path || "/", String(body.meta || ""));
  await updateWorkspace((workspace) => {
    workspace.conversions.events = [event, ...workspace.conversions.events].slice(0, 400);
    return workspace;
  });
  return NextResponse.json({ ok: true, id: event.id });
}
