import { FREE_BOOK_GUIDE, type GuideBlock } from "@/data/free-book-guide";
import { parseLeadMagnetSignup, type LeadMagnetResult } from "@/lib/lead-magnet";
import {
  getNotifyEmail,
  isFlipRadarMailConfigured,
  isMailConfigured,
  sendFlipRadarMail,
  sendMail,
} from "@/lib/mail";
import { appendLead, findLeadByEmail, stableId, storeInfo, updateLead } from "@/lib/store";

/**
 * Free-ebook lead magnets, built on the /start lead-magnet pattern
 * (lib/lead-magnet.ts): signups land in the same CRM leads store, one entry
 * per email per source (dedupe by email), and each magnet's welcome email
 * goes out via its own mail profile in lib/mail. When a profile is not
 * configured the signup is still saved and the lead is marked
 * "not_configured".
 *
 * Two magnets share this core:
 *  - "What Your Web Builder Won't Tell You" (SitesInc) — source
 *    "lead-magnet-free-book", captured on sitesinc.co at /free-book, book
 *    delivered from sitesinc.co (/free-book/guide + the PDF in public/).
 *    Welcome email via the Titan profile (lib/mail sendMail).
 *  - "Your First Flip" (FlipRadar) — source "lead-magnet-flipradar",
 *    captured cross-origin from the static flipradar.co site via
 *    /api/flipradar-book; the book is hosted on flipradar.co itself and the
 *    welcome email is purely FlipRadar-branded (no SitesInc links), sent
 *    through FlipRadar's own Zoho mail profile (lib/mail sendFlipRadarMail,
 *    From "FlipRadar" <hello@flipradar.co>) — never through Titan, whose
 *    From/domain authentication belongs to sitesinc.co.
 */
export const FREE_BOOK_SOURCE = "lead-magnet-free-book";
export const FLIPRADAR_BOOK_SOURCE = "lead-magnet-flipradar";

export const FREE_BOOK_PAGE_PATH = "/free-book/guide";
export const FREE_BOOK_PDF_PATH = "/what-your-web-builder-wont-tell-you.pdf";
export const FREE_BOOK_SIGNUP_PATH = "/free-book";

export const FLIPRADAR_BOOK_TITLE = "Your First Flip";
export const FLIPRADAR_BOOK_PDF_URL = "https://flipradar.co/your-first-flip-guide.pdf";
export const FLIPRADAR_CONTACT_EMAIL = "hello@flipradar.co";

export const GUIDE = FREE_BOOK_GUIDE;

/** Strip the markdown-lite inline markers (**bold**, *italic*) for plain text. */
export function stripInline(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1");
}

function blockText(block: GuideBlock): string[] {
  switch (block.type) {
    case "p":
    case "h3":
    case "quote":
      return [stripInline(block.text), ""];
    case "list":
      return [...block.items.map((item) => `- ${stripInline(item)}`), ""];
    case "checklist":
      return [...block.items.map((item) => `[ ] ${stripInline(item)}`), ""];
    case "table": {
      const rows = [block.head, ...block.rows].map((row) =>
        row.map((cell) => stripInline(cell)).join(" | ")
      );
      return [...rows, ""];
    }
  }
}

/** Plain-text copy of the whole guide (same role as checklistText()). */
export function guideText(): string {
  const lines: string[] = [
    GUIDE.title,
    GUIDE.subtitle,
    "",
    GUIDE.brandLine,
    GUIDE.audience,
    "",
    stripInline(GUIDE.honestNote),
    "",
  ];
  for (const chapter of GUIDE.chapters) {
    lines.push(chapter.heading.toUpperCase(), "");
    for (const block of chapter.blocks) lines.push(...blockText(block));
  }
  for (const paragraph of GUIDE.closing) lines.push(stripInline(paragraph), "");
  return lines.join("\n").trimEnd();
}

export function freeBookWelcomeEmail(
  firstName: string,
  origin: string
): { subject: string; text: string } {
  const name = firstName.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "Your free ebook: What Your Web Builder Won't Tell You",
    text: `${greeting}

Thanks for grabbing the ebook. Here it is, two ways:

Read it online: ${origin}${FREE_BOOK_PAGE_PATH}
Download the PDF: ${origin}${FREE_BOOK_PDF_PATH}

It walks the whole real cost of a website: the 14 fees that hide behind the sticker price, a three-year worksheet that turns any quote into one honest number, three worked comparisons with the math shown, and the 10 questions to ask any builder before you sign — us included.

If you'd rather hand the website itself off: SitesInc builds real, working websites for small businesses and startups — $1,995 flat, one time, no subscriptions. Just reply to this email or call (909) 323-1575 and we'll talk it through.

We'll send occasional SitesInc tips and offers for small businesses. Don't want them? Reply and say so and we'll take you off the list.

— SitesInc
1968 South Coast Hwy #3632, Laguna Beach, CA 92651
save@sitesinc.co`,
  };
}

