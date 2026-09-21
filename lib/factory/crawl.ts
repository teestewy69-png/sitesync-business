import { isMailConfigured } from "@/lib/mail";
import { newId, storeWritable } from "@/lib/store";
import { PUBLIC_PATHS, PRODUCTION_ORIGIN } from "./pipeline";
import type {
  BaselineSnapshot,
  BrokenLink,
  ConversionSeverity,
  PageAudit,
} from "./types";

const FETCH_MS = 8000;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function attr(html: string, name: string): string {
  const match = html.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] || "";
}

function collect(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = stripTags(match[1]);
    if (text) out.push(text);
  }
  return out;
}

function meta(html: string, key: string, by = "name"): string {
  const re = new RegExp(
    `<meta[^>]+${by}=["']${key}["'][^>]*>`,
    "i"
  );
  const tag = html.match(re)?.[0] || "";
  return attr(tag, "content");
}

function linkRel(html: string, rel: string): string {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0] || "";
  return attr(tag, "href");
}

function schemaTypes(html: string): string[] {
  const types: string[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    try {
      const json = JSON.parse(match[1]);
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const t = node?.["@type"];
        if (typeof t === "string") types.push(t);
        if (Array.isArray(t)) types.push(...t.filter((x) => typeof x === "string"));
        if (Array.isArray(node?.["@graph"])) {
          for (const item of node["@graph"]) {
            if (typeof item?.["@type"] === "string") types.push(item["@type"]);
          }
        }
      }
    } catch {
      types.push("InvalidJSON-LD");
    }
  }
  return [...new Set(types)];
}

function absUrl(origin: string, href: string): string {
  try {
    return new URL(href, origin).toString();
  } catch {
    return href;
  }
}

function sameOrigin(origin: string, href: string): boolean {
  try {
    return new URL(href, origin).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}

async function fetchText(
  url: string
): Promise<{ ok: boolean; status: number; body: string; ttfbMs: number; bytes: number; error: string }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "SitesincFactoryBaseline/1.0" },
    });
    const body = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      body,
      ttfbMs: Date.now() - started,
      bytes: Buffer.byteLength(body),
      error: res.ok ? "" : `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: "",
      ttfbMs: Date.now() - started,
      bytes: 0,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function parsePage(origin: string, pathName: string, fetched: Awaited<ReturnType<typeof fetchText>>): PageAudit {
  const html = fetched.body;
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => ({
    src: attr(m[0], "src"),
    alt: attr(m[0], "alt"),
  }));
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((m) =>
    absUrl(origin, m[1])
  );
  const internalLinks = [...new Set(anchors.filter((href) => sameOrigin(origin, href)))];
  const externalLinks = [...new Set(anchors.filter((href) => !sameOrigin(origin, href)))];
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((m) => {
    const tag = m[0];
    const fields = [...tag.matchAll(/<(input|textarea|select)\b[^>]*>/gi)].map((f) =>
      attr(f[0], "name") || attr(f[0], "type") || f[1]
    );
    return {
      action: attr(tag, "action") || pathName,
      method: (attr(tag, "method") || "get").toLowerCase(),
      fields: fields.filter(Boolean),
    };
  });

  return {
    url: `${origin}${pathName}`,
    path: pathName,
    statusCode: fetched.status || null,
    title: stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]),
    metaDescription: meta(html, "description"),
    canonical: linkRel(html, "canonical"),
    robots: meta(html, "robots"),
    wordCount: stripTags(html).split(/\s+/).filter(Boolean).length,
    headings: {
      h1: collect(html, "h1"),
      h2: collect(html, "h2"),
      h3: collect(html, "h3"),
    },
    schemaTypes: schemaTypes(html),
    ogTitle: meta(html, "og:title", "property"),
    ogDescription: meta(html, "og:description", "property"),
    ogImage: meta(html, "og:image", "property"),
    images,
    missingAlt: images.filter((img) => !img.alt.trim()).length,
    internalLinks,
    externalLinks,
    forms,
    ttfbMs: fetched.ok ? fetched.ttfbMs : null,
    bytes: fetched.ok ? fetched.bytes : null,
    error: fetched.error,
  };
}

function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
}

async function probeLink(href: string): Promise<{ status: number | null; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    let res = await fetch(href, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "SitesincFactoryBaseline/1.0" },
    });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(href, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow",
        headers: { "user-agent": "SitesincFactoryBaseline/1.0" },
      });
    }
    return { status: res.status, error: res.ok ? "" : `HTTP ${res.status}` };
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : "Failed" };
  } finally {
    clearTimeout(timer);
  }
}

async function intakeHealth(origin: string): Promise<BaselineSnapshot["intakeFormHealth"]> {
  const notes: string[] = [];
  let checklist: ConversionSeverity = "warning";
  let inquiry: ConversionSeverity = "warning";

  const badSubscribe = await fetch(`${origin}/api/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  }).catch(() => null);
  if (badSubscribe?.status === 400) {
    checklist = "ok";
    notes.push("Checklist endpoint rejects invalid email.");
  } else {
    checklist = "launch_blocking";
    notes.push("Checklist endpoint did not reject invalid email (expected 400).");
  }

  const badInquiry = await fetch(`${origin}/api/inquiry`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ slug: "", name: "", email: "", message: "" }),
  }).catch(() => null);
  if (badInquiry?.status === 400) {
    inquiry = "ok";
    notes.push("Inquiry endpoint rejects empty payloads.");
  } else {
    inquiry = "launch_blocking";
    notes.push("Inquiry endpoint did not reject an empty payload (expected 400).");
  }

  const writable = await storeWritable();
  const smtp = isMailConfigured();
  if (!writable) {
    notes.push("JSON store is not writable — submissions cannot persist.");
  }
  if (!smtp) {
    notes.push("SMTP is not configured — email notifications will not send. Not treated as a crawl blocker on its own.");
  }

  const launchBlocking =
    checklist === "launch_blocking" || inquiry === "launch_blocking" || !writable;

  return {
    checklistEndpoint: checklist,
    inquiryEndpoint: inquiry,
    storeWritable: writable,
    smtpConfigured: smtp,
    notes,
    launchBlocking,
  };
}

