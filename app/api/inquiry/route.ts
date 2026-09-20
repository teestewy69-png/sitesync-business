import { NextRequest, NextResponse } from "next/server";
import { requireProduct } from "@/lib/catalog";
import { getNotifyEmail, sendMail } from "@/lib/mail";
import { appendInquiry, ensureBlobsFromRequest, newId } from "@/lib/store";
import {
  asNonEmptyString,
  isValidEmail,
  normalizeEmail,
} from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    const inquiry = await appendInquiry({
      id: newId("inq"),
      slug: product.slug,
      productName: product.name,
      name,
      email,
      message,
      createdAt: new Date().toISOString(),
    });

    try {
      const { intakeToProject } = await import("@/lib/factory/intake");
      await intakeToProject("inquiry", `Shop inquiry: ${product.name}`, inquiry.id);
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

    if (!mailed.sent) {
      return NextResponse.json({
        ok: true,
        id: inquiry.id,
        warning: "Inquiry saved. We couldn't send the confirmation email right now.",
      });
    }

    return NextResponse.json({ ok: true, id: inquiry.id });
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
