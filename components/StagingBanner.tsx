import { isStagingEnv } from "@/lib/site-env";

export default function StagingBanner() {
  if (!isStagingEnv()) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-3 right-3 z-[200] rounded-full bg-amber-400/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-950 shadow-lg ring-1 ring-amber-200/80"
    >
      Test site
    </div>
  );
}
