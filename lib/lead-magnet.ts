import { LEAD_MAGNET_CHECKLIST } from "@/data/lead-magnet-checklist";
import { getNotifyEmail, isMailConfigured, sendMail } from "@/lib/mail";
import {
  appendLead,
  findLeadByEmail,
  stableId,
  storeInfo,
  updateLead,
  type Lead,
} from "@/lib/store";
import { asNonEmptyString, isValidEmail, normalizeEmail } from "@/lib/validate";

/**
 * Lead magnet: "The New Business Website Starter Checklist" (/start).
 *
 * Signups land in the same CRM leads store as every other lead (lib/store),
 * tagged with source "lead-magnet-start" so the factory inbox and the leads
 * CSV export can pull exactly this list. One entry per email address: the
 * lead id is derived from the email, and a repeat signup updates the entry
 * instead of creating a second one. The welcome email is sent with the
 * existing Titan SMTP sender (lib/mail); when SMTP is not configured the
 * signup is still saved and the lead is marked notificationState
 * "not_configured", exactly like /api/subscribe.
 */
export const LEAD_MAGNET_SOURCE = "lead-magnet-start";

export const CHECKLIST_PAGE_PATH = "/start/checklist";
export const CHECKLIST_PDF_PATH = "/new-business-website-starter-checklist.pdf";

export type ChecklistSection = { heading: string; items: string[] };

export const CHECKLIST: {
  title: string;
  subtitle: string;
  intro: string;
  sections: ChecklistSection[];
  closing: string;
} = LEAD_MAGNET_CHECKLIST;

export function checklistText(): string {
  const lines: string[] = [CHECKLIST.title, "", CHECKLIST.intro, ""];
  for (const section of CHECKLIST.sections) {
    lines.push(section.heading.toUpperCase());
    for (const item of section.items) lines.push(`[ ] ${item}`);
    lines.push("");
  }
  lines.push(CHECKLIST.closing);
  return lines.join("\n");
}

export function welcomeEmail(firstName: string, origin: string): { subject: string; text: string } {
  const name = firstName.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "Your New Business Website Starter Checklist",
    text: `${greeting}

Thanks for grabbing the checklist. Here it is, two ways:

Read it online: ${origin}${CHECKLIST_PAGE_PATH}
Download the PDF: ${origin}${CHECKLIST_PDF_PATH}

It walks the same order we use on every build: decide the basics, gather your materials, the pages you actually need, your Google Business Profile, the cost traps to skip, and a short launch-day list for when you go live.

If you'd rather hand the website itself off: SitesInc builds real, working websites for new and small businesses — $1,995 flat, one time, no subscriptions. Just reply to this email or call (909) 323-1575 and we'll talk it through.

We'll send occasional SitesInc tips and offers for new businesses. Don't want them? Reply and say so and we'll take you off the list.

— SitesInc
1968 South Coast Hwy #3632, Laguna Beach, CA 92651
save@sitesinc.co`,
  };
}

export type LeadMagnetSignup = { name: string; email: string; businessKind?: string };

/** Validate + normalize a /start form body. Returns an error message or the clean signup. */
export function parseLeadMagnetSignup(
  body: Record<string, unknown>
): { ok: true; signup: LeadMagnetSignup } | { ok: false; error: string } {
  const name = asNonEmptyString(body?.name, 120);
  const email = normalizeEmail(body?.email);
  const businessKind = asNonEmptyString(body?.businessKind, 200);
  if (!name) return { ok: false, error: "Please enter your first name." };
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  return { ok: true, signup: { name, email, businessKind: businessKind || undefined } };
}

function siteOrigin(reqOrigin?: string | null): string {
  return (
    process.env.DEPLOY_PRIME_URL ||
    process.env.URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    reqOrigin ||
    "https://sitesinc.co"
  ).replace(/\/$/, "");
}

export type LeadMagnetResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Core signup flow (the /api/lead-magnet route is a thin wrapper):
 * dedupe by email under LEAD_MAGNET_SOURCE, save, send the welcome email
 * once, and notify the operator inbox. Never throws for mail failures —
 * the saved lead is the source of truth.
 */
export async function handleLeadMagnetSignup(
  rawBody: Record<string, unknown>,
  reqOrigin?: string | null
): Promise<LeadMagnetResult> {
  const parsed = parseLeadMagnetSignup(rawBody);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: parsed.error } };
  }
  const { name, email, businessKind } = parsed.signup;
  const details = businessKind ? `Starting: ${businessKind}` : undefined;

  const leadId = await stableId("lead", `lead-magnet:${email}`);
  const existing = await findLeadByEmail(email, LEAD_MAGNET_SOURCE);
  const lead =
    existing ||
    (await appendLead({
      id: leadId,
      name,
      email,
      source: LEAD_MAGNET_SOURCE,
      createdAt: new Date().toISOString(),
      details,
    }));

  if (existing) {
    // One entry per email: refresh the name / business kind, keep the original signup date.
    await updateLead(existing.id, {
      name,
      ...(details ? { details } : {}),
    });
    if (existing.notificationState === "sent") {
      return {
        status: 200,
        body: { ok: true, id: lead.id, duplicate: true },
      };
    }
  }

  const origin = siteOrigin(reqOrigin);
  const mail = welcomeEmail(name, origin);
  let mailed = { sent: false };
  try {
    mailed = await sendMail({ to: email, subject: mail.subject, text: mail.text });
    await sendMail({
      to: getNotifyEmail(),
      subject: `New checklist signup: ${lead.id}`,
      text: `New lead-magnet signup (The New Business Website Starter Checklist)\n\nName: ${name}\nEmail: ${email}\nStarting: ${businessKind || "not given"}\nLead ID: ${lead.id}\nSource: ${LEAD_MAGNET_SOURCE}\nRepeat signup: ${existing ? "yes" : "no"}\nStore: ${storeInfo().backend}\nSigned up ${lead.createdAt}\nSMTP configured: ${isMailConfigured() ? "yes" : "no"}`,
    });
  } catch (err) {
    console.error("Lead magnet email error:", err);
  }

  await updateLead(lead.id, {
    notificationState: mailed.sent ? "sent" : isMailConfigured() ? "failed" : "not_configured",
  });

  if (!mailed.sent) {
    return {
      status: 200,
      body: {
        ok: true,
        id: lead.id,
        reused: Boolean(existing),
        warning:
          "You're on the list. The checklist email could not send yet — read the checklist on this page instead, and we'll follow up.",
      },
    };
  }

  return { status: 200, body: { ok: true, id: lead.id, reused: Boolean(existing) } };
}

/** CSV export of leads (optionally one source) for the factory. RFC-4180 quoting. */
export function leadsToCsv(leads: Lead[]): string {
  const esc = (value: unknown): string => {
    const text = value == null ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = "created_at,first_name,email,source,business_kind,lead_id,email_state";
  const rows = leads.map((lead) =>
    [
      lead.createdAt,
      lead.name,
      lead.email,
      lead.source,
      (lead.details || "").replace(/^Starting:\s*/, ""),
      lead.id,
      lead.notificationState || "",
    ]
      .map(esc)
      .join(",")
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}
