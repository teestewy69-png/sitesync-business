import { isMailConfigured } from "@/lib/mail";
import { newId, storeWritable } from "@/lib/store";
import { FACTORY_PROJECT_ID } from "./types";
import type { ConversionCheck, FactoryWorkspace } from "./types";

function check(
  id: string,
  label: string,
  ok: boolean,
  detail: string,
  launchBlocking = false
): ConversionCheck {
  return {
    id,
    label,
    ok,
    detail,
    lastRun: new Date().toISOString(),
    severity: ok ? "ok" : launchBlocking ? "launch_blocking" : "warning",
  };
}

export async function runConversionChecks(
  workspace: FactoryWorkspace,
  origin: string
): Promise<FactoryWorkspace["conversions"]> {
  const checks: ConversionCheck[] = [];

  const healthRes = await fetch(`${origin}/api/health`).catch(() => null);
  const health = healthRes ? await healthRes.json().catch(() => null) : null;
  checks.push(
    check(
      "health",
      "API health",
      Boolean(health?.ok),
      health?.ok ? "Health endpoint responded ok." : "Health endpoint failed.",
      true
    )
  );

  const sub = await fetch(`${origin}/api/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  }).catch(() => null);
  checks.push(
    check(
      "intake-validation",
      "Intake starts (validation)",
      sub?.status === 400,
      sub?.status === 400
        ? "Checklist form rejects bad email before write."
        : "Checklist validation did not return 400.",
      true
    )
  );

  const inq = await fetch(`${origin}/api/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: "", name: "", email: "", message: "x" }),
  }).catch(() => null);
  checks.push(
    check(
      "inquiry-validation",
      "Successful submissions (guard)",
      inq?.status === 400,
      inq?.status === 400
        ? "Inquiry form does not accept empty required fields."
        : "Inquiry validation did not return 400.",
      true
    )
  );

  const writable = await storeWritable();
  checks.push(
    check(
      "store",
      "Internal project creation / persistence",
      writable && workspace.project.id === FACTORY_PROJECT_ID,
      writable
        ? "Factory workspace and JSON store are writable."
        : "Store is not writable — launch blocking.",
      true
    )
  );

  const smtp = isMailConfigured();
  checks.push(
    check(
      "email",
      "Email notifications",
      smtp,
      smtp
        ? "SMTP is configured. Live send is not claimed until a real signup succeeds."
        : "SMTP is not configured. Notifications will not send.",
      false
    )
  );

  const ctaEvents = workspace.conversions.events.filter((e) => e.type === "cta_click").length;
  checks.push(
    check(
      "cta",
      "CTA clicks",
      true,
      ctaEvents
        ? `${ctaEvents} click events recorded in this workspace.`
        : "No CTA clicks recorded yet. Tracker is live on the checklist form; other CTAs stay manual until clicked.",
      false
    )
  );

  const mobileEvents = workspace.conversions.events.filter((e) => e.type === "mobile_complete");
  checks.push(
    check(
      "mobile",
      "Mobile completion",
      true,
      mobileEvents.length
        ? `${mobileEvents.length} mobile completion events.`
        : "No mobile completion events yet. Mark in progress — do not invent a rate.",
      false
    )
  );

  return {
    lastRun: new Date().toISOString(),
    checks,
    events: workspace.conversions.events,
    launchBlocking: checks.some((c) => !c.ok && c.severity === "launch_blocking"),
  };
}

export function conversionEvent(
  type: FactoryWorkspace["conversions"]["events"][number]["type"],
  path: string,
  meta = ""
) {
  return {
    id: newId("evt"),
    type,
    path,
    createdAt: new Date().toISOString(),
    meta: meta.slice(0, 200),
  };
}
