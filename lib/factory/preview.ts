import { headers } from "next/headers";

export function isPreviewEnv(): boolean {
  const context = process.env.CONTEXT || "";
  if (context && context !== "production") return true;
  if (process.env.NEXT_PUBLIC_FACTORY_PREVIEW === "1") return true;
  return false;
}

export async function isPreviewRequest(): Promise<boolean> {
  if (isPreviewEnv()) return true;
  const host = (await headers()).get("host") || "";
  if (host.includes("netlify.app")) return true;
  if (host.startsWith("preview.")) return true;
  return false;
}
