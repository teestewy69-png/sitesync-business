/**
 * Run work after the response is sent (Next `after()`), falling back to fire-and-forget outside a
 * request scope (scripts, tests). Errors are logged by name only.
 */
export function runAfterResponse(label: string, task: () => Promise<unknown>): void {
  const run = () =>
    task().then(
      () => undefined,
      (err) => {
        console.error(`[siteflow] ${label} failed:`, err instanceof Error ? err.name : "unknown");
      }
    );
  try {
    // Lazy require keeps this module loadable by node --test without Next.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("next/server") as { after?: (fn: () => void | Promise<void>) => void };
    if (typeof mod.after === "function") {
      mod.after(run);
      return;
    }
  } catch {
    // Not inside a Next request scope.
  }
  void run();
}
