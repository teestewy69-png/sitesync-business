export const FACTORY_COOKIE = "factory_session";

export function isHostedRuntime(): boolean {
  return Boolean(process.env.NETLIFY || process.env.CONTEXT || process.env.NODE_ENV === "production");
}

export function factoryToken(): string {
  const env = process.env.FACTORY_ACCESS_TOKEN?.trim();
  if (env) return env;
  if (!isHostedRuntime() && process.env.NODE_ENV !== "production") {
    return "local-dev-only";
  }
  return "";
}

export async function sessionValue(token = factoryToken()): Promise<string> {
  const data = new TextEncoder().encode(`sitesinc-factory:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isValidSession(cookie: string | undefined): Promise<boolean> {
  const token = factoryToken();
  if (!token || !cookie) return false;
  const expected = await sessionValue(token);
  return cookie === expected;
}

export function isPublicFactoryPath(pathname: string): boolean {
  return pathname === "/app/login" || pathname === "/api/factory/login";
}
