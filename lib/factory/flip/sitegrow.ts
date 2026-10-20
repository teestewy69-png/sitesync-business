/**
 * SiteGrow export: scheduled social post DRAFTS per site as JSON or CSV. Export only; nothing is posted or
 * scheduled anywhere. Format: docs/sitegrow-export.md (format id "sitegrow-drafts/v1").
 */
import type { FlipState, SocialDraft } from "./model";

export const SITEGROW_FORMAT = "sitegrow-drafts/v1";
export const SITEGROW_PLATFORMS = ["threads", "twitter", "instagram", "pinterest", "facebook", "linkedin"] as const;
export const SITEGROW_CSV_COLUMNS = ["id", "site", "platform", "scheduled_for", "status", "text", "link"] as const;
const LIMITS: Record<string, number> = { twitter: 280, threads: 500, instagram: 2200, pinterest: 500, facebook: 2000, linkedin: 3000 };

/** Build drafts: one post per planned page, rotating platforms, one per day from `start` at 15:00 UTC. */
export function buildSocialDrafts(state: FlipState, opts: { start?: string; platforms?: string[]; max?: number } = {}): SocialDraft[] {
  const platforms = (opts.platforms?.length ? opts.platforms : ["threads", "pinterest", "facebook"]).filter((p) =>
    (SITEGROW_PLATFORMS as readonly string[]).includes(p)
  );
  const pages = [...state.traffic.toolPages, ...state.traffic.contentPlan, ...state.traffic.cityPages].slice(0, opts.max ?? 30);
  const start = new Date(`${(opts.start || state.launchDate).slice(0, 10)}T15:00:00Z`);
  const origin = state.domain ? `https://${state.domain}` : "[link when live]";
  return pages.map((p, i) => {
    const platform = platforms[i % platforms.length];
    const when = new Date(start.getTime() + i * 86_400_000).toISOString();
    const link = state.domain ? `${origin}${p.path}?utm_source=${platform}&utm_medium=social&utm_campaign=sitegrow` : origin;
    const lead = p.kind === "calculator" ? `Free ${p.title}: run your numbers before you make an offer.` : p.kind === "city" ? `${p.title}: prices, days on market and flip spreads.` : `${p.title}.`;
    const text = `${lead} ${state.businessName}. Information only, not financial advice.`.slice(0, LIMITS[platform] - link.length - 1);
    return { id: `sg_${String(i + 1).padStart(3, "0")}`, site: state.domain || state.businessName, network: platform, scheduledFor: when, text, link, status: "draft" as const };
  });
}

export function sitegrowJson(state: FlipState, drafts: SocialDraft[]) {
  return {
    format: SITEGROW_FORMAT,
    site: { name: state.businessName, domain: state.domain },
    importAs: "draft",
    note: "Drafts only. Import into SiteGrow as drafts; nothing is posted until approved in SiteGrow.",
    posts: drafts.map((d) => ({ id: d.id, platform: d.network, scheduledFor: d.scheduledFor, status: "draft", text: d.text, link: d.link })),
  };
}

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function sitegrowCsv(drafts: SocialDraft[]): string {
  const rows = drafts.map((d) => [d.id, d.site, d.network, d.scheduledFor, "draft", d.text, d.link].map(csvCell).join(","));
  return `${SITEGROW_CSV_COLUMNS.join(",")}\n${rows.join("\n")}\n`;
}
