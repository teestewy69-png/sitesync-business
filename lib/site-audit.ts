import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Free website audit. Fetches ONE public page (the URL the owner typed) and runs seven plain checks on the HTML
 * it returns. It is deliberately modest: no scoring model, no invented benchmarks. Each result says exactly what
 * was observed. The speed check measures this server's fetch time and the HTML size only; it is NOT a Core Web
 * Vitals test (the page links to Google PageSpeed Insights for that).
 */

export type AuditStatus = "pass" | "warn" | "fail";

export type AuditCheck = {
  id: "https" | "mobile" | "speed" | "title" | "description" | "contact" | "gbp";
  label: string;
  status: AuditStatus;
  detail: string;
};

export type AuditResult = {
  ok: true;
  checkedUrl: string;
  finalUrl: string;
  checkedAt: string;
  checks: AuditCheck[];
  passed: number;
  total: number;
};

export type AuditFailure = { ok: false; error: string };

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 9000;
const MAX_REDIRECTS = 4;

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
export function isPrivateAddress(addr: string): boolean {
  const v = isIP(addr);
  if (v === 4) {
    const [a, b] = addr.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (v === 6) {
    const x = addr.toLowerCase();
    if (x === "::1" || x === "::") return true;
    if (x.startsWith("::ffff:")) return isPrivateAddress(x.slice(7));
    return x.startsWith("fc") || x.startsWith("fd") || x.startsWith("fe8") || x.startsWith("fe9") || x.startsWith("fea") || x.startsWith("feb") || x.startsWith("ff");
  }
  return true;
}

/** Normalize what an owner typed ("joes-plumbing.com", "http://...") into an http(s) URL, or null. */
export function normalizeInputUrl(raw: string): URL | null {
  const text = raw.trim();
  if (!text || text.length > 300 || /\s/.test(text)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") && !isIP(host)) return null;
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return null;
  return url;
}

async function assertPublicHost(host: string): Promise<void> {
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("That address is not a public website.");
    return;
  }
  const records = await lookup(host, { all: true });
  if (!records.length || records.some((r) => isPrivateAddress(r.address))) {
    throw new Error("That address is not a public website.");
  }
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      chunks.push(value.slice(0, value.byteLength - (total - MAX_BYTES)));
      await reader.cancel().catch(() => undefined);
      break;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks));
}

type Fetched = { html: string; finalUrl: URL; ms: number; bytes: number; status: number; httpStartRedirectedToHttps: boolean | null };

