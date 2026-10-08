/**
 * Next.js request helpers, loaded lazily.
 *
 * Modules shared with the Netlify background function (netlify/functions/city-launch-background.mts)
 * must not import `next/*` statically: Netlify bundles functions with `next` left external, and plain
 * Node ESM cannot resolve "next/headers" / "next/navigation" (the package has no exports map), so the
 * whole function would fail to load. Inside Next these dynamic imports resolve to the very same modules.
 */

/** Re-throw Next's internal control-flow errors (notFound, redirect, dynamic bail-outs). No-op outside Next. */
export async function rethrowNextControlFlow(err: unknown): Promise<void> {
  let nav: typeof import("next/navigation");
  try {
    nav = await import("next/navigation");
  } catch {
    return; // not running inside Next (e.g. the background function): nothing to re-throw
  }
  nav.unstable_rethrow(err);
}
