import { readDoc, writeDoc } from "@/lib/persistence";
import { safeFetchText, type SafeFetchResult } from "@/lib/siteflow/safe-fetch";
import { visibleText } from "@/lib/siteflow/generators/seo-audit";

/**
 * The City Launch research agent — the Firecrawl concept pointed at the writers' oldest gap.
 *
 * The writer prompts have always had a VERIFIED LOCAL NOTES slot (settings.localFacts): the one
 * place local facts (neighborhoods, landmarks, history, housing, regulations) may come from, and
 * the honesty gate blocks any such claim that is not backed by it. But the slot was
 * operator-supplied — a human was expected to research and paste notes in by hand, so in
 * practice it sat empty and the writers wrote blind from Census numbers alone.
 *
 * This agent fills the slot the way Firecrawl would: crawl/scrape real sources per city and
 * extract sourced notes.
 *   1. Wikipedia's plain-text extract for "<City>, <State>" — lede plus the sections that carry
 *      local substance (history, geography, neighborhoods, landmarks, economy, education…).
 *   2. The city's official website, found in the article's infobox wikitext, scraped for how
 *      the city describes itself.
 * Every note keeps its source URL, briefs are cached per city for 90 days, and any failure
 * returns null so generation proceeds exactly as it did before — never worse, usually richer.
 */

export type CityResearchBrief = {
  city: string;
  state: string;
  /** Sourced notes, ready to merge into the VERIFIED LOCAL NOTES prompt block. */
  notes: string;
  sources: string[];
  gatheredAt: string;
};

export type ResearchFetcher = (
  url: string,
  opts?: { timeoutMs?: number; maxBytes?: number }
) => Promise<SafeFetchResult>;

export type ResearchCity = { name: string; state: string; stateName: string };

const WIKI_API = "https://en.wikipedia.org/w/api.php";
const CACHE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
/** Combined cap for operator notes + researched notes in one prompt (operator notes go first). */
export const MERGED_LOCAL_FACTS_CAP = 6000;
const NOTES_BODY_CAP = 4200;
const LEDE_CAP = 900;
const SECTION_CAP = 550;
const SECTION_RE = /neighborhood|landmark|points of interest|history|geography|economy|education|transportation|culture|demographics/i;

function wikiApiUrl(params: Record<string, string>): string {
  const qs = new URLSearchParams({ format: "json", formatversion: "2", ...params });
  return `${WIKI_API}?${qs.toString()}`;
}

function sentences(text: string, cap: number): string[] {
  // Protect common abbreviations first, or the splitter cuts "Mt. San Antonio College"
  // and "U.S. Census" into fragments.
  const clean = text
    .replace(/\s+/g, " ")
    .replace(/\bU\.S\.A?\./g, "US")
    .replace(/\b(?:Mt|St|Dr|Ave|Blvd|Rd|No)\./g, (m) => m.slice(0, -1))
    .trim();
  const found = clean.match(/[^.!?]+[.!?]+/g) || [];
  const out: string[] = [];
  let used = 0;
  for (const raw of found) {
    const s = raw.trim();
    if (s.length < 40 || s.length > 340) continue;
    if (/citation needed|may not|disambiguation/i.test(s)) continue;
    if (used + s.length > cap) break;
    out.push(s);
    used += s.length;
  }
  return out;
}

const KNOWN_SECTIONS = new Set(
  [
    "history", "geography", "demographics", "economy", "education", "transportation", "culture",
    "government", "neighborhoods", "landmarks", "points of interest", "climate", "parks and recreation",
    "notable people", "sports", "infrastructure", "communities", "overview", "etymology", "setting",
    "location", "environment", "media", "tourism", "arts and culture", "religion", "healthcare",
    "public safety", "utilities", "name",
  ].map((s) => s.toLowerCase())
);

/**
 * Split a plain-text Wikipedia extract into sections; the lede is title "". Headers arrive in
 * two shapes: "== History ==" (wiki format) or a bare title line (exsectionformat=plain) — a
 * bare line counts only when it names a well-known section, so prose lines never split.
 */
export function extractSections(extract: string): { title: string; body: string }[] {
  const sections: { title: string; body: string }[] = [{ title: "", body: "" }];
  for (const line of extract.split("\n")) {
    const trimmed = line.trim();
    const eq = /^=+\s*(.+?)\s*=+\s*$/.exec(trimmed);
    const title = eq ? eq[1].trim() : KNOWN_SECTIONS.has(trimmed.toLowerCase()) ? trimmed : null;
    if (title) sections.push({ title, body: "" });
    else {
      const current = sections[sections.length - 1];
      current.body += (current.body ? "\n" : "") + line;
    }
  }
  return sections;
}

/** Compose the sourced notes body from a Wikipedia extract (pure; unit-tested). */
export function composeNotes(city: ResearchCity, extract: string, wikiUrl: string, official?: { url: string; text: string } | null): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const push = (label: string, sents: string[]) => {
    const fresh = sents.filter((s) => !seen.has(s.toLowerCase().slice(0, 60)));
    if (!fresh.length) return;
    fresh.forEach((s) => seen.add(s.toLowerCase().slice(0, 60)));
    lines.push(label ? `${label}: ${fresh.join(" ")}` : fresh.join(" "));
  };
  for (const section of extractSections(extract)) {
    if (lines.join("\n").length >= NOTES_BODY_CAP) break;
    if (section.title === "") push("", sentences(section.body, LEDE_CAP));
    else if (SECTION_RE.test(section.title)) push(section.title, sentences(section.body, SECTION_CAP));
  }
  let body = lines.join("\n");
  if (body.length > NOTES_BODY_CAP) body = body.slice(0, NOTES_BODY_CAP).replace(/\s+\S*$/, "");
  const out = [
    `Researched local notes for ${city.name}, ${city.state} (from Wikipedia, ${wikiUrl}):`,
    body,
  ];
  if (official) {
    out.push(`The city's official website (${official.url}) presents the city this way: ${official.text}`);
  }
  out.push(`Sources: ${wikiUrl}${official ? `; ${official.url}` : ""}`);
  return out.join("\n");
}

