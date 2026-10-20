/** Flip-site (build-to-sell) model: pure functions for every flip stage. Persistence lives in ./store.ts. */
import { outboundHref, SPONSORED_REL } from "@/lib/affiliates";
import { checkContentLength, lengthTarget, type ContentLengthCheck, type ContentLengthTarget } from "../content-length";
import {
  ADSENSE_ID_PLACEHOLDER,
  defaultAdSlots,
  FLIP_AFFILIATE_PROGRAMS,
  FLIP_GOAL,
  flipPresetFor,
  type AdSlotConfig,
  type FlipAffiliateProgram,
} from "./presets";

export type FlipStageKey = "traffic" | "content" | "monetization" | "data_recording" | "buyer_handoff";
export const FLIP_STAGE_ORDER: FlipStageKey[] = ["traffic", "content", "monetization", "data_recording", "buyer_handoff"];

export type FlipStageRun = {
  key: FlipStageKey;
  status: "not_started" | "complete" | "partial";
  ranAt: string;
  summary: string;
  needs: string[];
};

export type PlannedPage = { slug: string; path: string; title: string; kind: "city" | "calculator" | "guide"; status: "planned" | "queued" | "drafted" };
export type ArticleRecord = { slug: string; title: string; words: number; check: ContentLengthCheck | null; status: "needs_writing" | "ok" | "too_short" | "too_long" };
export type MonthlySnapshot = {
  month: string; // YYYY-MM
  sessions: number | null;
  users: number | null;
  pageviews: number | null;
  gscClicks: number | null;
  gscImpressions: number | null;
  revenue: number;
  expenses: number;
  profit: number;
  source: "seed" | "manual" | "ga4" | "gsc";
  recordedAt: string;
};
export type LedgerEntry = { id: string; date: string; type: "revenue" | "expense"; source: string; amount: number; proof: string; note: string };
export type ChangeEntry = { date: string; change: string; by: string };
export type SocialDraft = { id: string; site: string; network: string; scheduledFor: string; text: string; link: string; status: "draft" };

export type FlipState = {
  projectId: string;
  mode: "flip";
  test: boolean;
  closed: boolean;
  businessName: string;
  domain: string;
  niche: string;
  presetId: string;
  goal: string;
  launchDate: string; // YYYY-MM-DD
  sellTargetMonths: number;
  analytics: { ga4MeasurementId: string; gscProperty: string };
  adsensePublisherId: string;
  /** Set only after AdSense approves the site. Ads stay off until then. */
  adsenseApproved?: boolean;
  /** Factory-generated page drafts (LLM), pending approval. Never published by the factory. */
  generated?: import("./writer").GeneratedPage[];
  contentTarget: ContentLengthTarget;
  stages: FlipStageRun[];
  traffic: { cityPages: PlannedPage[]; toolPages: PlannedPage[]; contentPlan: PlannedPage[]; cityLaunch: string };
  articles: ArticleRecord[];
  monetization: {
    programs: (FlipAffiliateProgram & { goHref: string; rel: string })[];
    adSlots: AdSlotConfig;
    clickLogging: string;
  } | null;
  records: { snapshots: MonthlySnapshot[]; ledger: LedgerEntry[]; changeLog: ChangeEntry[] };
  socialDrafts: SocialDraft[];
  createdAt: string;
  updatedAt: string;
};

