import { NextResponse } from "next/server";
import { StoreError } from "@/lib/persistence";

/**
 * JSON error response for factory API routes. Store failures are real server errors
 * (500, or 409 for a concurrent-change conflict) so the UI can show "Not saved: ..." instead
 * of pretending the change landed. Messages carry only error names/codes, never secrets.
 */
export function factoryErrorResponse(err: unknown, fallback: string, validationStatus = 500) {
  if (err instanceof StoreError) {
    return NextResponse.json(
      { ok: false, error: err.message, code: `store_${err.kind}` },
      { status: err.kind === "conflict" ? 409 : 500 }
    );
  }
  return NextResponse.json(
    { ok: false, error: err instanceof Error ? err.message : fallback },
    { status: validationStatus }
  );
}
