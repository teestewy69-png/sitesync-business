import type { Metadata } from "next";
import { headers } from "next/headers";
import FactoryShell from "@/components/factory/Shell";
import DomainIQStandalone from "@/components/factory/DomainIQStandalone";
import { DOMAINIQ_ENGINE_VERSION, domainIQ } from "@/lib/domainiq";
import { availabilityCheckingEnabled } from "@/lib/domainiq/availability";
import { summarizeDomainBay } from "@/lib/factory/domainiq";
import { siteflowEnabled } from "@/lib/siteflow/flag";
import { ensureBlobsFromRequest, listProjects } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DomainIQ",
};

/**
 * Standalone DomainIQ generator page (Tony, 2026-11-09: "build a stand alone").
 * The factory home bay only summarises client projects, so with no clients it
 * reads as empty. This route is the tool itself; auth is the factory middleware
 * gate that already covers every /app/* path.
 */
export default async function DomainIQPage() {
  ensureBlobsFromRequest({ headers: await headers() });
  let clientProjects: Awaited<ReturnType<typeof listProjects>> = [];
  try {
    clientProjects = await listProjects();
  } catch (err) {
    console.warn("DomainIQ page: client projects unavailable.", err instanceof Error ? err.name : "unknown");
  }

  return (
    <FactoryShell title="DomainIQ · Domain generator">
      <DomainIQStandalone
        engine={DOMAINIQ_ENGINE_VERSION}
        availabilityEnabled={availabilityCheckingEnabled()}
        siteflowEnabled={siteflowEnabled()}
        niches={domainIQ.selectorNiches()}
        summary={summarizeDomainBay(clientProjects)}
      />
    </FactoryShell>
  );
}
