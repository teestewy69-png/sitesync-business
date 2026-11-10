/** Public paths that should stay out of search results. Keep in sync with robots.txt. */
export const PUBLIC_NOINDEX_DISALLOWS = [
  "/app/",
  "/api/",
  "/cart",
  "/checkout",
  "/case-study",
  "/demo/",
  "/go/",
  "/tools",
  "/thank-you",
] as const;

export function isPublicNoindexPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  for (const rule of PUBLIC_NOINDEX_DISALLOWS) {
    const prefix = rule.endsWith("/") ? rule.slice(0, -1) : rule;
    if (path === prefix || path.startsWith(`${prefix}/`)) return true;
  }
  return false;
}