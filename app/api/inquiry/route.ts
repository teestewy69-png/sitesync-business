import { NextRequest, NextResponse } from "next/server";
import { requireProduct } from "@/lib/catalog";
import { getNotifyEmail, sendMail } from "@/lib/mail";
import {
  appendInquiry,
  ensureBlobsFromRequest,
  findInquiryById,
  findInquiryByIdempotency,
  findRecentInquiryByFingerprint,
  inquiryFingerprint,
  inquiryIdForKey,
  newId,
} from "@/lib/store";
import type { Inquiry } from "@/lib/store";
import {
  asNonEmptyString,
  isValidEmail,
  normalizeEmail,
} from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const SAVED_NO_EMAIL_WARNING = "Inquiry saved. We couldn't send the confirmation email right now.";

type Outcome = { id: string; warning?: string; duplicate: boolean };

// Same-process guard so a double-click that lands while the first request is still running
// waits for it instead of creating a second inquiry.
const inflight = new Map<string, Promise<Outcome>>();

function cleanIdempotencyKey(value: unknown): string {
  const key = asNonEmptyString(value, 120);
  return /^[A-Za-z0-9_.:-]{8,120}$/.test(key) ? key : "";
}

function outcomeFor(existing: Inquiry): Outcome {
  return {
    id: existing.id,
    duplicate: true,
    warning: existing.notificationState && existing.notificationState !== "sent" ? SAVED_NO_EMAIL_WARNING : undefined,
  };
}

async function findExisting(key: string, fingerprint: string): Promise<Inquiry | null> {
  try {
    if (key) {
      const byId = await findInquiryById(await inquiryIdForKey(key));
      if (byId) return byId;
      const byKey = await findInquiryByIdempotency(key);
      if (byKey) return byKey;
    }
    return await findRecentInquiryByFingerprint(fingerprint, DUPLICATE_WINDOW_MS);
  } catch (err) {
    // Fail open: a storage hiccup must not block a real inquiry.
    console.error("Inquiry dedupe lookup failed:", err instanceof Error ? err.name : "unknown");
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    ensureBlobsFromRequest(req);
    const limited = rateLimit(`inquiry:${clientKey(req)}`, 5, 10 * 60 * 1000);
    if (!limited.ok) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again in a few minutes." },
        { status: 429 }
      );
    }

    const body = await req.json();
    if (asNonEmptyString(body?.company_website, 80)) {
      return NextResponse.json({ ok: true });
    }
    const slug = asNonEmptyString(body?.slug, 80);
    const name = asNonEmptyString(body?.name, 120);
    const email = normalizeEmail(body?.email);
    const message = asNonEmptyString(body?.message, 2000);
    const idempotencyKey =
      cleanIdempotencyKey(req.headers.get("idempotency-key")) || cleanIdempotencyKey(body?.idempotencyKey);

    if (!slug) {
      return NextResponse.json(
        { ok: false, error: "Missing product." },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json(
        { ok: false, error: "Please enter your name." },
        { status: 400 }
      );
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    if (message.length < 8) {
      return NextResponse.json(
        { ok: false, error: "Please include a short message." },
        { status: 400 }
      );
    }

    let product;
    try {
      product = requireProduct(slug);
    } catch {
      return NextResponse.json(
        { ok: false, error: "That product was not found." },
        { status: 404 }
      );
    }

    const fingerprint = await inquiryFingerprint(product.slug, email, message);
    const lockKeys = [idempotencyKey ? `k:${idempotencyKey}` : "", `f:${fingerprint}`].filter(Boolean);
    const running = lockKeys.map((k) => inflight.get(k)).find(Boolean);
    if (running) {
      const first = await running;
      return NextResponse.json({ ok: true, id: first.id, duplicate: true, ...(first.warning ? { warning: first.warning } : {}) });
    }

    const job = (async (): Promise<Outcome> => {
      const existing = await findExisting(idempotencyKey, fingerprint);
      if (existing) return outcomeFor(existing);

      const inquiry = await appendInquiry({
        id: idempotencyKey ? await inquiryIdForKey(idempotencyKey) : newId("inq"),
        slug: product.slug,
        productName: product.name,
        name,
        email,
        message,
        createdAt: new Date().toISOString(),
        idempotencyKey: idempotencyKey || undefined,
        fingerprint,
      });

      try {
        const { intakeToProject } = await import("@/lib/factory/intake");
        await intakeToProject("inquiry", `Shop inquiry: ${product.name}`, inquiry.id, undefined, {
          name,
          email,
          details: message,
          primaryGoal: `Inquiry about ${product.name}`,
          niche: "shop / product inquiry",
          businessType: "general",
        });
      } catch {
        /* factory tracking must not break inquiry */
      }

      let mailed = { sent: false };
      try {
        mailed = await sendMail({
          to: getNotifyEmail(),
          subject: `Shop inquiry: ${product.name} (${inquiry.id})`,
          text: `${name} <${email}> asked about ${product.name} (${product.slug}).\n\n${message}\n\nInquiry ID: ${inquiry.id}\n${inquiry.createdAt}`,
          replyTo: email,
        });

        await sendMail({
          to: email,
          subject: `We got your inquiry about ${product.name}`,
          text: `Thanks ${name} — we received your note about ${product.name}. We'll reply from ${getNotifyEmail()}.\n\nYour message:\n${message}\n\nInquiry ID: ${inquiry.id}`,
        });
      } catch (err) {
        console.error("Inquiry email error:", err);
      }

      try {
        await appendInquiry({ ...inquiry, notificationState: mailed.sent ? "sent" : "failed" });
      } catch {
        /* notification state is informational */
      }

      return {
        id: inquiry.id,
        duplicate: false,
        warning: mailed.sent ? undefined : SAVED_NO_EMAIL_WARNING,
      };
    })();

    lockKeys.forEach((k) => inflight.set(k, job));
    let outcome: Outcome;
    try {
      outcome = await job;
    } finally {
      lockKeys.forEach((k) => inflight.delete(k));
    }

    return NextResponse.json({
      ok: true,
      id: outcome.id,
      ...(outcome.duplicate ? { duplicate: true } : {}),
      ...(outcome.warning ? { warning: outcome.warning } : {}),
    });
  } catch (err) {
    console.error(
      "Inquiry error:",
      err instanceof Error ? `${err.name}: ${err.message}` : "unknown"
    );
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn't send that inquiry. Please try again in a minute.",
      },
      { status: 502 }
    );
  }
}
