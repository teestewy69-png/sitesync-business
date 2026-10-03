import { NextRequest, NextResponse } from "next/server";
import { FACTORY_COOKIE, isValidSession } from "@/lib/factory/auth";
import { factoryErrorResponse } from "@/lib/factory/api-errors";
import { listStoredChecklists } from "@/lib/factory/checklist";
import { listBaselines, readWorkspace } from "@/lib/factory/workspace";
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
 * Screenshot image bytes are not embedded (the workspace lists their references).
 */
export async function GET(req: NextRequest) {
  if (!(await isValidSession(req.cookies.get(FACTORY_COOKIE)?.value))) {
    return NextResponse.json({ ok: false, error: "Factory authentication required." }, { status: 401 });
  }
  try {
    ensureBlobsFromRequest(req);
    const [leads, inquiries, projects, rawOrders, workspace, baselines, checklists] = await Promise.all([
      listLeads(),
      listInquiries(),
      listProjects(),
      readRecords<Order>("orders"),
      readWorkspace(),
      listBaselines(),
      listStoredChecklists(),
    ]);
    const orders = rawOrders.map(({ stripeCheckoutUrl, ...order }) => ({
      ...order,
      hasStripeCheckoutUrl: Boolean(stripeCheckoutUrl),
    }));
    const store = storeInfo();
    const exportedAt = new Date().toISOString();
    const body = {
      ok: true,
      exportedAt,
      siteEnv: siteEnv(),
      store: { backend: store.backend, durable: store.durable, storeName: store.storeName },
      counts: {
        leads: leads.length,
        inquiries: inquiries.length,
        projects: projects.length,
        orders: orders.length,
        baselines: baselines.length,
        checklists: checklists.length,
        screenshotRefs: workspace.screenshots.length,
      },
      crm: { leads, inquiries, projects, orders },
      factory: { workspace, baselines, checklists },
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
