import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LocationsIndex from "@/components/city-launch/LocationsIndex";
import { approvedEntries, previewLinks } from "@/lib/factory/city-launch-public";
import { requestOrigin } from "@/lib/factory/request-origin";
import { cityLaunchContext, readCityIndex } from "@/lib/factory/city-launch";
import { DESIGN_STYLES } from "@/lib/design-styles";
import { findProjectById } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ projectId: string }> }): Promise<Metadata> {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  const name = project?.businessName || project?.label || "Locations";
  return {
    title: { absolute: `Service areas · ${name}` },
    description: `Cities ${name} serves, each with its own local page.`,
    robots: { index: false, follow: false },
  };
}

export default async function PreviewLocationsIndex({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await findProjectById(projectId);
  if (!project) notFound();
  const ctx = cityLaunchContext(project);
  const style = DESIGN_STYLES.find((d) => d.id === ctx.designStyleId) || DESIGN_STYLES[0];
  const pages = approvedEntries(await readCityIndex(projectId));
  return <LocationsIndex ctx={ctx} style={style} pages={pages} links={previewLinks(projectId, ctx, await requestOrigin())} />;
}
