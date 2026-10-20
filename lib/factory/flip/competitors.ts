/**
 * Competitor crawler for flip pages: for a page keyword, find the top 3 ranking competitor URLs (SERP provider:
 * SERPER_API_KEY or BRAVE_SEARCH_API_KEY; or operator-supplied URLs), crawl each, and extract content weaknesses
 * (thin sections, missing questions, outdated info, weak CTAs, gaps) that the writer prompt is told to beat.
 * Never invents competitor domains: without a provider and without manual URLs it returns status "no_provider".
 * fetch + env are injectable so tests run offline.
 */
type Env = Record<string, string | undefined>;
type FetchLike = (url: string, init?: Record<string, unknown>) => Promise<{ ok: boolean; status: number; text(): Promise<string>; json(): Promise<unknown> }>;

export type CompetitorPage = {
  url: string; title: string; words: number; headings: string[]; questions: string[];
  years: number[]; hasCta: boolean; hasCalculator: boolean; fetched: boolean; error?: string;
};
export type CompetitorAnalysis = {
  keyword: string; provider: "serper" | "brave" | "manual" | "none";
  status: "ok" | "no_provider" | "search_failed";
  competitors: CompetitorPage[]; weaknesses: string[]; gaps: string[]; analyzedAt: string; detail?: string;
};

const SKIP_HOSTS = /(^|\.)(youtube\.com|facebook\.com|instagram\.com|tiktok\.com|pinterest\.com|reddit\.com|quora\.com|x\.com|twitter\.com|linkedin\.com|amazon\.com|flipradar\.co)$/i;

export function searchProvider(env: Env): { id: "serper" | "brave"; key: string } | null {
  if ((env.SERPER_API_KEY || "").trim()) return { id: "serper", key: env.SERPER_API_KEY!.trim() };
  if ((env.BRAVE_SEARCH_API_KEY || "").trim()) return { id: "brave", key: env.BRAVE_SEARCH_API_KEY!.trim() };
  return null;
}

export function pickTopUrls(urls: string[], n = 3): string[] {
  const out: string[] = []; const hosts = new Set<string>();
  for (const u of urls) {
    let h = ""; try { h = new URL(u).hostname.replace(/^www\./, ""); } catch { continue; }
    if (SKIP_HOSTS.test(h) || hosts.has(h)) continue;
    hosts.add(h); out.push(u); if (out.length >= n) break;
  }
  return out;
}

export async function searchTopUrls(keyword: string, env: Env, fetchImpl: FetchLike): Promise<string[]> {
  const p = searchProvider(env); if (!p) return [];
  if (p.id === "serper") {
    const r = await fetchImpl("https://google.serper.dev/search", { method: "POST", headers: { "X-API-KEY": p.key, "Content-Type": "application/json" }, body: JSON.stringify({ q: keyword, gl: "us", num: 10 }) });
    if (!r.ok) throw new Error(`Serper ${r.status}`);
    const d = (await r.json()) as { organic?: { link: string }[] };
    return pickTopUrls((d.organic || []).map((o) => o.link));
  }
  const r = await fetchImpl(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(keyword)}&count=10&country=us`, { headers: { "X-Subscription-Token": p.key, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Brave ${r.status}`);
  const d = (await r.json()) as { web?: { results?: { url: string }[] } };
  return pickTopUrls((d.web?.results || []).map((o) => o.url));
}

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, " ").trim();

export function parseCompetitorHtml(url: string, html: string): CompetitorPage {
  const body = html.replace(/<(script|style|noscript|nav|footer|header)[\s\S]*?<\/\1>/gi, " ");
  const title = strip((body.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]).slice(0, 200);
  const headings = [...body.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => strip(m[1])).filter(Boolean).slice(0, 60);
  const text = strip(body);
  const words = text ? text.split(" ").length : 0;
  const questions = [...headings.filter((h) => h.endsWith("?")), ...(text.match(/[A-Z][^.?!]{10,120}\?/g) || [])].slice(0, 40);
  const years = [...new Set((text.match(/\b20[0-2]\d\b/g) || []).map(Number))].sort();
  const hasCta = /(get started|sign up|try (it|our)|download|contact us|get (a|your) (quote|offer)|subscribe|book a call|start (now|free))/i.test(text);
  const hasCalculator = /<(input|form)\b/i.test(body) || /calculator/i.test(title);
  return { url, title, words, headings, questions, years, hasCta, hasCalculator, fetched: true };
}

