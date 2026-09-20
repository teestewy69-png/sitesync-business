import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, factoryToken, sessionValue } from "@/lib/factory/auth";
import { asNonEmptyString } from "@/lib/validate";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const limited = rateLimit(`factory-login:${clientKey(req)}`, 8, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many sign-in attempts. Try again later." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const password = asNonEmptyString(body?.password, 200);
  const nextPath = asNonEmptyString(body?.next, 200);
  const token = factoryToken();
  if (!token) {
    return NextResponse.json({ ok: false, error: "FACTORY_ACCESS_TOKEN is not configured." }, { status: 503 });
  }
  if (!password || password !== token) {
    return NextResponse.json({ ok: false, error: "That access token is not valid." }, { status: 401 });
  }

  const next = nextPath.startsWith("/app") ? nextPath : "/app";
  const res = NextResponse.json({ ok: true, next });
  res.cookies.set({
    name: FACTORY_COOKIE,
    value: await sessionValue(token),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}
