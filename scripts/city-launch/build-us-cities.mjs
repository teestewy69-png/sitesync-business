// Build lib/city-launch/us-cities.generated.ts from public-domain U.S. Census Bureau files.
//
// Sources (U.S. Government works, public domain - 17 U.S.C. 105):
//   1. 2024 Gazetteer Files, Places (national):
//      https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip
//      -> GEOID, name, internal point latitude / longitude
//   2. Vintage 2024 Population Estimates, cities and towns (SUB-EST2024):
//      https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv
//      -> July 1, 2024 population (SUMLEV 162 = incorporated place total), primary county (SUMLEV 157 parts)
//
// Usage (no keys):
//   node scripts/city-launch/build-us-cities.mjs <dir-with-2024_Gaz_place_national.txt-and-sub-est2024.csv> [minPop=1000]
// Re-run when the Census publishes a new vintage. Do not edit the generated file by hand.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = process.argv[2];
const MIN_POP = Number(process.argv[3] || 1000);
if (!dir) {
  console.error("usage: node scripts/city-launch/build-us-cities.mjs <census-dir> [minPop]");
  process.exit(1);
}

const STATES = {
  "01": ["AL", "Alabama"], "02": ["AK", "Alaska"], "04": ["AZ", "Arizona"], "05": ["AR", "Arkansas"],
  "06": ["CA", "California"], "08": ["CO", "Colorado"], "09": ["CT", "Connecticut"], "10": ["DE", "Delaware"],
  "11": ["DC", "District of Columbia"], "12": ["FL", "Florida"], "13": ["GA", "Georgia"], "15": ["HI", "Hawaii"],
  "16": ["ID", "Idaho"], "17": ["IL", "Illinois"], "18": ["IN", "Indiana"], "19": ["IA", "Iowa"],
  "20": ["KS", "Kansas"], "21": ["KY", "Kentucky"], "22": ["LA", "Louisiana"], "23": ["ME", "Maine"],
  "24": ["MD", "Maryland"], "25": ["MA", "Massachusetts"], "26": ["MI", "Michigan"], "27": ["MN", "Minnesota"],
  "28": ["MS", "Mississippi"], "29": ["MO", "Missouri"], "30": ["MT", "Montana"], "31": ["NE", "Nebraska"],
  "32": ["NV", "Nevada"], "33": ["NH", "New Hampshire"], "34": ["NJ", "New Jersey"], "35": ["NM", "New Mexico"],
  "36": ["NY", "New York"], "37": ["NC", "North Carolina"], "38": ["ND", "North Dakota"], "39": ["OH", "Ohio"],
  "40": ["OK", "Oklahoma"], "41": ["OR", "Oregon"], "42": ["PA", "Pennsylvania"], "44": ["RI", "Rhode Island"],
  "45": ["SC", "South Carolina"], "46": ["SD", "South Dakota"], "47": ["TN", "Tennessee"], "48": ["TX", "Texas"],
  "49": ["UT", "Utah"], "50": ["VT", "Vermont"], "51": ["VA", "Virginia"], "53": ["WA", "Washington"],
  "54": ["WV", "West Virginia"], "55": ["WI", "Wisconsin"], "56": ["WY", "Wyoming"],
};

// Consolidated / unified governments and odd legal names -> the name people search for.
const NAME_OVERRIDES = {
  "Urban Honolulu CDP": "Honolulu",
  "Nashville-Davidson metropolitan government (balance)": "Nashville",
  "Louisville/Jefferson County metro government (balance)": "Louisville",
  "Lexington-Fayette urban county": "Lexington",
  "Athens-Clarke County unified government (balance)": "Athens",
  "Augusta-Richmond County consolidated government (balance)": "Augusta",
  "Macon-Bibb County": "Macon",
  "Columbus city": "Columbus",
  "Butte-Silver Bow (balance)": "Butte",
  "Anaconda-Deer Lodge County": "Anaconda",
  "San Buenaventura (Ventura) city": "Ventura",
  "Boise City city": "Boise",
  "Indianapolis city (balance)": "Indianapolis",
  "Milford city (balance)": "Milford",
  "Carson City": "Carson City",
};

const LSAD_SUFFIX =
  /\s+(city and borough|municipality|consolidated government|unified government|metro government|metropolitan government|urban county|corporation|plantation|borough|village|city|town|township|CDP|comunidad|zona urbana)(\s+\(balance\))?$/i;