const GA4_RE = /^G-[A-Z0-9]{6,12}$/;
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export function monthsFrom(start: string, count: number): string[] {
  const [y, m] = start.slice(0, 7).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export function newFlipState(input: {
  projectId: string;
  businessName: string;
  domain: string;
  niche: string;
  launchDate?: string;
  ga4MeasurementId?: string;
  gscProperty?: string;
  adsensePublisherId?: string;
  test?: boolean;
  now?: string;
}): FlipState {
  const now = input.now || new Date().toISOString();
  const launchDate = /^\d{4}-\d{2}-\d{2}$/.test(input.launchDate || "") ? input.launchDate! : now.slice(0, 10);
  const ga4 = String(input.ga4MeasurementId || "").trim().toUpperCase();
  const preset = flipPresetFor(input.niche);
  const domain = String(input.domain || "").trim().toLowerCase();
  const state: FlipState = {
    projectId: input.projectId,
    mode: "flip",
    test: Boolean(input.test),
    closed: false,
    businessName: input.businessName,
    domain,
    niche: input.niche,
    presetId: preset.id,
    goal: FLIP_GOAL,
    launchDate,
    sellTargetMonths: 6,
    analytics: {
      ga4MeasurementId: GA4_RE.test(ga4) ? ga4 : "",
      gscProperty: String(input.gscProperty || (domain ? `sc-domain:${domain}` : "")).trim(),
    },
    adsensePublisherId: String(input.adsensePublisherId || "").trim(),
    contentTarget: lengthTarget({ max: 1500, target: 1500 }),
    stages: FLIP_STAGE_ORDER.map((key) => ({ key, status: "not_started", ranAt: "", summary: "", needs: [] })),
    traffic: { cityPages: [], toolPages: [], contentPlan: [], cityLaunch: "" },
    articles: [],
    monetization: null,
    records: { snapshots: [], ledger: [], changeLog: [] },
    socialDrafts: [],
    generated: [],
    createdAt: now,
    updatedAt: now,
  };
  state.records = seedRecords(state, now);
  return state;
}

/** Data recording seed: one empty snapshot per month from launch through the sell target, plus a launch change-log row. */
export function seedRecords(state: FlipState, now: string): FlipState["records"] {
  const snapshots: MonthlySnapshot[] = monthsFrom(state.launchDate, state.sellTargetMonths).map((month) => ({
    month, sessions: null, users: null, pageviews: null, gscClicks: null, gscImpressions: null,
    revenue: 0, expenses: 0, profit: 0, source: "seed", recordedAt: now,
  }));
  return {
    snapshots,
    ledger: [],
    changeLog: [{ date: state.launchDate, change: `Launch / pivot to ${state.niche} (annotate in GA4 ${state.analytics.ga4MeasurementId || "[GA4 id]"})`, by: "factory" }],
  };
}

function setStage(state: FlipState, key: FlipStageKey, summary: string, needs: string[], now: string) {
  state.stages = state.stages.map((s) =>
    s.key === key ? { ...s, status: needs.length ? "partial" : "complete", ranAt: now, summary, needs } : s
  );
  state.updatedAt = now;
}

/** Stage 1, traffic: programmatic city pages (City Launch picks), calculator/tool pages, content plan. */
export function runTrafficStage(
  state: FlipState,
  cities: { name: string; state: string; slug?: string }[],
  opts: { cityLaunchReady: boolean; now?: string }
): FlipState {
  const now = opts.now || new Date().toISOString();
  const preset = flipPresetFor(state.niche);
  state.traffic.cityPages = cities.map((c) => {
    const slug = c.slug || slugify(`${c.name}-${c.state}`);
    return {
      slug, path: `/markets/${slug}`,
      title: preset.cityPageTitle.replace("{city}", c.name).replace("{state}", c.state),
      kind: "city", status: "planned",
    };
  });
  state.traffic.toolPages = preset.calculators.map((c) => ({ slug: c.slug, path: `/tools/${c.slug}`, title: c.title, kind: "calculator", status: "planned" }));
  const topics = preset.guideTopics.length ? preset.guideTopics : [`${state.niche} beginner guide`];
  state.traffic.contentPlan = topics.map((t) => ({ slug: slugify(t), path: `/guides/${slugify(t)}`, title: t, kind: "guide", status: "planned" }));
  state.traffic.cityLaunch = opts.cityLaunchReady
    ? "City Launch provider configured: queue these cities as a batch from the City Launch bay."
    : "City Launch needs an AI writing key (LLM provider) to write city pages; pages are planned, not written.";
  const needs = opts.cityLaunchReady ? [] : ["AI writing key for City Launch"];
  setStage(state, "traffic",
    `${state.traffic.cityPages.length} city pages, ${state.traffic.toolPages.length} calculator pages, ${state.traffic.contentPlan.length} guides planned (${preset.articlesPerMonth}/month).`,
    needs, now);
  return state;
}

/** Stage 2, content: every guide gets a word window (max 1,500) and is checked when a body is supplied. */
export function runContentStage(state: FlipState, bodies: Record<string, string> = {}, now = new Date().toISOString()): FlipState {
  if (!Object.keys(bodies).length) {
    for (const g of state.generated || []) if (g.kind === "guide") bodies[g.slug] = g.body;
  }
  state.articles = state.traffic.contentPlan.map((p) => {
    const body = bodies[p.slug];
    if (!body) return { slug: p.slug, title: p.title, words: 0, check: null, status: "needs_writing" };
    const check = checkContentLength(body, state.contentTarget);
    return { slug: p.slug, title: p.title, words: check.words, check, status: check.status };
  });
  const ok = state.articles.filter((a) => a.status === "ok").length;
  const pending = state.articles.filter((a) => a.status === "needs_writing").length;
  const bad = state.articles.length - ok - pending;
  const needs: string[] = [];
  if (pending) needs.push(`AI writing key (or operator copy) for ${pending} articles`);
  if (bad) needs.push(`${bad} articles outside the ${state.contentTarget.min}-${state.contentTarget.max} word window`);
  setStage(state, "content", `Length window ${state.contentTarget.min}-${state.contentTarget.max} words; ${ok} ok, ${bad} out of window, ${pending} awaiting copy.`, needs, now);
  return state;
}

/** Stage 3, monetization: affiliate programs as /go links (click-logged), ad slots with AdSense placeholder. */
export function runMonetizationStage(state: FlipState, now = new Date().toISOString()): FlipState {
  const origin = state.domain ? `https://${state.domain}` : "";
  state.monetization = {
    programs: FLIP_AFFILIATE_PROGRAMS.map((p) => ({
      ...p,
      status: p.status === "active" ? "pending" : p.status, // never auto-active
      goHref: outboundHref(origin, p.slug, { src: "flip" }),
      rel: SPONSORED_REL,
    })),
    adSlots: defaultAdSlots(state.adsensePublisherId, state.adsenseApproved),
    clickLogging: "Each partner link goes through /go/[slug] (lib/affiliates.ts) which logs the click and 302s; tracking template env AFFILIATE_<SLUG>_URL_TEMPLATE once approved.",
  };
  const needs = ["Apply to affiliate programs (all marked apply/pending)"];
  if (state.monetization.adSlots.publisherId === ADSENSE_ID_PLACEHOLDER) needs.push("AdSense publisher ID");
  else if (!state.adsenseApproved) needs.push(`AdSense approval (ads off until approved; publish ads.txt: ${state.monetization.adSlots.adsTxt})`);
  setStage(state, "monetization", `${state.monetization.programs.length} programs wired as /go links, ${state.monetization.adSlots.slots.length} ad slots configured.`, needs, now);
  return state;
}

/** Stage 4, data recording: per-site GA4 + GSC, monthly snapshots seeded from launch, ledger, P&L, change log. */
export function runDataRecordingStage(state: FlipState, opts: { gscTokenPresent: boolean; now?: string }): FlipState {
  const now = opts.now || new Date().toISOString();
  if (!state.records.snapshots.length) state.records = seedRecords(state, now);
  recomputePnl(state);
  const needs: string[] = [];
  if (!state.analytics.ga4MeasurementId) needs.push("GA4 measurement ID");
  if (!opts.gscTokenPresent) needs.push("Search Console token (GOOGLE_SEARCH_CONSOLE_ACCESS_TOKEN) for automatic GSC snapshots");
  setStage(state, "data_recording",
    `GA4 ${state.analytics.ga4MeasurementId || "missing"}, GSC ${state.analytics.gscProperty || "missing"}; ${state.records.snapshots.length} monthly snapshots from ${state.launchDate}; ${state.records.ledger.length} ledger rows.`,
    needs, now);
  return state;
}

export function recomputePnl(state: FlipState): void {
  for (const s of state.records.snapshots) {
    const rows = state.records.ledger.filter((l) => l.date.slice(0, 7) === s.month);
    s.revenue = round2(rows.filter((r) => r.type === "revenue").reduce((a, r) => a + r.amount, 0));
    s.expenses = round2(rows.filter((r) => r.type === "expense").reduce((a, r) => a + r.amount, 0));
    s.profit = round2(s.revenue - s.expenses);
  }
}
const round2 = (n: number) => Math.round(n * 100) / 100;

export function addLedgerEntry(state: FlipState, e: Omit<LedgerEntry, "id">, id: string): LedgerEntry {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) throw new Error("date must be YYYY-MM-DD");
  if (!Number.isFinite(e.amount) || e.amount < 0) throw new Error("amount must be a non-negative number");
  const row = { ...e, id };
  state.records.ledger.push(row);
  const month = e.date.slice(0, 7);
  if (!state.records.snapshots.some((s) => s.month === month)) {
    state.records.snapshots.push({ month, sessions: null, users: null, pageviews: null, gscClicks: null, gscImpressions: null, revenue: 0, expenses: 0, profit: 0, source: "manual", recordedAt: new Date().toISOString() });
    state.records.snapshots.sort((a, b) => a.month.localeCompare(b.month));
  }
  recomputePnl(state);
  return row;
}

