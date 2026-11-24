import { NextRequest, NextResponse } from "next/server";
import { appendLead, ensureBlobsFromRequest, findLeadById, stableId, updateLead } from "@/lib/store";
import { FREE_AUDIT_SOURCE } from "@/lib/audit-mail";
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

// Capture half of the free audit (founder ruling 2026-11-23): save the lead
// and answer immediately. The audit itself runs in the /send invocation the
// form fires right after, so the visitor never waits on the crawl or the
// mail server. One audit per email + site per day; a same-day resubmit
// reuses the lead instead of stacking duplicates.
export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const limited = rateLimit(`free-audit-request:${clientKey(req)}`, 5, 10 * 60 * 1000);
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
    const url = asNonEmptyString(body?.url, 300);
    const privacy = asFlag(body?.privacy);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (!url) {
      return NextResponse.json(
        { ok: false, error: "Please enter your website address." },
        { status: 400 }
      );
    }
    if (!privacy) {
      return NextResponse.json(
        { ok: false, error: "Please agree to the privacy policy so we can email you." },
        { status: 400 }
      );
    }

    const day = new Date().toISOString().slice(0, 10);
    const leadId = await stableId(
      "lead",
      `free-audit:${email}:${url.toLowerCase()}:${day}`
    );
    const existing = await findLeadById(leadId);
    if (existing) {
      if (existing.notificationState === "sent") {
        return NextResponse.json({ ok: true, id: existing.id, reused: true });
      }
      // A resubmit of an unsent request counts as fresh: reopen the send
      // window so the form's /send fire can act on it.
      await updateLead(existing.id, { createdAt: new Date().toISOString() });
      return NextResponse.json({ ok: true, id: existing.id, reused: true });
    }

    const lead = await appendLead({
      id: leadId,
      name: name || "Website owner",
      email,
      source: FREE_AUDIT_SOURCE,
      createdAt: new Date().toISOString(),
      details: url,
    });

    return NextResponse.json({ ok: true, id: lead.id });
  } catch (err) {
    console.error("Free audit request error:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
