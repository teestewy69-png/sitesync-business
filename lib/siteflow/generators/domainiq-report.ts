/** DomainIQ domain report adapter: lib/domainiq engine + keyless availability, rendered to standalone HTML. */
import { discoverClientDomains } from "@/lib/factory/domainiq";
import { DOMAINIQ_ENGINE_VERSION } from "@/lib/domainiq";
import { affiliateDisclosureText, outboundHref, REGISTRAR_SLUGS } from "@/lib/affiliates";
import { checkDomainsAvailability } from "@/lib/domainiq/availability";
import type { AvailabilityResult, ClientDomainCandidate } from "@/lib/domainiq/client";
import { esc, reportDocument } from "../html";
import { NonRetryableError } from "./errors";
import { formatTldPrice, getPorkbunTldPrices, type TldPriceTable } from "./domainiq-pricing";

export type DomainReportInput = { businessName?: string; niche?: string; city?: string; state?: string };

/** Raw buyer inputs plus the compact seed tokens the client bridge derived from them. */
export type ReportSeed = {
  businessName: string;
  niche: string;
  city: string;
  state: string;
  cityToken: string;
  nicheKeyword: string;
  businessToken: string;
  distinctiveToken: string;
};

/* ------------------------- measured per-name rationale ------------------------ */

export type RationaleFact = { text: string; tone: "pro" | "con" | "fact" };

const SUBSCORE_LABELS: Array<[keyof ClientDomainCandidate["subScores"], string]> = [
  ["brandability", "brandability"],
  ["commercial_value", "commercial value"],
  ["market_demand", "market demand"],
  ["domain_quality", "domain quality"],
  ["flip_potential", "flip potential"],
];

/** The candidate's strongest engine sub-score (risk_penalty excluded - it is not a strength). */
export function strongestSubScore(c: ClientDomainCandidate): { label: string; value: number } | null {
  let best: { label: string; value: number } | null = null;
  for (const [key, label] of SUBSCORE_LABELS) {
    const value = c.subScores?.[key];
    if (typeof value === "number" && (!best || value > best.value)) best = { label, value };
  }
  return best;
}

const fmtScore = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

/**
 * Rationale computed from the candidate's own measurable properties - label
 * length (bands mirror the engine's scoring lengths: short <=8, ideal <=12,
 * long >=15, extreme >=19), TLD, seed-keyword containment, hyphen/digit/
 * double-letter presence, vowel share and consonant runs, plural ending, and
 * the engine's strongest sub-score. Nothing here is asserted that is not
 * measured from the candidate or the buyer's own inputs.
 */