export function recordSnapshot(state: FlipState, month: string, traffic: Partial<Pick<MonthlySnapshot, "sessions" | "users" | "pageviews" | "gscClicks" | "gscImpressions">>, source: MonthlySnapshot["source"] = "manual"): MonthlySnapshot {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("month must be YYYY-MM");
  let snap = state.records.snapshots.find((s) => s.month === month);
  if (!snap) {
    snap = { month, sessions: null, users: null, pageviews: null, gscClicks: null, gscImpressions: null, revenue: 0, expenses: 0, profit: 0, source, recordedAt: "" };
    state.records.snapshots.push(snap);
    state.records.snapshots.sort((a, b) => a.month.localeCompare(b.month));
  }
  for (const k of ["sessions", "users", "pageviews", "gscClicks", "gscImpressions"] as const) {
    if (traffic[k] !== undefined && traffic[k] !== null) snap[k] = Math.max(0, Math.round(Number(traffic[k])));
  }
  snap.source = source;
  snap.recordedAt = new Date().toISOString();
  recomputePnl(state);
  return snap;
}

/** Stage 5, buyer handoff package. */
export function buildHandoffPackage(state: FlipState, now = new Date().toISOString()) {
  const d = state.domain || "[domain]";
  return {
    kind: "sitesinc-flip-handoff",
    version: 1,
    generatedAt: now,
    site: { name: state.businessName, domain: state.domain, niche: state.niche, goal: state.goal, launchDate: state.launchDate, test: state.test },
    assetList: [
      { asset: "Domain", detail: d },
      { asset: "Website code", detail: "GitHub repository (Next.js)" },
      { asset: "Hosting", detail: "Netlify site + environment variables (list names, never values)" },
      { asset: "Analytics", detail: `GA4 ${state.analytics.ga4MeasurementId || "[GA4 id]"}; Search Console ${state.analytics.gscProperty || "[property]"}` },
      { asset: "Content", detail: `${state.traffic.contentPlan.length} guides, ${state.traffic.toolPages.length} calculators, ${state.traffic.cityPages.length} city pages` },
      { asset: "Monetization", detail: (state.monetization?.programs || []).map((p) => `${p.name} (${p.status})`).join(", ") || "none" },
      { asset: "Email list", detail: "Export subscribers (CSV) from the email provider" },
      { asset: "Social accounts", detail: "Profiles + SiteGrow scheduled drafts export" },
    ],
    transferChecklist: [
      { step: 1, item: "Escrow opened (Escrow.com or marketplace escrow); buyer funds secured", owner: "both" },
      { step: 2, item: "GitHub: transfer repository to buyer account (Settings > Transfer)", owner: "seller" },
      { step: 3, item: "Netlify: transfer site to buyer team, buyer re-enters env vars", owner: "seller" },
      { step: 4, item: `GA4: add buyer as Administrator on property ${state.analytics.ga4MeasurementId || ""}, then remove seller`.trim(), owner: "seller" },
      { step: 5, item: `Search Console: add buyer as Owner on ${state.analytics.gscProperty || "property"}, then remove seller`, owner: "seller" },
      { step: 6, item: "Affiliate programs: buyer applies under own name and swaps AFFILIATE_<SLUG>_URL_TEMPLATE values (accounts usually do not transfer)", owner: "buyer" },
      { step: 7, item: "Ads: buyer sets own AdSense/Journey publisher ID (ad accounts do not transfer)", owner: "buyer" },
      { step: 8, item: "Email: export list + automations, import to buyer's provider", owner: "seller" },
      { step: 9, item: "Social: transfer handles / add buyer as admin; hand over SiteGrow drafts export", owner: "seller" },
      { step: 10, item: `Domain LAST: unlock ${d}, send auth code / registrar push to buyer`, owner: "seller" },
      { step: 11, item: "Buyer confirms all assets received; escrow releases funds", owner: "both" },
    ],
    howToRunSop: [
      "Weekly: publish 2-3 guides within the word window (max 1,500 words), each with one calculator link and one partner /go link.",
      "Weekly: review SiteGrow drafts and approve social posts.",
      "Monthly: record traffic snapshot (GA4 sessions/users/pageviews, GSC clicks/impressions) and all ledger rows with payout proof.",
      "Monthly: refresh city market pages with new public data (Zillow Research, FHFA, Census, HUD).",
      "Monthly: log every site change in the change log.",
      "Quarterly: check affiliate terms and ad network thresholds (Journey at 1,000 Tier-1 sessions/30 days).",
    ],
    escrowSteps: [
      "Agree price, assets and transition period (e.g. 30 days support) in a written APA.",
      "Open escrow; buyer funds escrow.",
      "Seller transfers assets per checklist (domain last).",
      "Buyer inspection period; confirms receipt.",
      "Escrow releases funds to seller.",
    ],
    dataHistory: {
      snapshots: state.records.snapshots,
      ledger: state.records.ledger,
      changeLog: state.records.changeLog,
      pnl: state.records.snapshots.map((s) => ({ month: s.month, revenue: s.revenue, expenses: s.expenses, profit: s.profit })),
      totals: {
        revenue: round2(state.records.ledger.filter((l) => l.type === "revenue").reduce((a, l) => a + l.amount, 0)),
        expenses: round2(state.records.ledger.filter((l) => l.type === "expense").reduce((a, l) => a + l.amount, 0)),
      },
    },
    stages: state.stages,
  };
}

export function runHandoffStage(state: FlipState, now = new Date().toISOString()): FlipState {
  const pkg = buildHandoffPackage(state, now);
  const needs = state.stages.filter((s) => s.key !== "buyer_handoff" && s.status === "not_started").map((s) => `Run ${s.key} stage first`);
  setStage(state, "buyer_handoff", `Handoff package ready: ${pkg.assetList.length} assets, ${pkg.transferChecklist.length} transfer steps, ${pkg.dataHistory.snapshots.length} months of data.`, needs, now);
  return state;
}
