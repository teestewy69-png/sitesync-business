/**
 * Outbound affiliate registry. Every outbound partner link goes through /go/[slug] (click logged,
 * then 302 to the destination) and is rendered with rel="sponsored nofollow" plus a disclosure.
 *
 * Program IDs come ONLY from env vars. With no env var set, the link is the plain, untracked
 * destination; we never invent or hard-code an affiliate id.
 *
 * Env per program: AFFILIATE_<SLUG>_URL_TEMPLATE, the tracking deep-link the affiliate network gives
 * you, with `{url}` where the URL-encoded destination goes (and/or `{domain}` for the searched domain).
 * Example shape (Impact): https://namecheap.pxf.io/c/<your-ids>?u={url}
 */

export type AffiliateCategory = "registrar" | "tool";

export type AffiliateProgram = {
  slug: string;
  name: string;
  category: AffiliateCategory;
  /** Plain landing page. */
  homeUrl: string;
  /** Plain search URL for a domain (registrars). `{domain}` is replaced, URL-encoded. */
  searchUrl?: string;
  /** Env var holding the tracking template (contains the program/affiliate id). */
  envVar: string;
  /** One-line, honest description for /tools. */
  blurb: string;
};

export const AFFILIATE_PROGRAMS: AffiliateProgram[] = [
  {
    slug: "namecheap",
    name: "Namecheap",
    category: "registrar",
    homeUrl: "https://www.namecheap.com/",
    searchUrl: "https://www.namecheap.com/domains/registration/results/?domain={domain}",
    envVar: "AFFILIATE_NAMECHEAP_URL_TEMPLATE",
    blurb: "Domain registrar with free WHOIS privacy.",
  },
  {
    slug: "porkbun",
    name: "Porkbun",
    category: "registrar",
    homeUrl: "https://porkbun.com/",
    searchUrl: "https://porkbun.com/checkout/search?q={domain}",
    envVar: "AFFILIATE_PORKBUN_URL_TEMPLATE",
    blurb: "Domain registrar with simple, flat pricing.",
  },
  {
    slug: "dynadot",
    name: "Dynadot",
    category: "registrar",
    homeUrl: "https://www.dynadot.com/",
    searchUrl: "https://www.dynadot.com/domain/search?domain={domain}",
    envVar: "AFFILIATE_DYNADOT_URL_TEMPLATE",
    blurb: "Domain registrar and aftermarket.",
  },
  {
    slug: "spaceship",
    name: "Spaceship",
    category: "registrar",
    homeUrl: "https://www.spaceship.com/",
    searchUrl: "https://www.spaceship.com/domain-search/?query={domain}&tab=domains",
    envVar: "AFFILIATE_SPACESHIP_URL_TEMPLATE",
    blurb: "Domain registrar from the Namecheap group.",
  },
];

export const REGISTRAR_SLUGS = AFFILIATE_PROGRAMS.filter((p) => p.category === "registrar").map((p) => p.slug);

const DOMAIN_PATTERN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeDomain(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const d = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return DOMAIN_PATTERN.test(d) ? d : "";
}

export function getProgram(slug: string): AffiliateProgram | undefined {
  return AFFILIATE_PROGRAMS.find((p) => p.slug === slug);
}

function template(program: AffiliateProgram, env: Record<string, string | undefined>): string {
  const value = (env[program.envVar] || "").trim();
  // Only accept an https template that actually has a placeholder for the destination.
  if (!/^https:\/\//i.test(value) || !/\{(url|domain)\}/.test(value)) return "";
  return value;
}

export function isProgramTracked(program: AffiliateProgram, env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(template(program, env));
}

/** Final destination for a click: tracked template when its env var is set, plain link otherwise. */
export function destinationUrl(
  program: AffiliateProgram,
  opts: { domain?: string } = {},
  env: Record<string, string | undefined> = process.env
): { url: string; tracked: boolean } {
  const domain = normalizeDomain(opts.domain);
  const plain =
    domain && program.searchUrl ? program.searchUrl.replace("{domain}", encodeURIComponent(domain)) : program.homeUrl;
  const tpl = template(program, env);
  if (!tpl) return { url: plain, tracked: false };
  const url = tpl.replace(/\{url\}/g, encodeURIComponent(plain)).replace(/\{domain\}/g, encodeURIComponent(domain));
  return { url, tracked: true };
}

/**
 * Plain, untracked registrar search URL (never a /go link, never an affiliate template). Used by the internal
 * DomainIQ bay while SiteFlow is paused (Path A).
 */
export function plainRegistrarUrl(slug: string, domain?: string): string {
  const program = getProgram(slug);
  if (!program) return "";
  return destinationUrl(program, { domain }, {}).url;
}

/** Site-relative (or absolute, when origin given) /go link for a program. */
export function outboundHref(origin: string, slug: string, opts: { domain?: string; src?: string } = {}): string {
  const params = new URLSearchParams();
  const domain = normalizeDomain(opts.domain);
  if (domain) params.set("d", domain);
  if (opts.src) params.set("src", opts.src.replace(/[^a-z0-9-]/gi, "").slice(0, 40));
  const qs = params.toString();
  return `${origin.replace(/\/$/, "")}/go/${encodeURIComponent(slug)}${qs ? `?${qs}` : ""}`;
}

/** rel for every outbound partner link. */
export const SPONSORED_REL = "sponsored nofollow noopener";

export function affiliateDisclosureText(): string {
  return "Disclosure: some registrar and tool links may be affiliate links. If you buy through one, Sitesinc may earn a commission at no extra cost to you. It never changes what we recommend.";
}

/** /tools stays out of navigation, sitemap and search until Tony picks programs (SITEFLOW_TOOLS_PAGE=listed). */
export function toolsPageListed(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SITEFLOW_TOOLS_PAGE || "").trim() === "listed";
}
