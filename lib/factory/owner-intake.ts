/**
 * Owner first-hand intake: the questions the factory asks every client owner, plus helpers that turn the
 * answers into draft copy, "[service] in [city]" page plans and an optional owner video.
 *
 * Every answer is optional. When an answer is missing the drafts keep a [bracketed] note for the operator;
 * nothing here invents years in business, jobs, towns, stories or license numbers.
 */

export type OwnerIntakeFieldKey =
  | "yearsInBusiness"
  | "commonJobs"
  | "serviceTowns"
  | "differentiator"
  | "customerStory"
  | "licenseInfo"
  | "ownerVideoUrl";

export type OwnerIntakeQuestion = {
  key: OwnerIntakeFieldKey;
  /** Short operator label (form field). */
  label: string;
  /** The question to ask the owner, in plain words. */
  question: string;
  /** Optional answers never block anything. */
  optional: boolean;
  area?: boolean;
};

export const OWNER_INTAKE_QUESTIONS: readonly OwnerIntakeQuestion[] = [
  {
    key: "yearsInBusiness",
    label: "Years in business",
    question: "How many years have you been doing this work (or what year did you start)?",
    optional: false,
  },
  {
    key: "commonJobs",
    label: "Most common jobs (one per line or comma-separated)",
    question: "What are the 3-5 jobs you do most often?",
    optional: false,
    area: true,
  },
  {
    key: "serviceTowns",
    label: "Service towns (e.g. Riverside, Corona, Ontario CA)",
    question: "Which towns or cities do you actually work in?",
    optional: false,
    area: true,
  },
  {
    key: "differentiator",
    label: "What makes them different (owner's words)",
    question: "What do you do differently from other companies your customers could call?",
    optional: false,
    area: true,
  },
  {
    key: "customerStory",
    label: "A real customer story",
    question: "Tell me about one real job you're proud of: what the problem was and how you fixed it. (No customer names unless they said it's OK.)",
    optional: false,
    area: true,
  },
  {
    key: "licenseInfo",
    label: "License / insurance info (optional)",
    question: "Optional: license type and number, and whether you're insured or bonded. Leave blank if it doesn't apply.",
    optional: true,
  },
  {
    key: "ownerVideoUrl",
    label: "Owner video URL (optional: YouTube, Vimeo or .mp4)",
    question: "Optional: a short phone video of you introducing the business (30-60 seconds). Send the YouTube/Vimeo link or the file.",
    optional: true,
  },
] as const;

export const OWNER_INTAKE_KEYS: readonly OwnerIntakeFieldKey[] = OWNER_INTAKE_QUESTIONS.map((q) => q.key);

export type OwnerFacts = {
  yearsInBusiness: string;
  commonJobs: string[];
  serviceTowns: string[];
  differentiator: string;
  customerStory: string;
  licenseInfo: string;
  ownerVideoUrl: string;
};

export type OwnerIntakeInput = Partial<Record<OwnerIntakeFieldKey, unknown>>;

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").slice(0, max);
}

/** "a, b\nc; d" -> ["a","b","c","d"] (deduped, trimmed, capped). */
export function splitList(value: unknown, maxItems = 12, maxLen = 80): string[] {
  if (Array.isArray(value)) value = value.join("\n");
  const raw = cleanText(value, 2000);
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n;]+|,(?!\s*[A-Z]{2}\b)/)) {
    const item = part.replace(/^[-*•\d.)\s]+/, "").trim().slice(0, maxLen);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Accepts "12", "12 years", "since 2009", "2009". Returns a phrase like "12 years" / "since 2009", or "". */
export function yearsPhrase(raw: string, now: Date = new Date()): string {
  const value = cleanText(raw, 60);
  if (!value) return "";
  const since = value.match(/\b(19[5-9]\d|20\d\d)\b/);
  if (since) {
    const year = Number(since[1]);
    if (year <= now.getFullYear()) return `since ${year}`;
  }
  const years = value.match(/^(\d{1,2})\+?\s*(?:years?|yrs?)?\.?$/i);
  if (years) {
    const n = Number(years[1]);
    if (n > 0) return `${n}${value.includes("+") ? "+" : ""} year${n === 1 ? "" : "s"}`;
  }
  return value;
}

export function ownerFactsFrom(input: OwnerIntakeInput): OwnerFacts {
  return {
    yearsInBusiness: cleanText(input.yearsInBusiness, 60),
    commonJobs: splitList(input.commonJobs),
    serviceTowns: splitList(input.serviceTowns, 25),
    differentiator: cleanText(input.differentiator, 600),
    customerStory: cleanText(input.customerStory, 1200),
    licenseInfo: cleanText(input.licenseInfo, 200),
    ownerVideoUrl: normalizeVideoUrl(input.ownerVideoUrl),
  };
}

/** Which owner questions still have no answer (for the operator view). */
export function missingOwnerAnswers(facts: OwnerFacts): OwnerIntakeQuestion[] {
  return OWNER_INTAKE_QUESTIONS.filter((q) => {
    if (q.optional) return false;
    const v = facts[q.key];
    return Array.isArray(v) ? v.length === 0 : !v;
  });
}