export async function captureBaseline(opts?: {
  origin?: string;
  source?: BaselineSnapshot["source"];
}): Promise<BaselineSnapshot> {
  const origin = (opts?.origin || PRODUCTION_ORIGIN).replace(/\/$/, "");
  const source = opts?.source || (origin.includes("sitesinc.co") ? "live_production" : "local");
  const capturedAt = new Date().toISOString();

  const robots = await fetchText(`${origin}/robots.txt`);
  const sitemapFetch = await fetchText(`${origin}/sitemap.xml`);
  const sitemapList = sitemapFetch.ok ? sitemapUrls(sitemapFetch.body) : [];

  const extraPaths: string[] = [];
  try {
    const { readWorkspace } = await import("./workspace");
    const workspace = await readWorkspace();
    for (const page of workspace.pages) {
      if (page.status === "published" || page.status === "staged") extraPaths.push(page.path);
    }
  } catch {
    /* first capture may seed the workspace; inventory still covers PUBLIC_PATHS */
  }

  const pageInventory: PageAudit[] = [];
  const paths = [...new Set<string>([...PUBLIC_PATHS, ...extraPaths, "/case-study"])];
  for (const pathName of paths) {
    const fetched = await fetchText(`${origin}${pathName}`);
    pageInventory.push(parsePage(origin, pathName, fetched));
  }

  const brokenLinks: BrokenLink[] = [];
  const seen = new Set<string>();
  for (const page of pageInventory) {
    for (const href of page.internalLinks.slice(0, 8)) {
      if (seen.has(href) || href.includes("/app")) continue;
      seen.add(href);
      if (seen.size > 40) break;
      const probe = await probeLink(href);
      if (probe.error || (probe.status && probe.status >= 400)) {
        brokenLinks.push({
          from: page.path,
          href,
          status: probe.status,
          error: probe.error,
        });
      }
    }
  }

  const timed = pageInventory.filter((p) => typeof p.ttfbMs === "number") as Array<
    PageAudit & { ttfbMs: number }
  >;
  const avgTtfbMs = timed.length
    ? Math.round(timed.reduce((sum, p) => sum + p.ttfbMs, 0) / timed.length)
    : null;

  const ga = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
  const gsc = process.env.GOOGLE_SEARCH_CONSOLE_SITE_URL || "";

  const allInternal = pageInventory.flatMap((p) => p.internalLinks);

  return {
    id: newId("base"),
    projectId: "sitesinc-growth-case-study",
    capturedAt,
    origin,
    source,
    pageInventory,
    robotsTxt: {
      url: `${origin}/robots.txt`,
      ok: robots.ok,
      body: robots.ok ? robots.body.slice(0, 4000) : "",
      error: robots.error,
    },
    sitemap: {
      url: `${origin}/sitemap.xml`,
      ok: sitemapFetch.ok,
      urls: sitemapList,
      error: sitemapFetch.error,
    },
    canonicalSummary: pageInventory.map((page) => ({
      path: page.path,
      canonical: page.canonical,
      matches: !page.canonical || page.canonical.replace(/\/$/, "") === page.url.replace(/\/$/, ""),
    })),
    internalLinkSummary: {
      uniqueTargets: new Set(allInternal).size,
      total: allInternal.length,
    },
    brokenLinks,
    performance: {
      method: "server fetch TTFB (not Lighthouse)",
      pagesTimed: timed.length,
      avgTtfbMs,
      lighthouse: "not_run",
      note: "Lighthouse/CrUX is not wired. This is request timing only — labeled in progress for lab scores.",
    },
    indexing: {
      configured: Boolean(gsc),
      source: gsc ? "env:GOOGLE_SEARCH_CONSOLE_SITE_URL" : "not configured",
      lastChecked: capturedAt,
      note: gsc
        ? "Search Console property is named in env. Live index counts are not pulled until API credentials are added."
        : "Search Console credentials are not configured. Indexing status is operator-maintained only.",
    },
    analytics: {
      configured: Boolean(ga),
      source: ga ? "GA4 measurement id present" : "not configured",
      lastChecked: capturedAt,
      note: ga
        ? "GA4 is installed on the public site. This snapshot does not import numeric reports (in progress)."
        : "NEXT_PUBLIC_GA_MEASUREMENT_ID is empty. No analytics metrics claimed.",
    },
    intakeFormHealth: await intakeHealth(origin),
    screenshots: [],
    secretsRedacted: true,
  };
}
