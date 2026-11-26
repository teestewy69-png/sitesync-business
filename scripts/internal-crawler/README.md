# Internal Crawler — pre-publish gate

A dependency-free Node crawler that checks **our own sites** the way search
engines and AI crawlers see them — raw HTML, no JavaScript rendering — and
fails loudly on the problems that used to slip through deploy after deploy:
missing schema, broken links, and visibility mistakes (the 2026-11-25 audit
found the live `/store` was `noindex` with zero schema; this gate exists so
that class of problem is caught **before** publish, not after).

## Run it

```bash
# Against the live site
node scripts/internal-crawler/crawl.mjs --base https://sitesinc.co

# Against FlipRadar
node scripts/internal-crawler/crawl.mjs --base https://flipradar.co

# Custom output dir / limits
node scripts/internal-crawler/crawl.mjs --base <URL> --out <dir> [--max-pages 900] [--concurrency 8]
```

Outputs `report.md` (human-readable, grouped by rule) and `report.json`
(full detail, including a per-page inventory) in the out dir
(default: `scripts/internal-crawler/out/`).

**Exit code is non-zero when any category fails** — that is what makes it a
gate. `0` = all four categories PASS.

## The pre-publish gate (how this is meant to be used)

Netlify builds a deploy preview for every push. Before publishing a deploy:

1. Open the deploy's preview URL (Netlify dashboard → Deploys → the deploy →
   "Preview deploy", or the `https://deploy-preview-…--sitesyncllc.netlify.app`
   / unique deploy URL).
2. Run the crawler against that URL:
   ```bash
   node scripts/internal-crawler/crawl.mjs --base https://<unique-deploy-url>
   ```
   The crawler rewrites sitemap URLs onto the base you give it, so the
   preview's own pages are what get checked.
3. **Do not publish if the verdict is FAIL.** Fix, push, re-check the new
   preview.

Also run it against the live sites after any publish, and any time content
or templates change:

```bash
node scripts/internal-crawler/crawl.mjs --base https://sitesinc.co --out /tmp/crawl-sitesinc
node scripts/internal-crawler/crawl.mjs --base https://flipradar.co --out /tmp/crawl-flipradar
```

## What it checks

Discovery: every URL in `<base>/sitemap.xml` (indexes followed), plus
internal-link discovery from crawled pages (so orphans and sitemap gaps
surface), plus the core commerce seeds `/store`, `/cart`, `/checkout` (a
seed that 404s and is neither linked nor in the sitemap is ignored — the
page simply doesn't exist on that site). Cap: 900 pages, concurrency 8,
10s timeouts.

### 1. Broken links
Every internal `href`/`src` target on every crawled page (anchors, images,
scripts, stylesheets, embeds…) must return HTTP 200 after redirects. Each
dead target is reported with the pages that link to it. Targets under
`/api/` are excluded — they are endpoints, not page links, and GET
semantics differ.

### 2. Schema (JSON-LD)
- Any content page with **zero** JSON-LD blocks.
- `/blog/<slug>` and `/guides/<slug>` → `BlogPosting` or `Article`.
- A page with a visible FAQ section (an H1–H6 heading containing "FAQ" or
  "Frequently Asked Questions") → `FAQPage`.
- `/store`, `/cart`, `/store/*`, `/products/*` → `Product` (and `Offer`).
- `/locations/*`, `/trades/*` (hubs and landings) → `LocalBusiness` or
  `Organization`, **and** `BreadcrumbList`.
- Service pages (`/services*` and service slugs such as `website-design`,
  `website-redesign`, `seo-ready-websites`, `website-monitoring`,
  `packages`, `for-local-service-businesses`) → `Service`.

Schema expectations apply to every content page — **including wrongly
noindexed ones** (that is exactly the `/store` failure shape). Exempt:
utility routes (below) and deliberately-noindex bulk pages.

### 3. Visibility
- `noindex`/`nofollow` (meta robots or `X-Robots-Tag` header) on any page
  outside the utility set — this is the rule that catches `/store`.
- Missing `<link rel="canonical">` on a content page.
- An indexable page that is missing from the sitemap.
- The same `<title>` shared by multiple distinct pages.

Utility set (allowed to be noindex / excluded from content checks):
`/app`, `/api`, `/cart`, `/checkout`, `/demo`, `/case-study`, `/go`,
`/thank-you`, `/client-domain` (preview/demo client routes).

### 4. Basics
Non-200 status, missing `<title>`, missing meta description, H1 count ≠ 1.

### Scoping decisions worth knowing
- **Bulk location pages:** `/locations/<slug>` pages that are `noindex`
  **and** absent from the sitemap are the deliberate bulk set (SitesInc's
  ~480, FlipRadar's ~480). They are exempt from the noindex flag, but their
  schema is still evaluated and reported as **non-gating warnings** — what
  would fail if the page were promoted to indexable. (FlipRadar's 480 bulk
  pages would all miss `LocalBusiness`/`Organization` today.)
- **Canonical aliases:** a page whose canonical points at a different
  internal page (e.g. FlipRadar's extensionless city URLs canonicalize to
  the `.html` form) is a serving variant, not an independent page — it is
  excluded from duplicate-title, sitemap-membership, and schema checks.
- A 404 page does not accumulate content flags (canonical/sitemap); its
  non-200 status and any inbound broken links are the findings.

## CI

`.github/workflows/build.yml` is intentionally **unchanged**. It runs with
no secrets or environment variables, and this app reads production env
(Stripe, Netlify Blobs, access tokens) at runtime — a `next start` server
in CI would serve pages that differ from production for environment
reasons, so a localhost crawl there would gate on environment artifacts
instead of code. The gate that matches the actual publish flow is the
Netlify deploy preview above, which runs with full production env.

If CI ever gains the production env/secrets, the step to add after
`npm run build` is:

```yaml
      - name: Start built app
        run: |
          npm run start &
          npx wait-on http://localhost:3000 --timeout 60000

      - name: Internal crawler gate
        run: node scripts/internal-crawler/crawl.mjs --base http://localhost:3000
```

## Proof (2026-11-25)

Live runs against both production sites are saved in
`~/workspace/research_notes/full-site-audit-2026-11-25/internal-crawler-proof/`
(`sitesinc/` and `flipradar/`). The crawler catches every failure the
2026-11-25 full-site audit found — including `/store` noindex + zero
schema, the homepage's missing canonical, `/free-guide` zero schema, the
`/locations` hub's missing BreadcrumbList, FlipRadar's city-page entity
gap, guide Article gap, and FAQ-section FAQPage gap — plus more the audit
couldn't see without link discovery (the whole `/store/*` tree is noindex;
FlipRadar's `/locations` hub has zero schema and is missing from its
sitemap). The broken-link failure path is verified against a local fixture
site with planted dead links (both live sites currently have zero dead
internal targets).