/** Topics a strong page in this niche should cover; anything all three competitors miss is a gap. */
const TOPICS: [string, RegExp][] = [
  ["worked example with numbers", /example|e\.g\./i],
  ["FAQ section", /faq|frequently asked/i],
  ["repair / rehab cost estimating", /rehab|repair cost|renovation budget/i],
  ["holding and closing costs", /holding cost|closing cost/i],
  ["financing (hard money / private money)", /hard money|private money|lender/i],
  ["ARV and comps", /\barv\b|after repair value|comps|comparable/i],
  ["the 70% rule", /70%|70 percent/i],
  ["permits and local rules", /permit|zoning|code/i],
  ["risks and common mistakes", /mistake|risk|pitfall/i],
  ["taxes on flip profits", /capital gains|tax/i],
];

export function findWeaknesses(pages: CompetitorPage[], nowYear = new Date().getFullYear()): { weaknesses: string[]; gaps: string[] } {
  const weaknesses: string[] = [];
  for (const p of pages) {
    const host = (() => { try { return new URL(p.url).hostname.replace(/^www\./, ""); } catch { return p.url; } })();
    if (!p.fetched) { weaknesses.push(`${host}: could not be crawled (${p.error || "error"})`); continue; }
    if (p.words < 900) weaknesses.push(`${host}: thin content (${p.words} words)`);
    if (p.headings.length < 4) weaknesses.push(`${host}: few sections (${p.headings.length} headings), poorly structured`);
    if (p.questions.length < 3) weaknesses.push(`${host}: answers few reader questions (${p.questions.length})`);
    const latest = p.years.length ? Math.max(...p.years) : 0;
    if (latest && latest < nowYear - 1) weaknesses.push(`${host}: possibly outdated (latest year mentioned ${latest})`);
    if (!p.hasCta) weaknesses.push(`${host}: weak or missing call to action`);
  }
  const fetched = pages.filter((p) => p.fetched);
  const blob = fetched.map((p) => `${p.title} ${p.headings.join(" ")} ${p.questions.join(" ")}`);
  const gaps = fetched.length ? TOPICS.filter(([, re]) => blob.filter((b) => re.test(b)).length <= 1).map(([t]) => t) : [];
  return { weaknesses, gaps };
}

export async function analyzeCompetitors(keyword: string, opts: { env?: Env; fetchImpl?: FetchLike; manualUrls?: string[]; nowYear?: number } = {}): Promise<CompetitorAnalysis> {
  const env = opts.env || process.env; const f = (opts.fetchImpl || (fetch as unknown as FetchLike));
  const base = { keyword, analyzedAt: new Date().toISOString() };
  let urls = pickTopUrls(opts.manualUrls || []); let provider: CompetitorAnalysis["provider"] = urls.length ? "manual" : "none";
  if (!urls.length) {
    const p = searchProvider(env);
    if (!p) return { ...base, provider: "none", status: "no_provider", competitors: [], weaknesses: [], gaps: [], detail: "Set SERPER_API_KEY or BRAVE_SEARCH_API_KEY (or attach competitor URLs). Never invents domains." };
    provider = p.id;
    try { urls = await searchTopUrls(keyword, env, f); } catch (e) { return { ...base, provider, status: "search_failed", competitors: [], weaknesses: [], gaps: [], detail: String((e as Error).message) }; }
  }
  const competitors: CompetitorPage[] = [];
  for (const url of urls) {
    try {
      const r = await f(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FactoryResearch/1.0)" }, signal: AbortSignal.timeout(20_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      competitors.push(parseCompetitorHtml(url, (await r.text()).slice(0, 2_000_000)));
    } catch (e) {
      competitors.push({ url, title: "", words: 0, headings: [], questions: [], years: [], hasCta: false, hasCalculator: false, fetched: false, error: String((e as Error).message) });
    }
  }
  return { ...base, provider, status: urls.length ? "ok" : "search_failed", competitors, ...findWeaknesses(competitors, opts.nowYear) };
}

/** Prompt block handed to the writer so the page beats the top 3. Empty when no analysis is available. */
export function competitorPromptBlock(a?: CompetitorAnalysis | null): string {
  if (!a || a.status !== "ok" || !a.competitors.some((c) => c.fetched)) return "";
  const lines = [`Competitor research for "${a.keyword}" (top ${a.competitors.length} ranking pages):`];
  for (const c of a.competitors.filter((c) => c.fetched)) lines.push(`- ${c.url}: ${c.words} words; sections: ${c.headings.slice(0, 8).join(" | ") || "none"}`);
  if (a.weaknesses.length) lines.push("Their weaknesses (beat each one):", ...a.weaknesses.map((w) => `- ${w}`));
  if (a.gaps.length) lines.push("Topics they cover poorly or not at all (cover these well):", ...a.gaps.map((g) => `- ${g}`));
  const qs = [...new Set(a.competitors.flatMap((c) => c.questions))].slice(0, 12);
  if (qs.length) lines.push("Reader questions seen on competitor pages (answer them better in your FAQ):", ...qs.map((q) => `- ${q}`));
  lines.push("Do not copy competitor wording or name competitors. Use current information only; include a clear call to action to the site's free calculators.");
  return lines.join("\n");
}
