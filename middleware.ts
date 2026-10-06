import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isPublicFactoryPath, isValidSession } from "@/lib/factory/auth";
import { CLIENT_DOMAIN_PREFIX, clientDomainRoute, isSitesincHost } from "@/lib/client-domain/host";
import { shouldCaptureRef, stripRefParam } from "@/lib/siteflow/ref";

function requestHost(req: NextRequest): string {
  return req.headers.get("host") || req.headers.get("x-forwarded-host") || req.nextUrl.host;
}

function notFound() {
  return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
}

async function factoryAuth(req: NextRequest) {
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

function isFactoryPath(pathname: string) {
  return pathname === "/app" || pathname.startsWith("/app/") || pathname.startsWith("/api/factory/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Netlify platform paths (functions such as city-launch-background) are never routed or rewritten here.
  if (pathname.startsWith("/.netlify/")) return NextResponse.next();
  const host = requestHost(req);

  // Client real domains (see lib/client-domain/host.ts). Sitesinc, staging, Netlify preview and local hosts skip this.
  if (process.env.CLIENT_DOMAIN_ROUTING !== "off" && !isSitesincHost(host, process.env)) {
    const route = clientDomainRoute(host, pathname);
    if (route.kind === "pass") return NextResponse.next();
    if (route.kind === "not_found") return notFound();
    const url = req.nextUrl.clone();
    url.pathname = route.pathname;
    return NextResponse.rewrite(url);
  }

  // Sitesinc hosts: the internal client-domain routes are never reachable directly.
  if (pathname === CLIENT_DOMAIN_PREFIX || pathname.startsWith(`${CLIENT_DOMAIN_PREFIX}/`)) return notFound();

  // SiteFlow partner links (?ref=<code>): validate + set the referral cookie in a Node route, then land on the clean URL.
  const ref = shouldCaptureRef(req.method, pathname, req.nextUrl.search);
  if (ref) {
    const clean = stripRefParam(pathname, req.nextUrl.search);
    const target = req.nextUrl.clone();
    if (ref === "invalid") {
      target.search = clean.includes("?") ? clean.slice(clean.indexOf("?")) : "";
    } else {
      target.pathname = "/api/siteflow/ref";
      target.search = `?${new URLSearchParams({ code: ref, next: clean }).toString()}`;
    }
    return NextResponse.redirect(target, 307);
  }

  if (isFactoryPath(pathname)) return factoryAuth(req);
  return NextResponse.next();
}

export const config = {
  // Every path except Next's static/image assets: client domains need "/", "/locations", "/robots.txt"...
  // On Sitesinc hosts only /app and /api/factory (factory auth) and GET pages with ?ref= (SiteFlow referral capture) do anything.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
