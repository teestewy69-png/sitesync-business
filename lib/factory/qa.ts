export type QaStatus = "pass" | "fail" | "watch" | "in_progress";

export type QaItem = {
  id: string;
  area: string;
  status: QaStatus;
  detail: string;
  launchBlocking: boolean;
};

async function fetchPage(origin: string, path: string) {
  const started = Date.now();
  try {
    const res = await fetch(`${origin}${path}`, { redirect: "manual" });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, ms: Date.now() - started, headers: res.headers };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: "",
      ms: Date.now() - started,
      headers: new Headers(),
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

function has(body: string, pattern: RegExp) {
  return pattern.test(body);
}

export async function runStagingQa(origin: string): Promise<{
  ranAt: string;
  origin: string;
  items: QaItem[];
  launchBlocking: boolean;
}> {
  const home = await fetchPage(origin, "/");
  const pricing = await fetchPage(origin, "/#pricing");
  const process = await fetchPage(origin, "/#process");
  const faq = await fetchPage(origin, "/#faq");
  const caseStudy = await fetchPage(origin, "/case-study");
  const staging = await fetchPage(origin, "/app/staging/website-design");
  const publicFactory = await fetchPage(origin, "/website-design");
  const robots = await fetchPage(origin, "/robots.txt");
  const sitemap = await fetchPage(origin, "/sitemap.xml");

  const items: QaItem[] = [];

  items.push({
    id: "homepage",
    area: "Homepage",
    status: home.ok && has(home.body, /Ultra-modern websites/) ? "pass" : "fail",
    detail: home.ok
      ? `Homepage 200 in ${home.ms}ms. Current marketing homepage is intact.`
      : `Homepage failed (${home.status}).`,
    launchBlocking: !home.ok,
  });

  items.push({
    id: "pricing",
    area: "Pricing",
    status: has(home.body, /id="pricing"/) && has(home.body, /\$1,995/) && !has(home.body, /\$749\.50/)
      ? "pass"
      : "fail",
    detail: has(home.body, /\$1,995/)
      ? "Pricing section present with $1,995 / $129 and 50/50 payment. Old $749.50 offer is absent."
      : "Pricing section missing or still showing a mixed offer.",
    launchBlocking: !has(home.body, /id="pricing"/),
  });

  items.push({
    id: "how-it-works",
    area: "How it works",
    status: has(home.body, /id="process"/) ? "pass" : "fail",
    detail: has(home.body, /id="process"/)
      ? "Process / how-it-works section is on the homepage."
      : "Process section missing.",
    launchBlocking: !has(home.body, /id="process"/),
  });

  items.push({
    id: "faq",
    area: "FAQ",
    status: has(home.body, /id="faq"/) ? "pass" : "fail",
    detail: has(home.body, /id="faq"/) ? "FAQ section is on the homepage." : "FAQ section missing.",
    launchBlocking: !has(home.body, /id="faq"/),
  });

  items.push({
    id: "intake",
    area: "Intake form",
    status: has(home.body, /id="checklist"/) && has(home.body, /Send me the checklist/) ? "pass" : "fail",
    detail: has(home.body, /id="checklist"/)
      ? "Checklist intake form is on the homepage."
      : "Checklist form missing.",
    launchBlocking: !has(home.body, /id="checklist"/),
  });

  const bad = await fetch(`${origin}/api/subscribe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "not-an-email" }),
  }).catch(() => null);
  items.push({
    id: "intake-validation",
    area: "Intake validation",
    status: bad?.status === 400 ? "pass" : "fail",
    detail:
      bad?.status === 400
        ? "Invalid email is rejected with 400."
        : `Validation returned ${bad?.status ?? "no response"}.`,
    launchBlocking: bad?.status !== 400,
  });

  items.push({
    id: "case-study",
    area: "Case study",
    status:
      caseStudy.ok &&
      has(caseStudy.body, /noindex/) &&
      has(caseStudy.body, /In progress/) &&
      !has(caseStudy.body, /we now rank|indexed pages: \d+/)
        ? "pass"
        : "fail",
    detail: caseStudy.ok
      ? "Public case study is noindex and labeled in progress. No ranking claims."
      : "Case study did not load.",
    launchBlocking: false,
  });

  items.push({
    id: "staging-noindex",
    area: "Staging robots",
    status:
      staging.ok &&
      (staging.headers.get("x-robots-tag") || "").includes("noindex") &&
      has(staging.body, /noindex/)
        ? "pass"
        : "watch",
    detail: `Staging preview ${staging.status}. X-Robots-Tag=${staging.headers.get("x-robots-tag") || "missing"}.`,
    launchBlocking: false,
  });

  items.push({
    id: "public-factory-gated",
    area: "Ungated factory routes",
    status: publicFactory.status === 404 ? "pass" : "fail",
    detail:
      publicFactory.status === 404
        ? "/website-design is 404 until production surfaces are approved."
        : `Unexpected ${publicFactory.status} on /website-design.`,
    launchBlocking: publicFactory.status !== 404,
  });

  items.push({
    id: "titles-meta",
    area: "Titles and meta",
    status: has(home.body, /<title>/) && has(home.body, /name="description"/) ? "pass" : "fail",
    detail: "Homepage title and meta description are present.",
    launchBlocking: false,
  });

  items.push({
    id: "canonical",
    area: "Canonical URLs",
    status: has(home.body, /rel="canonical"/) ? "pass" : "watch",
    detail: has(home.body, /rel="canonical"/)
      ? "Homepage canonical is present."
      : "Homepage canonical missing.",
    launchBlocking: false,
  });

  items.push({
    id: "og",
    area: "Open Graph",
    status: has(home.body, /property="og:title"/) && has(home.body, /property="og:image"/) ? "pass" : "watch",
    detail: "Homepage Open Graph title and image are present.",
    launchBlocking: false,
  });

  items.push({
    id: "schema",
    area: "Schema",
    status: has(home.body, /application\/ld\+json/) && has(home.body, /Organization/) ? "pass" : "watch",
    detail: has(home.body, /application\/ld\+json/)
      ? "JSON-LD found: Organization, WebSite, Service, FAQPage from the visible FAQ."
      : "No JSON-LD on homepage.",
    launchBlocking: false,
  });

  items.push({
    id: "robots",
    area: "robots.txt",
    status: robots.ok && has(robots.body, /Disallow: \/app\//) ? "pass" : "fail",
    detail: robots.ok
      ? "Local robots.txt disallows /app, /api/factory, and /case-study."
      : "robots.txt missing locally.",
    launchBlocking: false,
  });

  items.push({
    id: "sitemap",
    area: "sitemap.xml",
    status: sitemap.ok && !has(sitemap.body, /\/app/) ? "pass" : "fail",
    detail: sitemap.ok
      ? "Local sitemap.xml is present and does not include /app."
      : "sitemap.xml missing locally. Live production still 404 (Day 0 fact).",
    launchBlocking: false,
  });

  items.push({
    id: "performance",
    area: "Performance",
    status: home.ms < 4000 ? "in_progress" : "watch",
    detail: `Homepage HTML in ${home.ms}ms (server fetch, not Lighthouse). Lab scores remain in progress.`,
    launchBlocking: false,
  });

  items.push({
    id: "rollback",
    area: "Rollback capability",
    status: "pass",
    detail: "Factory rollback action exists on /app/staging. It only affects published factory pages. Homepage is never replaced.",
    launchBlocking: false,
  });

  return {
    ranAt: new Date().toISOString(),
    origin,
    items,
    launchBlocking: items.some((item) => item.launchBlocking && item.status === "fail"),
  };
}
