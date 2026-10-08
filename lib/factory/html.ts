import type { HeadingMap, PageAudit } from "./types";

function decode(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function stripTags(html: string): string {
  return decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function meta(html: string, name: string): string {
  const named = html.match(
    new RegExp(
      `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']*)["']`,
      "i"
    )
  );
  if (named?.[1]) return decode(named[1]);
  const flipped = html.match(
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${name}["']`,
      "i"
    )
  );
  return flipped?.[1] ? decode(flipped[1]) : "";
}

function headings(html: string, tag: "h1" | "h2" | "h3"): string[] {
  const matches = html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"));
  return [...matches].map((match) => stripTags(match[1])).filter(Boolean);
}

function collectLinks(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((match) =>
    match[1].trim()
  );
}

function schemaTypes(html: string): string[] {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )];
  const types = new Set<string>();
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1]) as { "@type"?: string | string[] } | Array<{ "@type"?: string }>;
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of nodes) {
        const value = node?.["@type"];
        if (Array.isArray(value)) value.forEach((item) => types.add(String(item)));
        else if (value) types.add(String(value));
      }
    } catch {
      /* ignore invalid json-ld */
    }
  }
  return [...types];
}

function images(html: string): { src: string; alt: string }[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => {
    const tag = match[0];
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1] || "";
    const alt = tag.match(/alt=["']([^"']*)["']/i)?.[1] ?? "";
    return { src, alt: decode(alt) };
  });
}

function forms(html: string): PageAudit["forms"] {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)].map((match) => {
    const attrs = match[1];
    const body = match[2];
    const fields = [...body.matchAll(/<(?:input|textarea|select)\b[^>]*(?:name|id)=["']([^"']+)["']/gi)].map(
      (field) => field[1]
    );
    return {
      action: attrs.match(/action=["']([^"']*)["']/i)?.[1] || "",
      method: (attrs.match(/method=["']([^"']*)["']/i)?.[1] || "get").toLowerCase(),
      fields,
    };
  });
}

export function parsePage(html: string, url: string, pathName: string): Omit<
  PageAudit,
  "statusCode" | "ttfbMs" | "bytes" | "error"
> {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const img = images(html);
  const links = collectLinks(html);
  const origin = new URL(url).origin;
  const internal: string[] = [];
  const external: string[] = [];
  for (const href of links) {
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) continue;
    try {
      const resolved = new URL(href, url);
      if (resolved.origin === origin) internal.push(resolved.pathname);
      else external.push(resolved.href);
    } catch {
      /* skip */
    }
  }
  const map: HeadingMap = {
    h1: headings(html, "h1"),
    h2: headings(html, "h2"),
    h3: headings(html, "h3"),
  };
  return {
    url,
    path: pathName,
    title,
    metaDescription: meta(html, "description"),
    canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
      html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
      "",
    robots: meta(html, "robots"),
    wordCount: stripTags(html).split(/\s+/).filter(Boolean).length,
    headings: map,
    schemaTypes: schemaTypes(html),
    ogTitle: meta(html, "og:title"),
    ogDescription: meta(html, "og:description"),
    ogImage: meta(html, "og:image"),
    images: img,
    missingAlt: img.filter((item) => !item.alt.trim()).length,
    internalLinks: [...new Set(internal)],
    externalLinks: [...new Set(external)],
    forms: forms(html),
  };
}

export function parseSitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
}
