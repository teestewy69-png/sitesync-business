import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isPublicFactoryPath, isValidSession } from "@/lib/factory/auth";
import { CLIENT_DOMAIN_PREFIX, clientDomainRoute, isLocalDevHost, isSitesincHost } from "@/lib/client-domain/host";
import { isSiteflowPath, siteflowEnabled } from "@/lib/siteflow/flag";
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

/** The public shop was removed on 2026-10-05 (Sitesinc sells website builds only): old /shop URLs 301 to the homepage. */
export function isRemovedShopPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return p === "/shop" || p.startsWith("/shop/");
}

function isFactoryPath(pathname: string) {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/api/factory" ||
    pathname.startsWith("/api/factory/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Netlify platform paths (functions such as city-launch-background) are never routed or rewritten here.
  if (pathname.startsWith("/.netlify/")) return NextResponse.next();
  const siteflowOn = siteflowEnabled(process.env);

  // SiteFlow is paused (Path A) unless SITEFLOW_ENABLED is set: its routes do not exist on any host.
  if (!siteflowOn && isSiteflowPath(pathname)) return notFound();

  const host = requestHost(req);

  // Client real domains (see lib/client-domain/host.ts). Sitesinc, staging, Netlify preview and local hosts skip this.
  if (process.env.CLIENT_DOMAIN_ROUTING !== "off" && !isSitesincHost(host, process.env)) {
    const route = clientDomainRoute(host, pathname);
    if (route.kind === "pass") return NextResponse.next();
    if (route.kind === "not_found") return notFound();
    const url = req.nextUrl.clone();
    url.pathname = route.pathname;
    // Preserve the public Host across the rewrite. Locally nextUrl.host is often localhost /
    // 127.0.0.1 while the browser/curl Host is the client domain; without this header the
    // /client-domain pages see Host=localhost and 404 (requireClientSite requires a match).
    const headers = new Headers(req.headers);
    headers.set("x-sitesinc-client-host", host);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  // Sitesinc hosts: the internal client-domain routes are never reachable on real Sitesinc
  // hosts (sitesinc.co, Netlify). On local-dev hosts they must pass through: a Host-header
  // test rewrites to http://localhost/client-domain/... which Next may fetch as a same-box
  // follow-up with Host=localhost — blocking that follow-up 404s every client-domain request.
  if (pathname === CLIENT_DOMAIN_PREFIX || pathname.startsWith(`${CLIENT_DOMAIN_PREFIX}/`)) {
    if (!isLocalDevHost(host)) return notFound();
    return NextResponse.next();
  }

  // Removed shop: /shop and /shop/* (old product pages, "Other inquiries") permanently redirect to the homepage.
  if (isRemovedShopPath(pathname)) {
    const home = req.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home, 301);
  }

  // SiteFlow partner links (?ref=<code>): validate + set the referral cookie in a Node route, then land on the clean URL.
  // While SiteFlow is paused, ?ref= does nothing: no redirect, no cookie.
  const ref = siteflowOn ? shouldCaptureRef(req.method, pathname, req.nextUrl.search) : "";
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
  // On Sitesinc hosts only /app and /api/factory (factory auth), paused SiteFlow routes (404), the removed /shop
  // (301 to /) and, when SiteFlow is enabled, GET pages with ?ref= (referral capture) do anything.
  matcher: ["/((?!_next/static|_next/image).*)"],
};
