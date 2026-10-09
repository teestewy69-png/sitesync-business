import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isValidSession } from "@/lib/factory/auth";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { listStoredChecklists } from "@/lib/factory/checklist";
import { listBaselinesDetailed, readWorkspaceState } from "@/lib/factory/workspace";
import { ensureBlobsFromRequest, readRecords } from "@/lib/persistence";
import { siteEnv } from "@/lib/site-env";
import { listInquiries, listLeads, listProjects, storeInfo } from "@/lib/store";
import type { Order } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Operator-only JSON backup of leads + CRM records + factory/SEO state.
 * Auth is enforced by middleware.ts (matcher /api/factory/*) and re-checked here.
 * Contains customer names/emails (it is a backup): treat the download as private.
 * Never includes env vars, tokens, SMTP/Stripe config, or Stripe checkout URLs.
 *
 * Screenshot image BYTES are not included (only the references in the workspace). The `warnings`
 * array lists everything the export could not faithfully include (corrupt/invalid baselines that were
 * skipped, a workspace that is only the code-default seed, ...). An empty array means nothing was skipped.
 */
export async function GET(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(FACTORY_COOKIE)?.value, req.headers.get("host")))) {
    return NextResponse.json({ ok: false, error: "Factory authentication required." }, { status: 401 });
  }
  try {
    ensureBlobsFromRequest(req);
    const [leads, inquiries, projects, rawOrders, workspaceState, baselineRead, checklists] = await Promise.all([
      listLeads(),
      listInquiries(),
      listProjects(),
      readRecords<Order>("orders"),
      readWorkspaceState(),
      listBaselinesDetailed(),
      listStoredChecklists(),
    ]);
    const { workspace, persisted } = workspaceState;
    const { baselines, warnings: baselineWarnings } = baselineRead;
    const orders = rawOrders.map(({ stripeCheckoutUrl, ...order }) => ({
      ...order,
      hasStripeCheckoutUrl: Boolean(stripeCheckoutUrl),
    }));
    const warnings: { code: string; key?: string; message: string }[] = baselineWarnings.map((item) => ({
      code: `baseline_${item.problem}`,
      key: item.key,
      message: `${item.message} This baseline is NOT in the export.`,
    }));
    if (!persisted) {
      warnings.push({
        code: "workspace_not_persisted",
        key: "factory/workspace",
        message:
          "No workspace document is stored yet; factory.workspace below is the code-default seed, not saved data.",
      });
    }
    const store = storeInfo();
    const exportedAt = new Date().toISOString();
    const body = {
      ok: true,
      exportedAt,
      siteEnv: siteEnv(),
      store: { backend: store.backend, durable: store.durable, storeName: store.storeName },
      warnings,
      counts: {
        leads: leads.length,
        inquiries: inquiries.length,
        projects: projects.length,
        orders: orders.length,
        baselines: baselines.length,
        baselinesSkipped: baselineWarnings.length,
        checklists: checklists.length,
        screenshotRefs: workspace.screenshots.length,
      },
      screenshots: {
        bytesIncluded: false,
        refs: workspace.screenshots.length,
        note: "Screenshot image files are NOT included in this export; only the references listed in factory.workspace.screenshots. Back up the images separately if they matter.",
      },
      crm: { leads, inquiries, projects, orders },
      factory: { workspace, workspacePersisted: persisted, baselines, checklists },
    };
    return new NextResponse(`${JSON.stringify(body, null, 2)}\n`, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="sitesinc-${siteEnv()}-export-${exportedAt.slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error("Factory export failed:", err instanceof Error ? err.name : "unknown");
    return factoryErrorResponse(err, "Export failed.");
  }
}
