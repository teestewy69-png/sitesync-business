import { NextRequest, NextResponse } from "next/server";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { conversionEvent } from "@/lib/factory/conversions";
import { updateWorkspace } from "@/lib/factory/workspace";
import { ensureBlobsFromRequest } from "@/lib/persistence";

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
  try {
    ensureBlobsFromRequest(req);
    await updateWorkspace((workspace) => {
      workspace.conversions.events = [event, ...workspace.conversions.events].slice(0, 400);
      return workspace;
    });
  } catch (err) {
    return factoryErrorResponse(err, "Could not record event.");
  }
  return NextResponse.json({ ok: true, id: event.id });
}
