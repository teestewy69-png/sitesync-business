import { NextRequest, NextResponse } from "next/server";
import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import {
  appendLead,
  ensureBlobsFromRequest,
  findLeadByEmail,
  findLeadById,
  findLeadByIdempotency,
  findProjectByLeadId,
  stableId,
  storeInfo,
  updateLead,
} from "@/lib/store";
import { asNonEmptyString, isValidEmail, normalizeEmail } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKLIST_TEXT = `Hey!

Thanks for requesting a Sitesinc website. This is a request, not a purchase. If we accept the project, we send a $997.50 start invoice by email. The remaining $997.50 is due at launch. Optional monitoring is $129/month and can be added later.

Here is the same checklist we run through on every build:

DESIGN
[ ] Dark or light theme picked deliberately (not the builder default)
[ ] One clear headline that says what you do and who it's for
[ ] Your phone number / main CTA visible without scrolling
[ ] Real photos of your work, not just stock images

COPY
[ ] Every page answers "what's in it for me?" for the visitor
[ ] Services listed with plain-language descriptions and prices (or "from" prices)
[ ] At least one testimonial with a real name
[ ] A clear next step on every page (call, book, buy)

SEO BASICS
[ ] Unique title + meta description on every page
[ ] Your city/service area in the homepage title
[ ] Google Business Profile claimed and linked
[ ] Fast hosting + SSL (https)

MONEY PIECES (the ones most sites forget)
[ ] Lead capture form that goes somewhere you actually check
[ ] A way to take payment online (Stripe link is enough to start)
[ ] Email list signup so you own your audience
[ ] Tracking (even simple analytics) so you know what's working

Website builds start at $1,995. $997.50 to start. $997.50 at launch. Optional monitoring $129/month. Cancel anytime. No long-term contract. https://sitesinc.co

Questions? Just reply to this email.

save@sitesinc.co`;

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
        const project = await intakeToProject(
          "subscribe",
          "Website build request",
          lead.id,
          monitoringInterest
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

    let mailed = { sent: false };
    try {
      mailed = await sendMail({
        to: email,
        subject: "Your Sitesinc website request",
        text: CHECKLIST_TEXT,
      });
      await sendMail({
        to: getNotifyEmail(),
        subject: `New website request: ${lead.id}`,
        text: `New website request\n\nName: ${name}\nEmail: ${email}\nLead ID: ${lead.id}\nProject ID: ${projectId || "not linked"}\nMonitoring interest: ${monitoringInterest ? "yes" : "no"}\nReused existing lead: ${existing ? "yes" : "no"}\nStore: ${storeInfo().backend}\nSent ${lead.createdAt}\nSMTP configured: ${isMailConfigured() ? "yes" : "no"}`,
      });
    } catch (err) {
      console.error("Subscribe email error:", err);
    }

    if (!mailed.sent) {
      return NextResponse.json({
        ok: true,
        id: lead.id,
        projectId,
        reused: Boolean(existing),
        warning:
          "Request saved. This was a request, not a purchase. We have your name and email internally. The confirmation email could not send yet.",
      });
    }

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
