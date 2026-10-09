export const EMAIL_CATCHER_DISMISSED_KEY = "sitesinc-email-catcher-dismissed";
export const EMAIL_CATCHER_SUBMITTED_KEY = "sitesinc-email-catcher-submitted";
export const EMAIL_CATCHER_AUTO_OPEN_MS = 5000;

export function isEmailCatcherInternalPath(pathname: string): boolean {
  return (
    pathname === "/app" ||
    pathname.startsWith("/app/") ||
    pathname === "/demo" ||
    pathname.startsWith("/demo/")
  );
}

export function shouldAutoOpenEmailCatcher(pathname: string): boolean {
  return pathname !== "/contact" && !isEmailCatcherInternalPath(pathname);
}

export function isEmailCatcherTrigger(attrs: {
  href?: string | null;
  cta?: string | null;
  catcher?: string | null;
  insideCatcher?: boolean;
}): boolean {
  if (attrs.insideCatcher) return false;
  if (attrs.catcher === "off") return false;
  return (
    attrs.catcher === "true" ||
    (attrs.href || "").includes("#checklist") ||
    attrs.cta === "start_build"
  );
}
