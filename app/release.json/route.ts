import { NextResponse } from "next/server";
import { getBakedProductionRelease } from "@/lib/production-release";

export const dynamic = "force-static";
export const revalidate = false;

/**
 * Public, non-secret production source commit. Built from Netlify COMMIT_REF at
 * compile time (not runtime env). Local / preview / staging builds 404.
 */
export function GET() {
  const release = getBakedProductionRelease();
  if (!release) {
    return new NextResponse("Not found\n", {
      status: 404,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }
  return NextResponse.json(release, {
    headers: {
      "cache-control": "public, max-age=60, must-revalidate",
      "x-content-type-options": "nosniff",
    },
  });
}