async function fetchJson(fetcher: ResearchFetcher, url: string): Promise<Record<string, unknown> | null> {
  const res = await fetcher(url, { timeoutMs: 10_000, maxBytes: 4_000_000 });
  if (!res.ok || !res.body) return null;
  try {
    return JSON.parse(res.body) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function firstPage(json: Record<string, unknown> | null): Record<string, unknown> | null {
  const query = json?.query as Record<string, unknown> | undefined;
  const pages = query?.pages as Record<string, unknown>[] | undefined;
  const page = Array.isArray(pages) ? pages[0] : null;
  return page && typeof page === "object" ? (page as Record<string, unknown>) : null;
}

/** Gather a fresh brief for one city. Returns null when no usable source answers. Never throws. */
export async function gatherCityResearch(
  city: ResearchCity,
  fetcher: ResearchFetcher = safeFetchText
): Promise<CityResearchBrief | null> {
  try {
    const title = `${city.name}, ${city.stateName}`;
    const extractJson = await fetchJson(
      fetcher,
      wikiApiUrl({ action: "query", prop: "extracts", explaintext: "1", exsectionformat: "plain", redirects: "1", titles: title })
    );
    const page = firstPage(extractJson);
    const extract = typeof page?.extract === "string" ? page.extract : "";
    if (!page || page.missing === true || extract.trim().length < 200) return null;
    const canonicalTitle = typeof page.title === "string" ? page.title : title;
    const wikiUrl = `https://en.wikipedia.org/wiki/${encodeURI(canonicalTitle.replace(/\s+/g, "_"))}`;

    // Best-effort second source: the official city website from the infobox wikitext.
    let official: { url: string; text: string } | null = null;
    try {
      const wikiJson = await fetchJson(
        fetcher,
        wikiApiUrl({ action: "query", prop: "revisions", rvprop: "content", rvsection: "0", redirects: "1", titles: title })
      );
      const revPage = firstPage(wikiJson);
      const revisions = revPage?.revisions as Record<string, unknown>[] | undefined;
      const wikitext = typeof revisions?.[0]?.content === "string" ? (revisions[0].content as string) : "";
      const siteMatch = /\|\s*website\s*=\s*(?:\{\{\s*(?:URL|url)\s*\|\s*)?(https?:\/\/[^\s|}]+)/i.exec(wikitext);
      if (siteMatch) {
        const siteUrl = siteMatch[1].replace(/\/$/, "");
        const home = await fetcher(siteUrl, { timeoutMs: 8_000, maxBytes: 1_000_000 });
        if (home.ok && home.body) {
          const titleText = /<title[^>]*>([^<]+)<\/title>/i.exec(home.body)?.[1]?.trim() || "";
          // The meta description is the city's own one-line summary; raw page text is mostly
          // navigation links, so it is only the fallback.
          const metaDesc =
            /<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i.exec(home.body)?.[1]?.trim() ||
            /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["']/i.exec(home.body)?.[1]?.trim() ||
            "";
          let bodyText = metaDesc || visibleText(home.body);
          // visibleText includes the <title> text; don't say the name twice.
          if (!metaDesc && titleText && bodyText.toLowerCase().startsWith(titleText.toLowerCase())) {
            bodyText = bodyText.slice(titleText.length).trim();
          }
          const text = [titleText, bodyText.slice(0, 420)].filter(Boolean).join(" — ");
          if (text.length >= 40) official = { url: siteUrl, text };
        }
      }
    } catch {
      official = null; // the Wikipedia brief stands on its own
    }

    return {
      city: city.name,
      state: city.state,
      notes: composeNotes(city, extract, wikiUrl, official),
      sources: official ? [wikiUrl, official.url] : [wikiUrl],
      gatheredAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function cacheKey(city: ResearchCity): string {
  const slug = `${city.state}-${city.name}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return `city-launch/research/${slug}`;
}

/** Cached brief for a city (90-day TTL), gathering fresh when stale or absent. Never throws. */
export async function getCityResearch(city: ResearchCity): Promise<CityResearchBrief | null> {
  try {
    const key = cacheKey(city);
    const cached = (await readDoc<CityResearchBrief>(key).catch(() => null))?.value;
    if (cached && Date.now() - Date.parse(cached.gatheredAt) < CACHE_TTL_MS && cached.notes) return cached;
    const fresh = await gatherCityResearch(city);
    if (fresh) await writeDoc(key, fresh).catch(() => undefined);
    return fresh ?? cached ?? null;
  } catch {
    return null;
  }
}

/** Operator notes first (they outrank research), then the agent's brief, capped for the prompt. */
export function mergeResearchNotes(operatorNotes: string | undefined, brief: CityResearchBrief | null): string {
  const parts = [(operatorNotes || "").trim(), brief?.notes || ""].filter(Boolean);
  return parts.join("\n\n").slice(0, MERGED_LOCAL_FACTS_CAP);
}
