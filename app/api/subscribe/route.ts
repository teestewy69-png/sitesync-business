import { NextRequest, NextResponse } from "next/server";
import {
  appendLead,
  ensureBlobsFromRequest,
  findLeadByEmail,
  findLeadById,
  findLeadByIdempotency,
  findProjectByLeadId,
  stableId,
  updateLead,
} from "@/lib/store";
import { asNonEmptyString, isValidEmail, normalizeEmail } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    const form = await req.formData();
    return Object.fromEntries(form.entries());
  }
  return (await req.json().catch(() => ({}))) as Record<string, unknown>;
}

function asFlag(value: unknown): boolean {
  return value === true || value === "on" || value === "true";
}

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const limited = rateLimit(`subscribe:${clientKey(req)}`, 5, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await readBody(req);
    if (asNonEmptyString(body?.company_website, 80)) {
      return NextResponse.json({ ok: true });
    }

    const name = asNonEmptyString(body?.name, 120);
    const email = normalizeEmail(body?.email);
    const privacy = asFlag(body?.privacy);
    const monitoringInterest = asFlag(body?.monitoring);
    const goals = asNonEmptyString(body?.goals, 2000);
    const details = asNonEmptyString(body?.details, 4000);
    const idempotencyKey =
      asNonEmptyString(req.headers.get("idempotency-key"), 120) ||
      asNonEmptyString(body?.idempotencyKey, 120);

    if (!name) {
      return NextResponse.json({ ok: false, error: "Please enter your name." }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!privacy) {
      return NextResponse.json(
        { ok: false, error: "Please agree to the privacy policy so we can contact you." },
        { status: 400 }
      );
    }

    const fingerprint = idempotencyKey || `email:${email}`;
    const leadId = await stableId("lead", `checklist:${fingerprint}`);
    const existing =
      (await findLeadById(leadId)) ||
      (idempotencyKey ? await findLeadByIdempotency("checklist", idempotencyKey) : null) ||
      (await findLeadByEmail(email, "checklist"));
    const lead =
      existing ||
      (await appendLead({
        id: leadId,
        name,
        email,
        source: "checklist",
        createdAt: new Date().toISOString(),
        monitoringInterest,
        goals: goals || undefined,
        details: details || undefined,
        linkageState: "project_pending",
        idempotencyKey: idempotencyKey || undefined,
      }));

    if (existing) {
      await updateLead(existing.id, {
        name,
        monitoringInterest,
        goals: goals || existing.goals,
        details: details || existing.details,
      });
    }

    let projectId = lead.projectId || "";
    try {
      const linked = existing ? await findProjectByLeadId(lead.id) : null;
      if (linked) {
        projectId = linked.id;
      } else {
        const { intakeToProject } = await import("@/lib/factory/intake");
        const hostOrigin =
          process.env.DEPLOY_PRIME_URL ||
          process.env.URL ||
          process.env.NEXT_PUBLIC_SITE_URL ||
          req.nextUrl?.origin ||
          null;
        const project = await intakeToProject(
          "subscribe",
          "Website build request",
          lead.id,
          monitoringInterest,
          {
            name,
            email,
            goals: goals || undefined,
            details: details || undefined,
            hostOrigin,
          }
        );
        projectId = project?.id || "";
      }
      if (projectId) {
        await updateLead(lead.id, { projectId, monitoringInterest, linkageState: "linked" });
      } else {
        await updateLead(lead.id, { monitoringInterest, linkageState: "project_pending" });
      }
    } catch (err) {
      console.error(
        "Subscribe project link failed:",
        err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
      );
      await updateLead(lead.id, { monitoringInterest, linkageState: "project_pending" });
    }

    // Retry/double-click of a request we already confirmed in the last 10 minutes: do not email again.
    if (
      existing &&
      existing.notificationState === "sent" &&
      Date.now() - Date.parse(existing.createdAt) < 10 * 60 * 1000
    ) {
      return NextResponse.json({ ok: true, id: lead.id, projectId, reused: true, duplicate: true });
    }

    // Answer the visitor as soon as the request is saved. This route does
    // no mail work at all: the capture forms fire a separate
    // /api/subscribe/notify call (fire-and-forget) that sends the emails
    // in its own invocation, so the mail server's speed never reaches
    // this response. Two earlier attempts failed on Netlify — awaiting
    // the sends held the form ~10s, and both Next `after` and a
    // background-route handoff kept the sends on this response's clock
    // (the handoff version also produced a duplicate email when its
    // fallback raced it; all proven live 2026-11-23). The lead's
    // notificationState records the real send outcome.

    return NextResponse.json({ ok: true, id: lead.id, projectId, reused: Boolean(existing) });
  } catch (err) {
    console.error(
      "Subscribe error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't save that request. Please try again in a minute.",
      },
      { status: 502 }
    );
  }
}
