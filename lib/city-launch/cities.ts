/**
 * City Launch: real U.S. city dataset helpers (pure, data injected).
 *
 * The data is U.S. Census Bureau public-domain data generated into
 * `us-cities.generated.ts` by scripts/city-launch/build-us-cities.mjs.
 * Bind it with `getUsCityIndex()` from `./index`; tests import the generated rows directly.
 *
 * Erasable TypeScript only (type imports, no enums) so `node --test` can import it.
 */

export type UsCity = {
  /** URL slug, unique across the dataset: "<city>-<st>" e.g. "mesa-az". */
  slug: string;
  name: string;
  state: string;
  stateName: string;
  population: number;
  lat: number;
  lng: number;
  county: string;
  geoid: string;
  /** Census April 1, 2020 estimates base (0 when unknown). */
  pop2020: number;
};

export type CityIndex = {
  all: UsCity[];
  bySlug: Map<string, UsCity>;
  byState: Map<string, UsCity[]>;
  states: Map<string, string>;
  stateByName: Map<string, string>;
};

export const MAX_CITIES_PER_BATCH = 500;

export function slugifyCity(name: string, state: string): string {
  const base = `${name} ${state}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, 80);
}

export function createCityIndex(rows: readonly string[], stateRows: readonly string[]): CityIndex {
  const states = new Map<string, string>();
  const stateByName = new Map<string, string>();
  for (const row of stateRows) {
    const [abbr, name] = row.split("|");
    states.set(abbr, name);
    stateByName.set(name.toLowerCase(), abbr);
  }
  const all: UsCity[] = [];
  const bySlug = new Map<string, UsCity>();
  const byState = new Map<string, UsCity[]>();
  for (const row of rows) {
    const [name, state, pop, lat, lng, county, geoid, base] = row.split("|");
    const city: UsCity = {
      slug: slugifyCity(name, state),
      name,
      state,
      stateName: states.get(state) || state,
      population: Number(pop),
      lat: Number(lat),
      lng: Number(lng),
      county: county || "",
      geoid: geoid || "",
      pop2020: Number(base) || 0,
    };
    if (bySlug.has(city.slug)) continue;
    all.push(city);
    bySlug.set(city.slug, city);
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state)!.push(city);
  }
  for (const list of byState.values()) list.sort((a, b) => b.population - a.population);
  return { all, bySlug, byState, states, stateByName };
}

export function normalizeState(index: CityIndex, raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  if (index.states.has(upper)) return upper;
  return index.stateByName.get(value.toLowerCase()) || "";
}

function normName(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(city of|town of|village of)\s+/, "")
    .replace(/\b(saint)\b/g, "st")
    .replace(/\bst\.\s*/g, "st ")
    .replace(/\bft\.?\s/g, "fort ")
    .replace(/\bmt\.?\s/g, "mount ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Find a dataset city by name + state (abbr or full name). Case/accent/punctuation tolerant. */
export function findCity(index: CityIndex, name: string, state: string): UsCity | null {
  const st = normalizeState(index, state);
  if (!st) return null;
  const direct = index.bySlug.get(slugifyCity(name, st));
  if (direct) return direct;
  const target = normName(name);
  return (index.byState.get(st) || []).find((city) => normName(city.name) === target) || null;
}

const EARTH_MILES = 3958.8;

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Compass direction from a to b (8-point), used for honest local context ("east of Phoenix"). */
export function compassDirection(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const names = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"];
  return names[Math.round(bearing / 45) % 8];
}

export type PickedCity = UsCity & {
  /** Miles from the pick origin (radius mode) or from the client's city when known. */
  distanceMiles?: number;
  source: "dataset" | "csv";
  /** Optional per-row overrides from CSV paste (ScaleQuan columns). */
  keyword?: string;
  notes?: string;
};

export function topCitiesInStates(
  index: CityIndex,
  states: string[],
  limit: number,
  opts: { minPopulation?: number } = {}
): PickedCity[] {
  const wanted = [...new Set(states.map((s) => normalizeState(index, s)).filter(Boolean))];
  const min = opts.minPopulation || 0;
  const pool = wanted.flatMap((st) => index.byState.get(st) || []).filter((c) => c.population >= min);
  pool.sort((a, b) => b.population - a.population || a.slug.localeCompare(b.slug));
  return pool.slice(0, clampLimit(limit)).map((c) => ({ ...c, source: "dataset" as const }));
}

export function citiesWithinMiles(
  index: CityIndex,
  origin: { lat: number; lng: number },
  miles: number,
  limit: number,
  opts: { minPopulation?: number; includeOrigin?: boolean; originSlug?: string; order?: "population" | "distance" } = {}
): PickedCity[] {
  const radius = Math.max(1, Math.min(500, Number(miles) || 0));
  const min = opts.minPopulation || 0;
  const hits: PickedCity[] = [];
  // Cheap bounding box before haversine.
  const dLat = radius / 69;
  const dLng = radius / (69 * Math.max(0.2, Math.cos((origin.lat * Math.PI) / 180)));
  for (const city of index.all) {
    if (Math.abs(city.lat - origin.lat) > dLat || Math.abs(city.lng - origin.lng) > dLng) continue;
    if (city.population < min) continue;
    if (!opts.includeOrigin && opts.originSlug && city.slug === opts.originSlug) continue;
    const d = haversineMiles(origin, city);
    if (d <= radius) hits.push({ ...city, distanceMiles: Math.round(d * 10) / 10, source: "dataset" });
  }
  if (opts.order === "distance") hits.sort((a, b) => (a.distanceMiles || 0) - (b.distanceMiles || 0));
  else hits.sort((a, b) => b.population - a.population || (a.distanceMiles || 0) - (b.distanceMiles || 0));
  return hits.slice(0, clampLimit(limit));
}

/** k nearest cities to `city` from `pool` (excluding itself), each with miles + compass direction. */
export function nearestCities<T extends { slug: string; lat: number; lng: number }>(
  city: { slug: string; lat: number; lng: number },
  pool: T[],
  k: number
): Array<T & { distanceMiles: number; direction: string }> {
  return pool
    .filter((c) => c.slug !== city.slug && Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map((c) => ({
      ...c,
      distanceMiles: Math.round(haversineMiles(city, c) * 10) / 10,
      direction: compassDirection(city, c),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles)
    .slice(0, Math.max(0, k));
}

function clampLimit(limit: number): number {
  const n = Math.floor(Number(limit) || 0);
  return Math.max(1, Math.min(MAX_CITIES_PER_BATCH, n || MAX_CITIES_PER_BATCH));
}

/* ----------------------------- CSV paste ------------------------------ */

export function parseCsvRecords(csvText: string): string[][] {
  const text = String(csvText || "").replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === "," || ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
    } else if (ch !== "\r") field += ch;
  }
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

export type CsvPasteIssue = { row: number; input: string; message: string };
export type CsvPasteResult = { cities: PickedCity[]; issues: CsvPasteIssue[]; duplicates: number; truncated: number };

const HEADER_ALIASES: Record<string, "city" | "state" | "keyword" | "notes" | "slug"> = {
  city: "city",
  city_name: "city",
  name: "city",
  state: "state",
  st: "state",
  state_abbr: "state",
  keyword: "keyword",
  primary_keyword: "keyword",
  notes: "notes",
  competitor_gaps: "notes",
  website_content: "notes",
  slug: "slug",
};

/**
 * Parse pasted rows. Accepts the ScaleQuan template (city,state,keyword,competitor_gaps,website_content),
 * the remix City Launch CSV (city,state,slug,...), or bare "City, ST" lines.
 * Cities are matched against the Census dataset (real coordinates/population). Unmatched cities are kept
 * only when a valid state is given (flagged source "csv", no coordinates) - never invented.
 */
export function parseCityPaste(index: CityIndex, text: string): CsvPasteResult {
  const records = parseCsvRecords(text);
  const issues: CsvPasteIssue[] = [];
  const out: PickedCity[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  if (!records.length) return { cities: [], issues: [{ row: 0, input: "", message: "Nothing to parse." }], duplicates, truncated: 0 };

  const headerKeys = records[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_")]);
  const hasHeader = headerKeys.includes("city");
  const col = (key: string) => (hasHeader ? headerKeys.indexOf(key as never) : key === "city" ? 0 : key === "state" ? 1 : key === "keyword" ? 2 : -1);
  const body = hasHeader ? records.slice(1) : records;
  const notesCols = hasHeader
    ? headerKeys.map((k, i) => (k === "notes" ? i : -1)).filter((i) => i >= 0)
    : [];

  body.forEach((cells, i) => {
    const rowNo = i + (hasHeader ? 2 : 1);
    let city = (cells[col("city")] || "").trim();
    let state = col("state") >= 0 ? (cells[col("state")] || "").trim() : "";
    if (!state && /\s[A-Za-z]{2}$/.test(city)) {
      state = city.slice(-2);
      city = city.slice(0, -3).trim();
    }
    const keyword = col("keyword") >= 0 ? (cells[col("keyword")] || "").trim() : "";
    const notes = notesCols.map((c) => (cells[c] || "").trim()).filter(Boolean).join(" | ");
    const input = cells.join(", ");
    if (!city) {
      issues.push({ row: rowNo, input, message: "Missing city." });
      return;
    }
    const st = normalizeState(index, state);
    if (!st) {
      issues.push({ row: rowNo, input, message: `Missing or unknown state "${state}".` });
      return;
    }
    const match = findCity(index, city, st);
    const picked: PickedCity = match
      ? { ...match, source: "dataset", keyword: keyword || undefined, notes: notes || undefined }
      : {
          slug: slugifyCity(city, st),
          name: city.replace(/\s+/g, " "),
          state: st,
          stateName: index.states.get(st) || st,
          population: 0,
          lat: Number.NaN,
          lng: Number.NaN,
          county: "",
          geoid: "",
          pop2020: 0,
          source: "csv",
          keyword: keyword || undefined,
          notes: notes || undefined,
        };
    if (!match) {
      issues.push({
        row: rowNo,
        input,
        message: `"${city}, ${st}" is not in the Census incorporated-place dataset (pop >= 1,000). Kept without coordinates/population; nearby-city context will be limited.`,
      });
    }
    if (seen.has(picked.slug)) {
      duplicates += 1;
      return;
    }
    seen.add(picked.slug);
    out.push(picked);
  });
  const truncated = Math.max(0, out.length - MAX_CITIES_PER_BATCH);
  return { cities: out.slice(0, MAX_CITIES_PER_BATCH), issues, duplicates, truncated };
}