export function candidateRationale(c: ClientDomainCandidate, seed: ReportSeed): RationaleFact[] {
  const facts: RationaleFact[] = [];
  const label = c.label.toLowerCase();
  const len = label.length;

  if (len <= 8) facts.push({ text: `short - ${len} characters`, tone: "pro" });
  else if (len <= 12) facts.push({ text: `compact - ${len} characters`, tone: "pro" });
  else if (len >= 19) facts.push({ text: `very long - ${len} characters, hard to type from memory`, tone: "con" });
  else if (len >= 15) facts.push({ text: `long - ${len} characters`, tone: "con" });
  else facts.push({ text: `${len} characters`, tone: "fact" });

  if (c.tld === "com") facts.push({ text: ".com - the ending customers type by default", tone: "pro" });
  else facts.push({ text: `.${c.tld} ending - not the .com customers default to`, tone: "fact" });

  if (seed.cityToken.length >= 3 && label.includes(seed.cityToken)) {
    facts.push({ text: `includes your city (${seed.city})`, tone: "pro" });
  }
  if (seed.nicheKeyword.length >= 3 && label.includes(seed.nicheKeyword)) {
    facts.push({ text: `includes your trade keyword "${seed.nicheKeyword}"`, tone: "pro" });
  }
  if (seed.distinctiveToken.length >= 3 && label.includes(seed.distinctiveToken)) {
    facts.push({ text: "built from your business name", tone: "pro" });
  }
  if (c.source === "local") facts.push({ text: "from the local pass (city + trade)", tone: "fact" });
  if (c.source === "brand") facts.push({ text: "from the brandable pass", tone: "fact" });

  if (label.includes("-")) {
    facts.push({ text: "has a hyphen - often dropped when the name is spoken", tone: "con" });
  }
  if (/[0-9]/.test(label)) {
    facts.push({ text: "contains a digit - you will have to spell it out on the phone", tone: "con" });
  }
  const doubled = label.match(/([a-z])\1/);
  if (doubled) {
    facts.push({ text: `double "${doubled[1]}" - a common mistype spot`, tone: "con" });
  }
  const letters = label.replace(/[^a-z]/g, "");
  if (letters.length >= 5) {
    const cluster = letters.match(/[^aeiou]{4,}/);
    const vowels = (letters.match(/[aeiou]/g) || []).length;
    if (cluster) {
      facts.push({ text: `"${cluster[0]}" is a consonant cluster - harder to say in one breath`, tone: "con" });
    } else if (vowels / letters.length < 0.22) {
      facts.push({ text: `few vowels (${vowels} of ${letters.length} letters) - harder to say out loud`, tone: "con" });
    }
  }
  if (label.endsWith("s") && !label.endsWith("ss")) {
    facts.push({ text: `ends in "s" - customers may drop it (plural confusion)`, tone: "con" });
  }

  const sub = strongestSubScore(c);
  if (sub) facts.push({ text: `strongest sub-score: ${sub.label} (${fmtScore(sub.value)}/100)`, tone: "fact" });
  return facts;
}

/* ------------------------------- variants ---------------------------------- */

export type VariantKind = "other_tld" | "plural" | "singular" | "hyphen" | "spelling";
export type DomainVariant = { domain: string; kind: VariantKind };

const MAJOR_TLDS = ["com", "net", "org"];
const MAX_VARIANTS_PER_CANDIDATE = 6;

/**
 * Look-alike variants of a candidate, derived transparently: the same label on
 * the other major TLDs, the plural/singular toggle, hyphenation at a seed-token
 * boundary, and spelling simplifications (double letter, "ph" -> "f") when the
 * label actually contains those patterns.
 */
export function domainVariants(c: ClientDomainCandidate, seed: ReportSeed): DomainVariant[] {
  const label = c.label.toLowerCase();
  const out: DomainVariant[] = [];
  const seen = new Set<string>([c.domain.toLowerCase()]);
  const add = (domain: string, kind: VariantKind) => {
    const d = domain.toLowerCase();
    if (seen.has(d) || out.length >= MAX_VARIANTS_PER_CANDIDATE) return;
    seen.add(d);
    out.push({ domain: d, kind });
  };

  for (const tld of MAJOR_TLDS) {
    if (tld !== c.tld) add(`${label}.${tld}`, "other_tld");
  }
  if (label.endsWith("s") && !label.endsWith("ss") && label.length > 4) {
    add(`${label.slice(0, -1)}.${c.tld}`, "singular");
  } else if (!label.endsWith("s")) {
    add(`${label}s.${c.tld}`, "plural");
  }
  const tokens = Array.from(
    new Set([seed.cityToken, seed.nicheKeyword, seed.businessToken, seed.distinctiveToken].filter((t) => t.length >= 3))
  ).sort((a, b) => b.length - a.length);
  for (const token of tokens) {
    if (label.startsWith(token) && label.length - token.length >= 3) {
      add(`${token}-${label.slice(token.length)}.${c.tld}`, "hyphen");
    }
    if (label.endsWith(token) && label.length - token.length >= 3) {
      add(`${label.slice(0, label.length - token.length)}-${token}.${c.tld}`, "hyphen");
    }
  }
  const doubled = label.match(/([a-z])\1/);
  if (doubled && doubled.index !== undefined) {
    add(`${label.slice(0, doubled.index + 1)}${label.slice(doubled.index + 2)}.${c.tld}`, "spelling");
  }
  if (label.includes("ph")) {
    add(`${label.replace("ph", "f")}.${c.tld}`, "spelling");
  }
  return out;
}

