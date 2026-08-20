import { NextRequest, NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: unknown };
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Please enter a valid email address." },
        { status: 400 },
      );
    }

    console.log("[waitlist] new signup", email, new Date().toISOString());

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[waitlist] error", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