function cleanName(raw) {
  if (NAME_OVERRIDES[raw]) return NAME_OVERRIDES[raw];
  let name = raw.replace(/\s+\(balance\)$/i, "");
  name = name.replace(LSAD_SUFFIX, "");
  name = name.replace(/\s+County$/i, (m) => (/(unified|consolidated)/i.test(raw) ? "" : m));
  return name.trim();
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

const gaz = readFileSync(path.join(dir, "2024_Gaz_place_national.txt"), "utf8").split(/\r?\n/);
const coords = new Map();
for (const line of gaz.slice(1)) {
  if (!line.trim()) continue;
  const cols = line.split("\t").map((c) => c.trim());
  coords.set(cols[1], { lat: Number(cols[10]), lng: Number(cols[11]) });
}

// latin1: the Census CSV is ISO-8859-1 (e.g. "Española", "Cañon City").
const est = readFileSync(path.join(dir, "sub-est2024.csv"), "latin1").split(/\r?\n/);
const header = parseCsvLine(est[0]);
const col = (name) => header.indexOf(name);
const iSum = col("SUMLEV"), iSt = col("STATE"), iCo = col("COUNTY"), iPl = col("PLACE"), iName = col("NAME"), iPop = col("POPESTIMATE2024");

const countyNames = new Map(); // ss+ccc -> name
const placeParts = new Map(); // ss+ppppp -> [{county, pop}]
const places = [];
for (const line of est.slice(1)) {
  if (!line.trim()) continue;
  const c = parseCsvLine(line);
  const sum = c[iSum];
  if (sum === "050") countyNames.set(c[iSt] + c[iCo], c[iName]);
  else if (sum === "157") {
    const key = c[iSt] + c[iPl];
    if (!placeParts.has(key)) placeParts.set(key, []);
    placeParts.get(key).push({ county: c[iSt] + c[iCo], pop: Number(c[iPop]) });
  } else if (sum === "162") places.push({ st: c[iSt], pl: c[iPl], name: c[iName], pop: Number(c[iPop]) });
}

const rows = [];
let missingCoords = 0;
for (const p of places) {
  const state = STATES[p.st];
  if (!state) continue; // territories
  if (!(p.pop >= MIN_POP)) continue;
  const geoid = p.st + p.pl;
  const xy = coords.get(geoid);
  if (!xy || !Number.isFinite(xy.lat)) { missingCoords += 1; continue; }
  const parts = (placeParts.get(geoid) || []).sort((a, b) => b.pop - a.pop);
  const county = parts.length ? (countyNames.get(parts[0].county) || "") : "";
  rows.push({
    name: cleanName(p.name),
    st: state[0],
    pop: p.pop,
    lat: Math.round(xy.lat * 10000) / 10000,
    lng: Math.round(xy.lng * 10000) / 10000,
    county,
    geoid,
  });
}

// Unique (name, state): keep the larger place if two legal entities clean to the same name.
const byKey = new Map();
for (const r of rows) {
  const key = `${r.name.toLowerCase()}|${r.st}`;
  const prev = byKey.get(key);
  if (!prev || r.pop > prev.pop) byKey.set(key, r);
}
const final = [...byKey.values()].sort((a, b) => a.st.localeCompare(b.st) || b.pop - a.pop || a.name.localeCompare(b.name));

for (const r of final) {
  if (/[|\n]/.test(r.name) || /[|\n]/.test(r.county)) throw new Error(`bad char in ${r.name}`);
}

const lines = final.map((r) => `${r.name}|${r.st}|${r.pop}|${r.lat}|${r.lng}|${r.county}|${r.geoid}`);
const stateRows = Object.values(STATES).map(([abbr, name]) => `${abbr}|${name}`);
const out = `// GENERATED by scripts/city-launch/build-us-cities.mjs - do not edit by hand.
// U.S. Census Bureau public-domain data:
//   2024 Gazetteer Files (Places): internal point lat/lng
//   Vintage 2024 Population Estimates SUB-EST2024: July 1, 2024 population + primary county
// Incorporated places (plus Urban Honolulu CDP) in the 50 states + DC with population >= ${MIN_POP}.
// Row format: name|stateAbbr|population2024|lat|lng|primaryCounty (full Census name)|censusGeoid
export const US_CITIES_META = {
  source: "U.S. Census Bureau: 2024 Gazetteer Files (Places) + Vintage 2024 Population Estimates (SUB-EST2024)",
  license: "Public domain (U.S. Government work, 17 U.S.C. 105)",
  urls: [
    "https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip",
    "https://www2.census.gov/programs-surveys/popest/datasets/2020-2024/cities/totals/sub-est2024.csv",
  ],
  populationYear: 2024,
  minPopulation: ${MIN_POP},
  count: ${final.length},
} as const;

export const US_STATE_ROWS: readonly string[] = ${JSON.stringify(stateRows)};

export const US_CITY_ROWS: readonly string[] = [
${lines.map((l) => `  ${JSON.stringify(l)},`).join("\n")}
];
`;
const target = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "..", "lib", "city-launch", "us-cities.generated.ts");
writeFileSync(target, out);
console.log(`wrote ${final.length} cities (minPop ${MIN_POP}, skipped ${missingCoords} without coords) -> ${target}`);