/** Risk flags from variant availability results actually returned by the keyless check. */
export function flagsFromVariantResults(
  variants: DomainVariant[],
  results: Map<string, AvailabilityResult>
): string[] {
  const flags: string[] = [];
  for (const v of variants) {
    if (results.get(v.domain)?.status !== "registered") continue;
    if (v.kind === "other_tld") {
      flags.push(
        `${v.domain} is already registered - the same name on another major ending, so a customer who misremembers the ending lands elsewhere.`
      );
    } else if (v.kind === "plural" || v.kind === "singular") {
      flags.push(`${v.domain} (the ${v.kind} form) is already registered - easy for customers to confuse with this name.`);
    } else if (v.kind === "hyphen") {
      flags.push(`${v.domain} (hyphenated) is already registered - the spoken version of the name is ambiguous.`);
    } else {
      flags.push(`${v.domain} (a spelling variant) is already registered - mishearings and mistypes may land there.`);
    }
  }
  return flags;
}

/* ----------------------------- recommendation ------------------------------- */

export type Recommendation = {
  pick: ClientDomainCandidate | null;
  runnerUp: ClientDomainCandidate | null;
  /** Top-scored candidate when no verified pick exists (registered, or unverified when checks did not run). */
  closest: ClientDomainCandidate | null;
  checksRan: boolean;
  availableCount: number;
};

/** Deterministic: highest score wins among verified-available names; domain name breaks ties. */
export function pickRecommendation(candidates: ClientDomainCandidate[]): Recommendation {
  const byScore = [...candidates].sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
  const available = byScore.filter((c) => c.availability === "available");
  const checksRan = candidates.some((c) => c.availability !== "unchecked");
  if (available.length) {
    return { pick: available[0], runnerUp: available[1] || null, closest: null, checksRan, availableCount: available.length };
  }
  if (!checksRan) {
    return { pick: byScore[0] || null, runnerUp: byScore[1] || null, closest: null, checksRan, availableCount: 0 };
  }
  return { pick: null, runnerUp: null, closest: byScore[0] || null, checksRan, availableCount: 0 };
}

function recommendationHtml(seed: ReportSeed, candidates: ClientDomainCandidate[], variantFlags: Map<string, string[]>): string {
  const rec = pickRecommendation(candidates);
  if (rec.pick && rec.pick.availability === "available") {
    const pick = rec.pick;
    const pros = candidateRationale(pick, seed)
      .filter((f) => f.tone === "pro")
      .slice(0, 4)
      .map((f) => f.text);
    const sub = strongestSubScore(pick);
    const sentences = [
      `Our pick: <strong>${esc(pick.domain)}</strong> - the highest-scoring name (score ${pick.score.toFixed(1)}, ${esc(pick.band)}) that the registry check found registerable.`,
    ];
    if (pros.length) sentences.push(`Why this one: ${esc(pros.join("; "))}.`);
    if (sub) {
      sentences.push(
        `Its strongest engine sub-score is ${esc(sub.label)} at ${fmtScore(sub.value)}/100${rec.availableCount > 1 ? `, and it ranks first among the ${rec.availableCount} registerable names in this report` : ""}.`
      );
    }
    if (rec.runnerUp) {
      const shorter =
        rec.runnerUp.label.length < pick.label.length
          ? ` It is also shorter, at ${rec.runnerUp.label.length} characters.`
          : "";
      sentences.push(
        `Runner-up: <strong>${esc(rec.runnerUp.domain)}</strong> (score ${rec.runnerUp.score.toFixed(1)}, ${esc(rec.runnerUp.band)}).${shorter}`
      );
    }
    const pickFlags = variantFlags.get(pick.domain) || [];
    if (pickFlags.length) {
      sentences.push(`One caution before you commit: ${esc(pickFlags[0])} See the risk flags under its row below.`);
    }
    return `<h2>Recommendation</h2>\n<p>${sentences.join(" ")}</p>`;
  }
  if (rec.pick) {
    const pick = rec.pick;
    return `<h2>Recommendation</h2>
<p>Our pick, with a caveat: <strong>${esc(pick.domain)}</strong> is the top-scored name in this report (score ${pick.score.toFixed(1)}, ${esc(pick.band)}), but availability could not be verified this time, so treat it as the leading candidate - not a confirmed registerable name. Check it live at a registrar before you rely on it.${
      rec.runnerUp
        ? ` Runner-up on score: <strong>${esc(rec.runnerUp.domain)}</strong> (${rec.runnerUp.score.toFixed(1)}, ${esc(rec.runnerUp.band)}), also unverified.`
        : ""
    }</p>`;
  }
  const closest = rec.closest;
  return `<h2>Recommendation</h2>
<p><strong>No clear pick this time.</strong> None of the ${candidates.length} names in this report came back registerable in the availability snapshot - every checked name is already registered or could not be verified.${
    closest
      ? ` The closest miss is <strong>${esc(closest.domain)}</strong> (score ${closest.score.toFixed(1)}, ${esc(closest.band)}), which shows as registered: it only helps if you already own it or can buy it from its owner.`
      : ""
  } A fresh run with a variation - a nickname, initials, or a nearby city in the business name - usually opens up registerable names.</p>`;
}