export function flipRadarWelcomeEmail(firstName: string): { subject: string; text: string } {
  const name = firstName.trim();
  const greeting = name ? `Hi ${name},` : "Hi,";
  return {
    subject: "Your free ebook: Your First Flip",
    text: `${greeting}

Thanks for grabbing Your First Flip — the beginner's field guide to buying, fixing, and selling your first house. Here's your copy:

Download the PDF: ${FLIPRADAR_BOOK_PDF_URL}

It follows one example property from first look to final sale: finding the deal, running the ARV and 70% rule numbers, financing, the rehab, and the exit math — with the honest failure modes included, not just the wins. The free calculators at flipradar.co run every calculation in the book.

We'll send occasional FlipRadar tips for new flippers. Don't want them? Reply and say so and we'll take you off the list.

— FlipRadar
${FLIPRADAR_CONTACT_EMAIL} · flipradar.co`,
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

type EbookMagnet = {
  source: string;
  /** stableId seed prefix — source-scoped so each magnet keeps its own lead record. */
  idSeed: string;
  bookLabel: string;
  welcomeEmail: (name: string, origin: string) => { subject: string; text: string };
  /** Short noun for the operator notification ("ebook email sent/failed/..."). */
  deliveryNoun: string;
  /** Which mail profile sends the welcome email: Titan (SitesInc) or Zoho (FlipRadar). */
  mailProfile: "titan" | "zoho";
};

/**
 * Core ebook signup flow (the /api/free-book and /api/flipradar-book routes
 * are thin wrappers): dedupe by email under the magnet's source, save, send
 * the welcome email once, and notify the operator inbox. Never throws for
 * mail failures — the saved lead is the source of truth.
 */
async function handleEbookSignup(
  rawBody: Record<string, unknown>,
  reqOrigin: string | null | undefined,
  magnet: EbookMagnet
): Promise<LeadMagnetResult> {
  const parsed = parseLeadMagnetSignup(rawBody);
  if (!parsed.ok) {
    return { status: 400, body: { ok: false, error: parsed.error } };
  }
  const { name, email, businessKind } = parsed.signup;
  const details = businessKind ? `Starting: ${businessKind}` : undefined;

  const leadId = await stableId("lead", `${magnet.idSeed}:${email}`);
  const existing = await findLeadByEmail(email, magnet.source);
  const lead =
    existing ||
    (await appendLead({
      id: leadId,
      name,
      email,
      source: magnet.source,
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
  const mail = magnet.welcomeEmail(name, origin);
  const sendWelcome = magnet.mailProfile === "zoho" ? sendFlipRadarMail : sendMail;
  const welcomeConfigured =
    magnet.mailProfile === "zoho" ? isFlipRadarMailConfigured() : isMailConfigured();
  let mailed = { sent: false };
  try {
    mailed = await sendWelcome({ to: email, subject: mail.subject, text: mail.text });
    await sendMail({
      to: getNotifyEmail(),
      subject: `New ebook signup: ${lead.id}`,
      text: `New free-ebook signup (${magnet.bookLabel})\n\nName: ${name}\nEmail: ${email}\nStarting: ${businessKind || "not given"}\nLead ID: ${lead.id}\nSource: ${magnet.source}\nRepeat signup: ${existing ? "yes" : "no"}\nStore: ${storeInfo().backend}\nSigned up ${lead.createdAt}\nWelcome-email (${magnet.mailProfile}) configured: ${welcomeConfigured ? "yes" : "no"}`,
    });
  } catch (err) {
    console.error("Ebook signup email error:", err);
  }

  await updateLead(lead.id, {
    notificationState: mailed.sent ? "sent" : welcomeConfigured ? "failed" : "not_configured",
  });

  if (!mailed.sent) {
    return {
      status: 200,
      body: {
        ok: true,
        id: lead.id,
        reused: Boolean(existing),
        warning: `You're on the list. The ${magnet.deliveryNoun} email could not send yet — we'll follow up, and your signup is saved.`,
      },
    };
  }

  return { status: 200, body: { ok: true, id: lead.id, reused: Boolean(existing) } };
}

const FREE_BOOK_MAGNET: EbookMagnet = {
  source: FREE_BOOK_SOURCE,
  idSeed: "lead-magnet-free-book",
  bookLabel: "What Your Web Builder Won't Tell You — SitesInc",
  welcomeEmail: freeBookWelcomeEmail,
  deliveryNoun: "ebook",
  mailProfile: "titan",
};

const FLIPRADAR_MAGNET: EbookMagnet = {
  source: FLIPRADAR_BOOK_SOURCE,
  idSeed: "lead-magnet-flipradar",
  bookLabel: "Your First Flip — FlipRadar",
  welcomeEmail: (name) => flipRadarWelcomeEmail(name),
  deliveryNoun: "ebook",
  // FlipRadar mail sends through its own Zoho profile (ZOHO_SMTP_USER /
  // ZOHO_SMTP_PASS, From "FlipRadar" <hello@flipradar.co>). Until the
  // operator supplies the Zoho app password, signups still save and the
  // welcome send reports not_configured — same graceful pattern as Titan.
  mailProfile: "zoho",
};

/** SitesInc free-book signup (POST /api/free-book, from /free-book). */
export async function handleFreeBookSignup(
  rawBody: Record<string, unknown>,
  reqOrigin?: string | null
): Promise<LeadMagnetResult> {
  return handleEbookSignup(rawBody, reqOrigin, FREE_BOOK_MAGNET);
}

/** FlipRadar "Your First Flip" signup (POST /api/flipradar-book, from flipradar.co). */
export async function handleFlipRadarSignup(
  rawBody: Record<string, unknown>,
  reqOrigin?: string | null
): Promise<LeadMagnetResult> {
  return handleEbookSignup(rawBody, reqOrigin, FLIPRADAR_MAGNET);
}