/** Store form: list fields are kept as newline-separated text. */
export function ownerFactsToStored(facts: OwnerFacts): Record<OwnerIntakeFieldKey, string> {
  return {
    yearsInBusiness: facts.yearsInBusiness,
    commonJobs: facts.commonJobs.join("\n"),
    serviceTowns: facts.serviceTowns.join("\n"),
    differentiator: facts.differentiator,
    customerStory: facts.customerStory,
    licenseInfo: facts.licenseInfo,
    ownerVideoUrl: facts.ownerVideoUrl,
  };
}

/* ------------------------------ owner video ------------------------------ */

/** Only https URLs survive; anything else is dropped (the video section then stays hidden). */
export function normalizeVideoUrl(raw: unknown): string {
  const value = cleanText(raw, 500);
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

export type OwnerVideoEmbed = { kind: "iframe"; src: string } | { kind: "file"; src: string };

/** YouTube / Vimeo -> privacy-friendly embed URL; direct .mp4/.webm/.mov -> <video>. Anything else -> null (hidden). */
export function ownerVideoEmbed(raw: unknown): OwnerVideoEmbed | null {
  const href = normalizeVideoUrl(raw);
  if (!href) return null;
  const url = new URL(href);
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const ytId = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : "");
  if (host === "youtu.be") {
    const id = ytId(url.pathname.split("/")[1]);
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = ytId(
      url.searchParams.get("v") || (["embed", "shorts", "live"].includes(parts[0]) ? parts[1] : "")
    );
    return id ? { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}` } : null;
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).find((p) => /^\d{5,12}$/.test(p));
    return id ? { kind: "iframe", src: `https://player.vimeo.com/video/${id}` } : null;
  }
  if (/\.(mp4|webm|mov)$/i.test(url.pathname)) return { kind: "file", src: href };
  return null;
}

/* --------------------------- service + city pages --------------------------- */

export type ServiceCityRow = {
  city: string;
  state: string;
  /** City Launch keyword for this town (the main job). */
  keyword: string;
  /** "[service] in [city]" page title the factory will generate. */
  title: string;
  /** Other jobs the page should cover (passed to City Launch as notes). */
  alsoCovers: string[];
};

function townParts(town: string, fallbackState: string): { city: string; state: string } {
  const m = town.match(/^(.*?)[,\s]+([A-Za-z]{2})$/);
  if (m && m[1].trim()) return { city: m[1].trim(), state: m[2].toUpperCase() };
  return { city: town.trim(), state: (fallbackState || "").toUpperCase() };
}

/**
 * One "[service] in [city]" page per service town (City Launch keeps one page per city).
 * The keyword is the owner's #1 job (or the niche); the other jobs ride along as notes so the page covers them.
 * Towns without a state are skipped when the client has no state either (never guessed).
 */
export function serviceCityPlan(input: {
  niche: string;
  state: string;
  city?: string;
  facts: OwnerFacts;
}): ServiceCityRow[] {
  const jobs = input.facts.commonJobs.length ? input.facts.commonJobs : input.niche ? [input.niche] : [];
  if (!jobs.length) return [];
  const [main, ...rest] = jobs;
  const rows: ServiceCityRow[] = [];
  const seen = new Set<string>();
  for (const town of input.facts.serviceTowns) {
    const { city, state } = townParts(town, input.state);
    if (!city || !/^[A-Z]{2}$/.test(state)) continue;
    const key = `${city.toLowerCase()}|${state}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ city, state, keyword: main, title: `${capitalize(main)} in ${city}, ${state}`, alsoCovers: rest });
  }
  return rows;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** City Launch CSV paste (city,state,keyword,notes). */
export function serviceCityCsv(rows: ServiceCityRow[]): string {
  if (!rows.length) return "";
  return [
    "city,state,keyword,notes",
    ...rows.map((r) =>
      [r.city, r.state, r.keyword, r.alsoCovers.length ? `Also cover: ${r.alsoCovers.join("; ")}` : ""].map(csvCell).join(",")
    ),
  ].join("\n");
}

export function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/* ------------------------------ prompt context ------------------------------ */

/** Owner-supplied facts as one plain line for LLM context (City Launch). Empty when nothing was answered. */
export function ownerFactsContext(facts: OwnerFacts): string {
  const years = yearsPhrase(facts.yearsInBusiness);
  return [
    years ? `In business ${years} (owner-supplied).` : "",
    facts.commonJobs.length ? `Most common jobs: ${facts.commonJobs.join(", ")}.` : "",
    facts.serviceTowns.length ? `Service towns: ${facts.serviceTowns.join(", ")}.` : "",
    facts.differentiator ? `What makes them different, in the owner's words: ${facts.differentiator}` : "",
    facts.customerStory ? `A real job the owner described: ${facts.customerStory}` : "",
    facts.licenseInfo ? `License / insurance (owner-supplied): ${facts.licenseInfo}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