async function fetchPage(start: URL): Promise<Fetched> {
  let url = start;
  const began = Date.now();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHost(url.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "user-agent": "SitesincAuditBot/1.0 (+https://sitesinc.co/free-website-audit)", accept: "text/html,application/xhtml+xml" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location") as string, url);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("The site redirected somewhere we can't check.");
      continue;
    }
    const ctype = res.headers.get("content-type") || "";
    if (!/html|xml/i.test(ctype) && ctype) throw new Error("That address did not return a web page.");
    const html = await readCapped(res);
    return {
      html,
      finalUrl: url,
      ms: Date.now() - began,
      bytes: Buffer.byteLength(html),
      status: res.status,
      httpStartRedirectedToHttps: start.protocol === "http:" ? url.protocol === "https:" : null,
    };
  }
  throw new Error("The site redirected too many times.");
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
}

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export function analyzeHtml(html: string, finalUrl: URL, ms: number, bytes: number, httpStartRedirectedToHttps: boolean | null): AuditCheck[] {
  const checks: AuditCheck[] = [];

  // 1. HTTPS
  if (finalUrl.protocol === "https:") {
    checks.push({
      id: "https", label: "Secure connection (HTTPS)", status: "pass",
      detail: httpStartRedirectedToHttps === true ? "The address you typed redirects to a secure HTTPS page." : "The page loads over HTTPS.",
    });
  } else {
    checks.push({
      id: "https", label: "Secure connection (HTTPS)", status: "fail",
      detail: "The page loads over plain HTTP. Browsers label these sites \"Not secure\" and many visitors leave.",
    });
  }

  // 2. Mobile
  const viewport = /<meta\b[^>]*name\s*=\s*["']?viewport["']?[^>]*>/i.exec(html)?.[0];
  const content = viewport ? attr(viewport, "content") : null;
  if (viewport && content && /width\s*=\s*device-width/i.test(content)) {
    checks.push({ id: "mobile", label: "Mobile-ready setup", status: "pass", detail: "The page declares a mobile viewport (width=device-width). This check only confirms the setting, not how every page looks on a phone." });
  } else {
    checks.push({ id: "mobile", label: "Mobile-ready setup", status: "fail", detail: "No mobile viewport tag (width=device-width) was found, so phones may show a shrunken desktop page." });
  }

  // 3. Speed (server response + HTML weight only)
  const kb = Math.round(bytes / 1024);
  const speedFacts = `Our server loaded the page in ${(ms / 1000).toFixed(1)} s and the HTML was ${kb} KB. This is a quick check, not a full speed test.`;
  checks.push({ id: "speed", label: "Page load (quick check)", status: ms > 4000 || bytes >= MAX_BYTES ? "fail" : ms > 2000 || bytes > 600_000 ? "warn" : "pass", detail: speedFacts });

  // 4. Title
  const titleRaw = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const title = titleRaw ? decodeEntities(titleRaw.replace(/<[^>]+>/g, "")) : "";
  if (!title) checks.push({ id: "title", label: "Page title", status: "fail", detail: "No page title was found. The title is the headline people see in Google results." });
  else if (title.length < 10 || title.length > 70) checks.push({ id: "title", label: "Page title", status: "warn", detail: `Title found (${title.length} characters): "${title.slice(0, 90)}". Titles around 10 to 70 characters display best in search results.` });
  else checks.push({ id: "title", label: "Page title", status: "pass", detail: `Title found (${title.length} characters): "${title}".` });

  // 5. Meta description
  let description = "";
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    if ((attr(tag, "name") || "").toLowerCase() === "description") {
      description = decodeEntities(attr(tag, "content") || "");
      break;
    }
  }
  if (!description) checks.push({ id: "description", label: "Search description", status: "fail", detail: "No meta description was found, so Google will pick random text from the page for your search listing." });
  else if (description.length < 50 || description.length > 170) checks.push({ id: "description", label: "Search description", status: "warn", detail: `Description found (${description.length} characters). Around 50 to 170 characters usually displays fully.` });
  else checks.push({ id: "description", label: "Search description", status: "pass", detail: `Description found (${description.length} characters).` });

  // 6. Contact info
  const hasTel = /href\s*=\s*["']tel:/i.test(html);
  const hasMail = /href\s*=\s*["']mailto:/i.test(html);
  const textOnly = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  const hasPhoneText = /(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.test(textOnly);
  const hasContactLink = /href\s*=\s*["'][^"']*contact/i.test(html);
  const found = [hasTel || hasPhoneText ? "a phone number" : "", hasMail ? "an email link" : "", hasContactLink ? "a contact page link" : ""].filter(Boolean);
  if (hasTel) checks.push({ id: "contact", label: "Contact info on the page", status: "pass", detail: `Found ${found.join(", ")}. A tap-to-call phone link is present.` });
  else if (found.length) checks.push({ id: "contact", label: "Contact info on the page", status: "warn", detail: `Found ${found.join(", ")}, but no tap-to-call phone link (tel:). On a phone, visitors can't call with one tap.` });
  else checks.push({ id: "contact", label: "Contact info on the page", status: "fail", detail: "No phone number, email link or contact page link was found on this page." });

  // 7. Google Business Profile link
  const gbp = /(?:g\.page\/|maps\.app\.goo\.gl|goo\.gl\/maps|google\.com\/maps|business\.google\.com|share\.google|g\.co\/kgs)/i.test(html);
  checks.push(
    gbp
      ? { id: "gbp", label: "Link to your Google Business Profile", status: "pass", detail: "This page links to a Google Maps or Google Business Profile address." }
      : { id: "gbp", label: "Link to your Google Business Profile", status: "warn", detail: "No link to a Google Business Profile or Google Maps listing was found on this page. This does not tell us whether you have a profile, only that the site doesn't link to it." }
  );

  return checks;
}

export async function auditUrl(raw: string): Promise<AuditResult | AuditFailure> {
  const url = normalizeInputUrl(raw);
  if (!url) return { ok: false, error: "Enter your website address, like joesplumbing.com." };
  try {
    const page = await fetchPage(url);
    if (page.status >= 400) {
      return { ok: false, error: `The site answered with an error (HTTP ${page.status}). Check the address and try again.` };
    }
    const checks = analyzeHtml(page.html, page.finalUrl, page.ms, page.bytes, page.httpStartRedirectedToHttps);
    return {
      ok: true,
      checkedUrl: url.toString(),
      finalUrl: page.finalUrl.toString(),
      checkedAt: new Date().toISOString(),
      checks,
      passed: checks.filter((c) => c.status === "pass").length,
      total: checks.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (/not a public website|redirect|did not return a web page/i.test(message)) return { ok: false, error: message };
    return { ok: false, error: "We couldn't load that website. Check the address, or the site may be down or blocking automated checks." };
  }
}