/* -------------------------------- rendering --------------------------------- */

export type DomainReportRenderArgs = {
  seed: ReportSeed;
  candidates: ClientDomainCandidate[];
  availabilityChecked: number;
  checkedAt?: string;
  variantFlags: Map<string, string[]>;
  variantStatus: Map<string, AvailabilityResult>;
  variantCheckedCount: number;
  prices: TldPriceTable;
  origin: string;
};

export function buildDomainReportHtml(args: DomainReportRenderArgs): string {
  const { seed, candidates, prices, origin } = args;

  const rows = candidates
    .map((c, i) => {
      const avail =
        c.availability === "available"
          ? '<span class="ok">likely available</span>'
          : c.availability === "registered"
            ? '<span class="bad">registered</span>'
            : `<span class="warn">${esc(c.availability.replace(/_/g, " "))}</span>`;
      const links = REGISTRAR_SLUGS.map(
        (slug) =>
          `<a href="${esc(outboundHref(origin, slug, { domain: c.domain, src: "domainiq-report" }))}" rel="sponsored nofollow noopener" target="_blank">${esc(slug)}</a>`
      ).join(" · ");
      const price = c.availability === "registered" ? "-" : formatTldPrice(prices, c.tld) || "-";
      const facts = candidateRationale(c, seed);
      const flags = args.variantFlags.get(c.domain) || [];
      const detail =
        facts.length || flags.length
          ? `\n<tr><td colspan="7" style="background:#fafafa"><span class="muted">Measured:</span> ${facts
              .map((f) => esc(f.text))
              .join(" &middot; ")}${
              flags.length
                ? `<br><span class="bad">Risk flags:</span> ${flags.map((f) => esc(f)).join("<br>")}`
                : ""
            }</td></tr>`
          : "";
      return `<tr><td>${i + 1}</td><td><strong>${esc(c.domain)}</strong><br><span class="muted">${esc(c.summary)}</span></td>
<td>${c.score.toFixed(1)}<br><span class="muted">${esc(c.band)}</span></td><td>${avail}</td>
<td>${c.highlights.map((h) => `+ ${esc(h)}`).join("<br>")}${c.concerns.length ? "<br>" : ""}${c.concerns.map((h) => `− ${esc(h)}`).join("<br>")}</td>
<td>${price}</td>
<td class="muted">${c.availability === "registered" ? "" : links}</td></tr>${detail}`;
    })
    .join("\n");

  const checkedAt = args.checkedAt ? new Date(args.checkedAt).toUTCString() : "";
  const priceNote =
    prices.source === "live"
      ? `Estimated first-year registration prices (the "Est. first year" column) are per-TLD list prices from Porkbun's public price list, fetched ${esc(prices.asOf)}.`
      : `Estimated first-year registration prices (the "Est. first year" column) are per-TLD list prices from a snapshot of Porkbun's public price list dated ${esc(prices.asOf)} (the live list could not be fetched when this report was generated).`;
  const flagsNote = args.availabilityChecked
    ? args.variantCheckedCount
      ? `<p class="muted">About risk flags: for the top ${args.variantCheckedCount} names, look-alike variants (other major endings, plural/singular, hyphenated, and spelling variants) were run through the same keyless RDAP/DNS check, and any variant that came back registered is flagged under its row. A flag is a prompt to check, not legal advice; consider a trademark search before building on a name. This report does not search trademarks.</p>`
      : `<p class="muted">Risk-flag variant checks did not run for this report. A flag would be a prompt to check, not legal advice; consider a trademark search before building on a name. This report does not search trademarks.</p>`
    : `<p class="muted">Availability and risk-flag checks did not run for this report, so no names are flagged. Consider a trademark search before building on a name; this report does not search trademarks.</p>`;

  const rec = pickRecommendation(candidates);
  const strategy: string[] = [];
  if (rec.pick && rec.pick.availability === "available") {
    const pickPrice = formatTldPrice(prices, rec.pick.tld);
    strategy.push(
      `Register <strong>${esc(rec.pick.domain)}</strong> first${pickPrice ? ` (est. ${pickPrice} for the first year)` : ""} - availability is a snapshot and names move.`
    );
    const pickVariants = domainVariants(rec.pick, seed);
    const defensive = pickVariants.filter((v) => args.variantStatus.get(v.domain)?.status === "available");
    if (defensive.length) {
      strategy.push(
        `Grab the defensive variants while they are open: ${defensive
          .map((v) => {
            const p = formatTldPrice(prices, v.domain.slice(v.domain.lastIndexOf(".") + 1));
            return `${esc(v.domain)}${p ? ` (est. ${p})` : ""}`;
          })
          .join(", ")}. Same owner, so nobody else can sit on the look-alikes.`
      );
    } else if (args.variantStatus.size) {
      strategy.push("None of the checked look-alike variants of the pick are available to grab defensively.");
    }
  } else if (rec.pick) {
    strategy.push(
      `Check <strong>${esc(rec.pick.domain)}</strong> live at a registrar first - it is the top-scored name, but its availability was not verified in this report.`
    );
  } else {
    strategy.push("Do not register a name from this list without re-checking it live at the registrar - none came back registerable.");
  }
  const registered = candidates.filter((c) => c.availability === "registered");
  if (registered.length) {
    strategy.push(
      `Skip unless you own them: ${registered.map((c) => esc(c.domain)).join(", ")} - already registered, so getting one means negotiating with its owner.`
    );
  }
  strategy.push("Prefer a short .com you can say out loud once and spell correctly.");
  strategy.push("Register it yourself at any registrar; Sitesinc does not buy or hold domains for you.");
  strategy.push("Turn on auto-renew and WHOIS privacy.");
  strategy.push(
    "Before building a brand on any name here, run a proper trademark search (for example the USPTO database) or ask a trademark attorney - this report flags look-alike registrations only and does not search trademarks."
  );

  const body = `<h1>Domain report: ${esc(seed.businessName)}</h1>
<p class="muted">${esc(seed.niche)}${seed.city ? ` &middot; ${esc(seed.city)}` : ""}${seed.state ? `, ${esc(seed.state)}` : ""} &middot; DomainIQ engine ${esc(DOMAINIQ_ENGINE_VERSION)}</p>
${recommendationHtml(seed, candidates, args.variantFlags)}
<h2>Ranked candidates</h2>
<p>Scores (0-100) weigh length, clarity, spelling risk, niche fit and local relevance. ${
    args.availabilityChecked
      ? `Availability was checked against public registry data (RDAP/DNS) on ${esc(checkedAt)}. It is a snapshot: a name can be taken at any time, so confirm at the registrar before you decide.`
      : "Availability could not be checked automatically this time; confirm each name at a registrar."
  }</p>
<p class="muted">${priceNote} They are estimates for a standard name: registry-premium names can cost much more at checkout, and the registrar's quote for the exact name is the real price.</p>
<table><thead><tr><th>#</th><th>Domain</th><th>Score</th><th>Availability</th><th>Why</th><th>Est. first year</th><th>Search at</th></tr></thead><tbody>
${rows}
</tbody></table>
${flagsNote}
<h2>Next steps</h2>
<ul>${strategy.map((s) => `<li>${s}</li>`).join("\n")}</ul>
<p class="muted">${esc(affiliateDisclosureText())}</p>`;
  return reportDocument(`Domain report: ${seed.businessName}`, body);
}

