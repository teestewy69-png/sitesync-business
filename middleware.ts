import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isPublicFactoryPath, isValidSession } from "@/lib/factory/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicFactoryPath(pathname)) return NextResponse.next();

  const cookie = req.cookies.get(FACTORY_COOKIE)?.value;
  if (await isValidSession(cookie)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ ok: false, error: "Factory authentication required." }, { status: 401 });
  }

  const login = req.nextUrl.clone();
  login.pathname = "/app/login";
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/app", "/app/:path*", "/api/factory/:path*"],
};
