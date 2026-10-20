/**
 * Client draft checks: per-page length window and business-fact check against the project config
 * (offer price, phone, address/location). Pure functions; no network.
 */
import { checkContentLength, type ContentLengthCheck, type ContentLengthTarget } from "./content-length";

/** Full content pages get 900-1500 words; contact / legal pages are short by nature. */
export function pageLengthTarget(slug: string): ContentLengthTarget {
  if (/^(contact|privacy|terms|thank-you|legal)/.test(slug)) return { min: 250, target: 600, max: 1500 };
  return { min: 900, target: 1200, max: 1500 };
}

export function checkPageLength(slug: string, body: string): ContentLengthCheck {
  return checkContentLength(body, pageLengthTarget(slug));
}

export type FactIssue = { level: "error" | "warning"; fact: "phone" | "price" | "address"; message: string };
export type FactCheck = { status: "ok" | "warnings" | "errors"; issues: FactIssue[] };

type FactConfig = { phone?: string; offer?: string; pricingNote?: string; city?: string; state?: string; address?: string; notes?: string };

const digits = (s: string) => s.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const PRICE_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;
const normPrice = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : s;
};

/**
 * Compare a page body to the project's facts.
 * - phone: every phone number on the page must match config.phone; contact/home must show it.
 * - price: every $ amount must appear in config.offer / pricingNote / notes; none allowed when config has no prices.
 * - address: when config has a city, contact/home must mention it; a street address only if config.address has one.
 */
export function checkBusinessFacts(body: string, config: FactConfig, slug = ""): FactCheck {
  const issues: FactIssue[] = [];
  const text = String(body || "");
  const key = slug.toLowerCase();
  const needsContact = key === "home" || key === "contact";

  const cfgPhone = digits(config.phone || "");
  const phones = [...new Set((text.match(PHONE_RE) || []).map(digits).filter((d) => d.length === 10))];
  for (const p of phones) {
    if (!cfgPhone || p !== cfgPhone) {
      issues.push({ level: "error", fact: "phone", message: `Phone ${p.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3")} is not the project phone${cfgPhone ? "" : " (none on file)"}.` });
    }
  }
  if (cfgPhone && needsContact && !phones.includes(cfgPhone)) {
    issues.push({ level: "warning", fact: "phone", message: `Project phone ${config.phone} is missing from the ${key} page.` });
  }

  const source = [config.offer, config.pricingNote, config.notes].filter(Boolean).join(" ");
  const allowed = new Set((source.match(PRICE_RE) || []).map(normPrice));
  for (const raw of new Set(text.match(PRICE_RE) || [])) {
    if (!allowed.has(normPrice(raw))) {
      issues.push({ level: "error", fact: "price", message: allowed.size ? `Price ${raw.trim()} is not in the project offer/pricing (${[...allowed].map((v) => "$" + v).join(", ")}).` : `Price ${raw.trim()} appears but the project has no prices on file.` });
    }
  }

  if (needsContact && config.city && !new RegExp(config.city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
    issues.push({ level: "warning", fact: "address", message: `Location ${[config.city, config.state].filter(Boolean).join(", ")} is not mentioned on the ${key} page.` });
  }
  const street = text.match(/\b\d{2,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Street|Ave|Avenue|Blvd|Rd|Road|Dr|Drive|Way|Ln|Lane|Ct|Pkwy|Hwy)\b\.?/);
  if (street && !(config.address || "").toLowerCase().includes(street[0].toLowerCase().replace(/\.$/, ""))) {
    issues.push({ level: "error", fact: "address", message: `Street address "${street[0]}" is not the project address.` });
  }

  const status = issues.some((i) => i.level === "error") ? "errors" : issues.length ? "warnings" : "ok";
  return { status, issues };
}