/* ------------------------------ orchestration ------------------------------- */

/** How many top candidates get the look-alike variant risk check. */
export const VARIANT_CHECK_TOP_N = 5;

export async function generateDomainIQReport(
  input: DomainReportInput,
  opts: { origin: string; fetchImpl?: typeof fetch; timeoutMs?: number }
): Promise<string> {
  const seed: ReportSeed = {
    businessName: (input.businessName || "").trim(),
    niche: (input.niche || "").trim(),
    city: (input.city || "").trim(),
    state: (input.state || "").trim(),
    cityToken: "",
    nicheKeyword: "",
    businessToken: "",
    distinctiveToken: "",
  };
  if (!seed.niche || !seed.businessName) {
    throw new NonRetryableError("DomainIQ report needs the business name and what the business does.");
  }
  const run = await discoverClientDomains(
    { businessName: seed.businessName, niche: seed.niche, city: seed.city, state: seed.state },
    { checkAvailability: true }
  );
  if (!run.out.ok) throw new NonRetryableError(run.out.reason || "DomainIQ could not build suggestions from these details.");
  const candidates = run.candidates;
  if (!candidates.length) throw new NonRetryableError("DomainIQ produced no candidates for these details.");
  seed.cityToken = run.out.seed.cityToken;
  seed.nicheKeyword = run.out.seed.nicheKeyword;
  seed.businessToken = run.out.seed.businessToken;
  seed.distinctiveToken = run.out.seed.distinctiveToken;

  // Prices first, before the variant-check burst: Porkbun's page is more likely
  // to answer a fresh connection than one made after ~100 RDAP/DNS lookups.
  const prices = await getPorkbunTldPrices({
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    timeoutMs: opts.timeoutMs ?? 4000,
  });

  // Risk flags: run the same keyless availability check over look-alike variants
  // of the top candidates. Only runs when the main availability pass ran.
  const variantFlags = new Map<string, string[]>();
  const variantStatus = new Map<string, AvailabilityResult>();
  let variantCheckedCount = 0;
  if (run.availabilityChecked) {
    const tops = candidates.slice(0, VARIANT_CHECK_TOP_N);
    const perCandidate = tops.map((c) => ({ candidate: c, variants: domainVariants(c, seed) }));
    const unique = Array.from(new Set(perCandidate.flatMap((p) => p.variants.map((v) => v.domain))));
    if (unique.length) {
      const results = await checkDomainsAvailability(unique, {
        concurrency: 8,
        timeoutMs: opts.timeoutMs ?? 4000,
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      });
      for (const r of results) variantStatus.set(r.domain, r);
      variantCheckedCount = tops.length;
      for (const { candidate, variants } of perCandidate) {
        const flags = flagsFromVariantResults(variants, variantStatus);
        if (flags.length) variantFlags.set(candidate.domain, flags);
      }
    }
  }

  return buildDomainReportHtml({
    seed,
    candidates,
    availabilityChecked: run.availabilityChecked ? 1 : 0,
    checkedAt: run.checkedAt,
    variantFlags,
    variantStatus,
    variantCheckedCount,
    prices,
    origin: opts.origin,
  });
}
