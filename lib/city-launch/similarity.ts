/**
 * City Launch quality gate: near-duplicate detection across a client's city pages.
 *
 * Why masking: a find-and-replace clone ("Plumbing in Mesa" -> "Plumbing in Tempe") differs only in place
 * names and numbers. Before comparing, every place name the batch knows about (the page's own city, state,
 * county, and every other city in the client's launch) is replaced with one token and digits are collapsed.
 * Clones then become identical (score 1.0) while genuinely local copy stays far apart.
 *
 * Score = overlap coefficient of 5-word shingles: |A ∩ B| / min(|A|, |B|). It also catches a short page
 * that reuses most of a longer page. Exact (sorted-array merge), no sampling.
 *
 * Pure + erasable TypeScript so `node --test` can import it.
 */

export const SHINGLE_SIZE = 5;
/** Pages at or above this score against any other page are blocked from approval/publishing. */
export const DEFAULT_BLOCK_THRESHOLD = 0.35;
/** Pages at or above this score are flagged for a closer human look (approval still allowed). */
export const DEFAULT_WARN_THRESHOLD = 0.18;

export type SimilarityInput = {
  slug: string;
  text: string;
  /** Place names to mask for this page (own city, state, county). Batch-wide names are added automatically. */
  maskTerms?: string[];
};

export type SimilarityResult = {
  slug: string;
  maxScore: number;
  nearestSlug: string | null;
  status: "pass" | "warn" | "block";
  shingles: number;
};

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildMasker(terms: string[]): (text: string) => string {
  const clean = [...new Set(terms.map((t) => t.trim().toLowerCase()).filter((t) => t.length >= 2))].sort(
    (a, b) => b.length - a.length
  );
  if (!clean.length) return (text) => text;
  // Chunk the alternation so 500+ city names stay well within regex limits.
  const chunks: RegExp[] = [];
  for (let i = 0; i < clean.length; i += 200) {
    chunks.push(new RegExp(`\\b(?:${clean.slice(i, i + 200).map(escapeRe).join("|")})\\b`, "g"));
  }
  return (text) => chunks.reduce((acc, re) => acc.replace(re, " zplace "), text);
}

export function normalizeForSimilarity(text: string, mask: (text: string) => string = (t) => t): string[] {
  const plain = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "");
  const masked = mask(plain).replace(/[0-9][0-9,.]*/g, " znum ");
  return masked.split(/[^a-z]+/).filter(Boolean);
}

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function shingleSet(tokens: string[], k = SHINGLE_SIZE): Uint32Array {
  const set = new Set<number>();
  if (tokens.length < k) {
    if (tokens.length) set.add(fnv1a(tokens.join(" ")));
  } else {
    for (let i = 0; i + k <= tokens.length; i += 1) set.add(fnv1a(tokens.slice(i, i + k).join(" ")));
  }
  return Uint32Array.from(set).sort();
}

function intersectionSize(a: Uint32Array, b: Uint32Array): number {
  let i = 0;
  let j = 0;
  let n = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      n += 1;
      i += 1;
      j += 1;
    } else if (a[i] < b[j]) i += 1;
    else j += 1;
  }
  return n;
}

export function overlapScore(a: Uint32Array, b: Uint32Array): number {
  const min = Math.min(a.length, b.length);
  if (!min) return 0;
  return intersectionSize(a, b) / min;
}

export function jaccardScore(a: Uint32Array, b: Uint32Array): number {
  const inter = intersectionSize(a, b);
  const union = a.length + b.length - inter;
  return union ? inter / union : 0;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type UniquenessOptions = {
  blockThreshold?: number;
  warnThreshold?: number;
  /** Extra names masked on every page (all city names in the client's launch, the client's base city...). */
  globalMaskTerms?: string[];
  /** Only (re)score these slugs against everything (incremental check after an edit/regenerate). */
  onlySlugs?: string[];
};

/**
 * Score every page against every other page (or only `onlySlugs` against all).
 * Returns per-page max score + nearest neighbour + gate status.
 */
export function checkUniqueness(pages: SimilarityInput[], opts: UniquenessOptions = {}): SimilarityResult[] {
  const block = opts.blockThreshold ?? DEFAULT_BLOCK_THRESHOLD;
  const warn = opts.warnThreshold ?? DEFAULT_WARN_THRESHOLD;
  const global = opts.globalMaskTerms || [];
  const globalMask = buildMasker(global);
  const sets = pages.map((page) => {
    const own = buildMasker(page.maskTerms || []);
    return shingleSet(normalizeForSimilarity(page.text, (t) => globalMask(own(t))));
  });
  const only = opts.onlySlugs ? new Set(opts.onlySlugs) : null;
  const best = pages.map(() => ({ score: 0, nearest: -1 }));
  for (let i = 0; i < pages.length; i += 1) {
    for (let j = i + 1; j < pages.length; j += 1) {
      if (only && !only.has(pages[i].slug) && !only.has(pages[j].slug)) continue;
      const s = overlapScore(sets[i], sets[j]);
      if (s > best[i].score) best[i] = { score: s, nearest: j };
      if (s > best[j].score) best[j] = { score: s, nearest: i };
    }
  }
  return pages
    .map((page, i) => {
      const score = round3(best[i].score);
      return {
        slug: page.slug,
        maxScore: score,
        nearestSlug: best[i].nearest >= 0 ? pages[best[i].nearest].slug : null,
        status: (score >= block ? "block" : score >= warn ? "warn" : "pass") as SimilarityResult["status"],
        shingles: sets[i].length,
      };
    })
    .filter((r) => !only || only.has(r.slug));
}
