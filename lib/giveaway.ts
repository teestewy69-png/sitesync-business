import { catalog, formatCents } from "@/data/products";
import { CHECKLIST_PAGE_PATH, CHECKLIST_PDF_PATH } from "@/lib/lead-magnet";
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
 * The SitesInc Website Giveaway (/giveaway).
 *
 * Grand prize (Tony's terms, 2026-11-17): the winner gets a standard
 * SitesInc website build — regularly $1,995, one time, no subscription —
 * for $200, plus a monthly newsletter written and sent for the winner's
 * business for 6 months, plus any two ebooks from the store's guide
 * library. Five runner-ups get the Website Audit Kit. Entry itself is
 * free — no purchase necessary to enter or to be drawn; the $200 is the
 * winner's price for the build, disclosed up front in the rules.
 *
 * Entries land in the same CRM leads store as every other lead
 * (lib/store), tagged with source "giveaway-2026" so the factory inbox
 * and the leads CSV export (?source=giveaway-2026) can pull exactly this
 * list. One entry per email address: the lead id is derived from the
 * email, and a repeat entry updates the entry instead of creating a
 * second one. The confirmation email is sent with the existing Titan
 * SMTP sender (lib/mail); when SMTP is not configured the entry is still
 * saved and the lead is marked notificationState "not_configured",
 * exactly like /api/lead-magnet.
 */
export const GIVEAWAY_SOURCE = "giveaway-2026";

export const GIVEAWAY_NAME = "The SitesInc Website Giveaway";

/** Entries close the night before the draw (Thanksgiving), Pacific time. */
export const ENTRIES_CLOSE_TEXT = "Thursday, November 26, 2026 at 11:59 p.m. Pacific";
/** Winner drawn Black Friday, Pacific time. */
export const DRAW_DATE_TEXT = "Friday, November 27, 2026";

/** The website build at the center of the grand prize, in cents ($1,995). */
export const WEBSITE_BUILD_VALUE_CENTS = 199_500;
/** What the winner pays for that build, in cents ($200). */
export const WINNER_PRICE_CENTS = 20_000;
/** Months of done-for-you newsletter service in the grand prize. */
export const NEWSLETTER_MONTHS = 6;
/** How many library ebooks the winner picks. */
export const EBOOK_PICK_COUNT = 2;

export type PrizeGuide = { slug: string; name: string; priceCents: number };

/** Every listed, priced digital guide in the store — the library the winner picks from. */
export function prizeGuides(): PrizeGuide[] {
  return catalog
    .filter(
      (entry) =>
        entry.listed && !entry.retired && entry.kind === "digital" && entry.priceCents != null
    )
    .map((entry) => ({
      slug: entry.slug,
      name: entry.name,
      priceCents: entry.priceCents as number,
    }));
}

/** The runner-up prize: the Website Audit Kit guide. */
export const RUNNER_UP_COUNT = 5;
export const RUNNER_UP_PRIZE_NAME = "Website Audit Kit";

export const GIVEAWAY_RULES: string[] = [
  "No purchase necessary to enter or to be drawn. Entry is free, and buying anything from SitesInc does not improve your chances.",
  "Open to U.S. residents 18 or older who own a small business that does not have a website yet.",
  "One entry per email address. Duplicate entries are merged into one.",
  `Entries close ${ENTRIES_CLOSE_TEXT}.`,
  `One grand-prize winner is drawn at random on ${DRAW_DATE_TEXT} and notified by email. If the winner does not respond within 7 days, another winner is drawn.`,
  `Grand prize: one standard SitesInc website build (regularly ${formatCents(WEBSITE_BUILD_VALUE_CENTS)}, one time, no subscription) for ${formatCents(WINNER_PRICE_CENTS)}, payable when the winner claims the prize; a monthly newsletter written and sent for the winner's business for ${NEWSLETTER_MONTHS} months; and any ${EBOOK_PICK_COUNT} ebooks from the SitesInc guide library on this page, delivered by email. The prize cannot be transferred.`,
  `${RUNNER_UP_COUNT} runner-ups each receive the ${RUNNER_UP_PRIZE_NAME} guide, delivered by email.`,
  "The winner's first name and business name may be announced on SitesInc's social accounts.",
  "This giveaway is run by SitesInc and is not sponsored, endorsed, or administered by Instagram, Threads, Facebook, Pinterest, TikTok, LinkedIn, X, Reddit, or any other platform it is mentioned on.",
];

export function confirmationEmail(
  firstName: string,
  origin: string
): { subject: string; text: string } {
  const name = firstName.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "You're entered in the SitesInc Website Giveaway",
    text: `${greeting}

You're entered. One entry, in your name, for the grand prize:

- A standard SitesInc website build for your business — regularly $1,995 — for just $200
- A monthly newsletter written and sent for your business, for 6 months
- Any two ebooks from the SitesInc guide library, your choice

Entry was free; no purchase is necessary to enter or to be drawn, and buying anything would not change your chances. The $200 is simply the winner's price for the build, payable if you win and claim the prize.

Entries close ${ENTRIES_CLOSE_TEXT}. The winner is drawn at random on ${DRAW_DATE_TEXT} and notified at this email address — keep an eye on your inbox. ${RUNNER_UP_COUNT} runner-ups get the ${RUNNER_UP_PRIZE_NAME} guide.

While you wait, every entrant gets our New Business Website Starter Checklist free — the same list we work through on every build:

Read it online: ${origin}${CHECKLIST_PAGE_PATH}
Download the PDF: ${origin}${CHECKLIST_PDF_PATH}

If you'd rather not wait on a drawing: SitesInc builds real, working websites for new and small businesses — $1,995 flat, one time, no subscriptions. Just reply to this email or call (909) 323-1575 and we'll talk it through.

We'll send occasional SitesInc tips and offers for new businesses. Don't want them? Reply and say so and we'll take you off the list.

— SitesInc
1968 South Coast Hwy #3632, Laguna Beach, CA 92651
save@sitesinc.co`,
  };
}

