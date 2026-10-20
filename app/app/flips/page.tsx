import { headers } from "next/headers";
import FactoryShell from "@/components/factory/Shell";
import FlipConsole from "@/components/factory/FlipConsole";
import { readFlipState } from "@/lib/factory/flip/store";
import type { FlipState } from "@/lib/factory/flip/model";
import { ensureBlobsFromRequest, listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function FlipModePage() {
  ensureBlobsFromRequest({ headers: await headers() });
  let flips: { id: string; label: string; stage: string; state: FlipState | null }[] = [];
  let error = "";
  try {
    const projects = (await listProjects()).filter((p) => p.mode === "flip");
    flips = await Promise.all(
      projects.map(async (p) => ({ id: p.id, label: p.businessName || p.label, stage: p.stage || "new", state: await readFlipState(p.id).catch(() => null) }))
    );
  } catch (err) {
    error = err instanceof Error ? err.name : "unknown";
  }
  return (
    <FactoryShell title="Flip Mode · build-to-sell sites">
      <p className="max-w-3xl text-sm text-slate-400">
        Sites Sitesinc builds to sell. Stages run in order: traffic, content, monetization, data recording, buyer handoff.
        Nothing here publishes, deploys, posts or emails. Generated pages stay drafts until approved.
      </p>
      {error ? <p className="mt-4 text-sm text-amber-300">Could not load projects ({error}).</p> : null}
      <FlipConsole initial={flips} />
    </FactoryShell>
  );
}