export type GiveawayEntry = {
  name: string;
  email: string;
  businessName: string;
  businessKind?: string;
};

/** Validate + normalize a /giveaway form body. Returns an error message or the clean entry. */
export function parseGiveawayEntry(
  body: Record<string, unknown>
): { ok: true; entry: GiveawayEntry } | { ok: false; error: string } {
  const name = asNonEmptyString(body?.name, 120);
  const email = normalizeEmail(body?.email);
  const businessName = asNonEmptyString(body?.businessName, 200);
  const businessKind = asNonEmptyString(body?.businessKind, 200);
  if (!name) return { ok: false, error: "Please enter your first name." };
  if (!isValidEmail(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (!businessName) return { ok: false, error: "Please enter your business name." };
  return {
    ok: true,
    entry: { name, email, businessName, businessKind: businessKind || undefined },
  };
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

export type GiveawayResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Core entry flow (the /api/giveaway route is a thin wrapper):
 * dedupe by email under GIVEAWAY_SOURCE, save, send the confirmation email
 * once, and notify the operator inbox. Never throws for mail failures —
 * the saved lead is the source of truth.
 */
export async function handleGiveawayEntry(
  rawBody: Record<string, unknown>,
  reqOrigin?: string | null
): Promise<GiveawayResult> {
  const parsed = parseGiveawayEntry(rawBody);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: parsed.error } };
  }
  const { name, email, businessName, businessKind } = parsed.entry;
  const details = businessKind
    ? `Giveaway entry: ${businessName} (${businessKind})`
    : `Giveaway entry: ${businessName}`;

  const leadId = await stableId("lead", `giveaway:${email}`);
  const existing = await findLeadByEmail(email, GIVEAWAY_SOURCE);
  const lead: Lead =
    existing ||
    (await appendLead({
      id: leadId,
      name,
      email,
      source: GIVEAWAY_SOURCE,
      createdAt: new Date().toISOString(),
      details,
    }));

  if (existing) {
    // One entry per email: refresh the name / business, keep the original entry date.
    await updateLead(existing.id, { name, details });
    if (existing.notificationState === "sent") {
      return {
        status: 200,
        body: { ok: true, id: lead.id, duplicate: true },
      };
    }
  }

  const origin = siteOrigin(reqOrigin);
  const mail = confirmationEmail(name, origin);
  let mailed = { sent: false };
  try {
    mailed = await sendMail({ to: email, subject: mail.subject, text: mail.text });
    await sendMail({
      to: getNotifyEmail(),
      subject: `New giveaway entry: ${lead.id}`,
      text: `New giveaway entry (${GIVEAWAY_NAME})\n\nName: ${name}\nEmail: ${email}\nBusiness: ${businessName}\nKind: ${businessKind || "not given"}\nLead ID: ${lead.id}\nSource: ${GIVEAWAY_SOURCE}\nRepeat entry: ${existing ? "yes" : "no"}\nStore: ${storeInfo().backend}\nEntered ${lead.createdAt}\nSMTP configured: ${isMailConfigured() ? "yes" : "no"}`,
    });
  } catch (err) {
    console.error("Giveaway email error:", err);
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
          "You're entered. The confirmation email could not send yet — your entry is saved, and the winner is notified by email after the draw.",
      },
    };
  }

  return { status: 200, body: { ok: true, id: lead.id, reused: Boolean(existing) } };
}
