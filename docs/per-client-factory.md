# Per-client factory wiring

This note describes what is **fully wired** vs **still manual** after the per-client factory path (and client baseline/crawl + automation) landed on `staging-merge`.

## Model

- **Sitesinc growth case study** stays on `FACTORY_PROJECT_ID` (`sitesinc-growth-case-study`) and `factory/workspace`.
- **Each CRM client project** gets structured config fields on `ClientProject` plus its own workspace at `factory/clients/<projectId>/workspace`.
- Intake (`/api/subscribe` → `intakeToProject` → `recordIntakeProject`) no longer treats every lead as a mirror *into* the Sitesinc SEO factory as the build target. `factoryProjectId` on the intake mirror row is the **client project id**.
- **Baselines are site-scoped.** A client baseline uses `siteId = projectId`, crawls `/demo/client/<projectId>`, and is stored on that client's workspace (`latestBaselineId`). Day 0 / case-study pickers never fall across to demos or client previews (see `baseline-pick.ts`).

## Automated / Manual by design / Blocked on external setup

| Area | Mode | How |
| --- | --- | --- |
| Structured client config + template + design bind | **Automated** | Intake / `init-client-factory` |
| Per-client workspace seed (research notes, blueprint, briefs, pages) | **Automated** | `initClientWorkspace` |
| Templated draft bodies (labeled draft, noindex, `ready_for_review`) | **Automated** | Auto-seed on init via `draftFromClientBrief` |
| Stage progression: research, blueprint, content_briefs, content_drafting, technical_seo | **Automated** | When data/baseline exists (`applyAutoStageProgression`) |
| Stage progression: human_approval, production_deployment | **Manual by design** | Operator only |
| Client baseline capture after init / public intake | **Automated** | Background via Next `after()` / fire-and-forget; status `pending\|captured\|limited\|failed\|missing\|stale` |
| Baseline recapture on draft / design change | **Automated** | Mark stale + debounced recapture |
| Legacy thin CRM projects → factory workspace | **Automated (on demand)** | Idempotent `backfill-client-factories` op + `scripts/backfill-client-factories.mjs` |
| Analyze top 3 / `competitorUrls` fill | **Blocked on external setup** | No SERP/search API key in repo (`SERPER_API_KEY` / `BRAVE_SEARCH_API_KEY` / etc.). UI shows `needs_search_provider`. Manual `set-brief-competitors` only. |
| Final client-approved copy polish | **Manual by design** | Seed drafts are templated placeholders, not LLM research |
| Photos / logo / legal claims / pricing | **Manual by design** | Client-provided |
| DomainIQ domain candidates (generate + score) on client setup | **Automated** | Background via `after()` on intake / `init-client-factory` / backfill (`queueAutoDomainCandidates`). In-process engine, no server/key |
| Domain availability check (top 12 candidates) | **Automated** | Keyless public RDAP (Verisign .com/.net) + Cloudflare DNS NS, same sources as DomainIQ. `DOMAINIQ_AVAILABILITY=off` leaves them `unchecked` |
| Domain pick | **Manual by design** | Operator picks on `/app/clients/<projectId>` (or types a client-owned domain - it gets DomainIQ-scored) |
| Client already owns a domain | **Automated** | `domain` on intake / edit → `selectedDomain` + `domainStatus: client_owned`; no auto suggestions, no purchase sign-off (Generate still works on demand) |
| Domain purchase | **Manual by design** | Tony signs off (`domainiq-approve-purchase` records who/when). Sitesinc never buys, reserves, or registers a domain |
| City Launch: city picking (radius / top N in states / CSV paste) | **Automated** | Census dataset in-process (`lib/city-launch`), no key |
| City Launch: LLM writing of up to 500 city pages per batch | **Automated** (needs an LLM key) | Queued → ticks via `after()`; concurrency + RPM limited, retries with backoff, resumable. Missing key = UI says so, nothing is written |
| City Launch: uniqueness + quality gate | **Automated** | Runs after every batch / edit / regenerate; near-duplicates are blocked from approval |
| City Launch: approve city drafts | **Manual by design** | Operator / Tony approves on `/app/clients/<projectId>` (name recorded) |
| City Launch: approved pages on the client preview + sitemap | **Automated** | `/demo/client/<projectId>/locations/<citySlug>`, read from the store on request (no rebuild) |
| City Launch: real-domain publish | **Manual by design** | Tony's sign-off (`signoff-production`, records only) + the manual `production_deployment` stage |
| Netlify production publish for the client site | **Manual by design** | Preview ≠ live client domain |
| Search Console / analytics for a **live** client domain | **Manual by design** | Not required for preview baselines |

## Host resolution (auto baseline)

Honest order only - **never invents** `sitesinc.co` for auto-crawl:

1. Explicit `hostOrigin` / request origin from the API route
2. `DEPLOY_PRIME_URL`
3. `URL`
4. `NEXT_PUBLIC_SITE_URL`

If none resolve → baseline automation status **`missing`** with reason. Operator can still Capture manually when a host is reachable.

## Wired (detail)

1. **Structured client config** on `ClientProject`: `businessName`, `email`, `niche`, `businessType`, `city`, `state`, `phone`, `primaryGoal`, `notes`, `monitoringInterest`, `designStyleId`, `templateId`, `seededPages[]`, `factoryWorkspaceId`.
2. **Parsing helpers** in `lib/factory/client-config.ts`.
3. **Template binding** via `lib/factory/client-templates.ts`.
4. **Design binding** persists `designStyleId`; changes mark baseline stale + auto-recapture.
5. **Client-scoped research/blueprint/briefs/pages** + **auto draft seed** (`lib/factory/client-pipeline.ts`, `client-workspace.ts`, `client-drafts.ts`).
6. **Analyze top 3** field exists (`competitorUrls` + `set-brief-competitors`); auto-fill **not** wired (no search provider).
7. **Deliverable preview**: `/demo/client/[projectId]`. Operator: `/app/clients/[projectId]` (shows automation status).
   Built only from the client's own details (`lib/factory/client-preview.ts`): template-appropriate sections, bracketed
   "[client to supply]" placeholders, the client's pricing note or no prices at all. Never the marketing showcase
   (`MiniSiteFrame` sample prices / testimonials / "Live at sitesinc.co"). Guarded by `scripts/client-intake.test.mjs`.
8. **Ops actions**: `record-intake`, `init-client-factory`, **`update-client-config`**, `bind-client-design`, `set-brief-competitors`, `draft-client-page`, `capture-client-baseline`, **`backfill-client-factories`**.
   - `record-intake` (and the **New client project** form on `/app`) takes full client details: `businessName`,
     `contactName`, `email`, `phone`, `city`, `state`, `businessType`, `offer` (what they sell), `primaryGoal`,
     `pricingNote`, `domain`, `notes` (optional `templateId`, `designStyleId`). Returns `projectId`. No email is sent.
     The template is picked from business type / offer (never from the name or label). The goal is never the
     business or contact name; it falls back to a template default.
   - `update-client-config` (the **Edit client details** form on `/app/clients/<projectId>`) changes any of those
     fields on an existing project, rebuilds the seed-derived workspace (research notes, blueprint, briefs, templated
     drafts) from the new details, keeps approved / staged / published pages, approved briefs, competitor URLs and
     baselines, and queues a preview recapture. `init-client-factory` on an existing workspace does the same rebuild.
9. **Client baseline / crawl** + **auto queue** (`lib/factory/client-baseline.ts`, `client-automation.ts`).
10. **SEO Intelligence**: client projects with a factory workspace appear as their own site (`kind: client_preview`).

## DomainIQ bay (client domains)

**Approach: DomainIQ's engine runs in-process inside Sitesinc (TypeScript port), not as a proxied service.**

Why: DomainIQ's FastAPI `POST /generate` is not a standalone function - it requires a DomainIQ *project row in Postgres*
(`project_id`), persists results, enforces usage, and gates every name on live RDAP inside the request. Proxying it
would need a second always-on server + database + auth for Sitesinc to reach, and today it only runs on Tony's PC. The
part Sitesinc needs - the lexicon/rules generator and the `/score` engine - is pure and deterministic, so it is ported to
`lib/domainiq/` and works on Netlify with zero extra infrastructure, no env vars and no keys.

- `lib/domainiq/engine.ts` - port of `app/services/generation/*` (niche resolver, harvest, combiners, filters, engine)
  and `app/services/scoring/*` (analyzers, niche fit, weights, explanations). Pure, data injected.
- `lib/domainiq/data.generated.ts` - word lists, lexicon, niche profiles and scoring rules **exported from the real
  DomainIQ Python source** by `scripts/domainiq/export-domainiq.py` (run with DomainIQ's venv:
  `<DOMAINIQ>\.venv\Scripts\python.exe scripts\domainiq\export-domainiq.py <DOMAINIQ>`; re-run when DomainIQ's data
  changes). Do not edit by hand.
- `scripts/fixtures/domainiq-golden.json` - outputs of the real Python engine for plumbing / roofing / HVAC /
  unknown-niche requests and `/score` cases. `node --test scripts/domainiq.test.mjs` asserts the TS port matches them
  exactly (candidate order, ranking, every sub-score and contribution, summary, explanation).
- Not ported on purpose (live, rotating, or resale-only): UTC-date hot-niche rotation, live trends, sale-history
  harvest, liquidity / "flip score" blend, trademark prescreen. DomainIQ's RDAP oversample loop is replaced by a simpler
  availability-first pool (below). Ranking uses DomainIQ's quality
  score (the `/score` total), which still includes the major-brand confusion risk penalty.
- `lib/domainiq/client.ts` - seeds DomainIQ from `niche`, `businessName`, `city`, `state`: a **local** pass
  (DomainIQ `descriptive` style with niche + city + business tokens; keeps names containing the city/business) and a
  **brand** pass (DomainIQ `brandable`, the niche-selector default). Merged, deduped, ranked by DomainIQ score.
- `lib/domainiq/availability.ts` - optional keyless check, same sources DomainIQ uses: RDAP 404 + no DNS NS =
  `available`; RDAP 200 or NS records = `registered`; lookup failure = `error`; TLDs other than .com/.net =
  `unsupported_tld`. Never fakes `available`.
- `lib/factory/domainiq.ts` - persistence, `after()` automation, bay summary. Generation builds an 18 + 18 pool
  (local + brand), stores the top 12 unchecked right away, then (unless `DOMAINIQ_AVAILABILITY=off`) checks the whole
  pool (concurrency 8, 4 s timeout) and re-ranks with `rankByVerifiedAvailability`: verified-available names first
  (by score), then the best-scoring taken/unknown names fill up to 12. Short premium .com names are almost always
  registered (real Phoenix plumbing run: 34/36 taken), so this is what surfaces buyable names. The bay's try-it form
  sends `checkAvailability: true` to get the same ranking ad hoc.

**`ClientProject` fields:** `domainCandidates[]` (domain, score, band, source `local|brand|operator`, sub-scores,
summary, highlights/concerns, `availability`), `selectedDomain`, `domainStatus`
(`pending | candidates_ready | missing_input | failed | selected | purchase_approved`), `domainIQ` (engine, seed,
generatedAt, availability run, selectedBy/At, purchaseApprovedBy/At, `purchase: "manual"`).

**Ops actions** (`/api/factory/action`): `domainiq-generate` (force regenerate; keeps an existing pick),
`domainiq-check-availability`, `domainiq-select` (`domain`; a non-candidate domain is DomainIQ-scored and added as
`operator`), `domainiq-clear-selection`, `domainiq-approve-purchase` (`approvedBy`; records sign-off only),
`domainiq-backfill` (idempotent: projects with no candidates yet).

**API** (factory-auth protected by middleware): `GET /api/factory/domainiq` (status), `POST /api/factory/domainiq/generate`
(`{projectId}` persists, or `{niche,businessName,city,state}` ad-hoc), `POST /api/factory/domainiq/score`
(`{domain, niche?}`), `POST /api/factory/domainiq/availability` (`{domains[]}`, max 12).

**UI:** DomainIQ bay tile on `/app` (live per-status counts, per-client rows, try-it form) and the DomainIQ section on
`/app/clients/<projectId>` (scored table, Pick, availability, custom domain, purchase sign-off).

**Env:** none required. Optional `DOMAINIQ_AVAILABILITY=off` disables the outbound RDAP/DNS check (candidates then
stay `unchecked`).

## City Launch bay (animated city landing pages)

Tony approved multi-city pages. They replace the old blanket "no city doorway clones" rule, **but only through a quality
gate**: each city page must carry genuinely local, unique copy. A find-and-replace of the city name is blocked.

**Where:** City Launch section on `/app/clients/<projectId>` (`components/factory/CityLaunchPanel.tsx`), plus a bay tile on
`/app` (`components/factory/CityLaunchBay.tsx`). Pages are served at `/demo/client/<projectId>/locations/<citySlug>`.
The index is at `/demo/client/<projectId>/locations`, and the client sitemap is at `/demo/client/<projectId>/sitemap.xml`.
No WordPress anywhere.

### City data (real, committed)

`lib/city-launch/us-cities.generated.ts` holds 10,251 real U.S. places, each with state, 2024 population, lat/lng,
primary county and Census GEOID. `scripts/city-launch/build-us-cities.mjs` generates it from two U.S. Census Bureau
public-domain files:

- the **2024 Gazetteer Places** file (internal-point coordinates)
- **Vintage 2024 Population Estimates SUB-EST2024** (July 1, 2024 population, plus the primary county from the
  county-part rows)

Coverage is incorporated places in the 50 states + DC with population ≥ 1,000, plus Urban Honolulu. Consolidated
cities get their common name (Nashville, Louisville, Indianapolis, Boise...). There are no synthetic "Zone N" rows.

Regenerate with:
`node scripts/city-launch/build-us-cities.mjs <dir with 2024_Gaz_place_national.txt + sub-est2024.csv>`.

Known gap: unincorporated CDPs other than Honolulu (Highlands Ranch, The Woodlands, Metairie...) are missing, because
CDP population needs a Census API key. CSV paste still accepts them. They are flagged `csv` and get no coordinates;
nothing is invented.

Picking methods (`POST /api/factory/city-launch {op:"pick"}`), each capped at 500:

- `radius`: within X miles of the client's city (or any origin city), ordered by population
- `top_states`: top N cities by population in one or more states
- `csv`: the ScaleQuan template (`city,state,keyword,competitor_gaps,website_content`), the remix City Launch CSV, or
  bare `City, ST` lines

### What happens in a 500-city batch, end to end

1. **Pick (manual input).** The operator picks cities and adjusts the ScaleQuan-style settings: keyword, title
   template `{keyword} in {city}, {state}`, prompt template, competitor gaps, business context, target words
   (300-1500), FAQ on/off, concurrency and requests/min.
2. **Queue (automatic from here).** `queueCityLaunchBatch`:
   - refuses if there is no LLM key or more than 500 cities
   - re-resolves every city server-side against the dataset
   - skips cities that are already approved, or already in another active batch
   - writes `factory/clients/<projectId>/city-launch/batches/<batchId>` and the page registry
     `.../city-launch/index`, then starts a tick with `after()`

   These live in the same document store as the client workspace: Netlify Blobs on Netlify (revisioned keys),
   `./data` locally.
3. **Write.** Each tick (`runCityLaunchTick`):
   - takes a lease and runs a worker pool (default concurrency 4) under a sliding-window rate limiter
     (default 40 req/min)
   - makes **one LLM call per city**, in JSON mode
   - grounds the prompt in Census facts: population, county, the 6 nearest real cities with distance and compass
     direction, and the distance from the client's base

   The system prompt forbids invented business facts (licenses, years, reviews, prices, guarantees) and invented
   local statistics. It also requires a structured `serviceArea` paragraph that names the county and 2+ real nearest
   cities, and it caps region-wide filler. Two honesty blocks were added after the live runs:
   - **VOICE (business location).** On any city that is not the client's base, the page speaks as "serving
     <city> from <base city>". It must never say or imply the business is located, based or has an office there
     ("we are located in Chandler", "our Chandler office", "we are just 24 miles southeast of Phoenix"). The base
     city page may say "based in <base>".
   - **LOCAL FACTS ONLY.** Climate, water hardness, soil, hazards, housing age, growth pace, rankings, reputation
     and local regulations may only be stated from the facts given: Census population (2020 and latest), the
     population change since 2020, the city's population rank in its state, county, distances/directions, and the
     operator's optional **Verified local notes, with sources** field (`localFacts`, e.g. "Mesa water hardness ~14
     grains/gallon (City of Mesa 2025 Water Quality Report)"). Without a note, the page leaves such statements out.
     We chose this over a hand-made per-state facts table: a table would need its own sourcing and upkeep, and a
     state-level fact ("Arizona has hard water") is too coarse to be honest about one city.

   Replies are validated: at least 3 sections, a meta description, enough words, the city named, and no
   `{placeholders}`. Weak output counts as a failed attempt.

   Failures retry with exponential backoff that honours `Retry-After` (default 3 attempts). A rejected key pauses
   the batch with the reason shown in the UI.

   Progress is flushed to the batch doc every ~2.5s. Each draft is stored at
   `.../city-launch/drafts/<citySlug>`.
4. **Continue / resume (automatic).**
   - **Netlify, primary path: Background Function.** `netlify/functions/city-launch-background.mts` (the
     `-background` suffix gives a 15-minute limit and an immediate 202). Queue/continue POST the batch id to
     `/.netlify/functions/city-launch-background` with the factory session cookie; the function runs the same
     lease-guarded writing loop with a 13-minute budget, then hands off to a fresh invocation if cities remain.
     On by default on Netlify; `CITY_LAUNCH_BACKGROUND=off` disables it (`=on` forces it, e.g. under `netlify dev`).
   - **Proof of life + fallback.** The batch records `background.requestedAt` (before the trigger) and the function
     records `background.startedAt` first thing. A trigger that does not answer 202 falls back immediately. A
     hand-off that is not picked up within 90 s is logged ("background function did not start within 90s; using
     chained ticks") and the batch switches to the chained path below. While a hand-off is pending it is not
     re-triggered.
   - **Netlify, fallback: chained ticks.** A tick stops starting new calls once its budget is spent
     (`CITY_LAUNCH_TICK_BUDGET_MS`, 18s by default, inside the ~26s function limit). It then chains the next tick
     with a self-request to `/api/factory/city-launch/tick`, authenticated by the factory session.
   - **Locally (`next dev`):** the tick loops in-process until the batch is done. Under `netlify dev` the
     background function is used (verified with `netlify dev --offline` and the local Blobs sandbox).
   - Both hosted paths need `FACTORY_ACCESS_TOKEN` and the deploy URL env (`URL` / `DEPLOY_PRIME_URL`, set by
     Netlify) at runtime; without them the batch waits for the operator panel's auto-resume poll.
   - Modules shared with the function (`lib/persistence.ts`, `lib/factory/workspace.ts`,
     `lib/factory/client-domain.ts`) load `next/*` lazily (`lib/next-runtime.ts`): Netlify keeps `next` external in
     function bundles and plain Node ESM cannot resolve `next/headers`.
   - **Recovery:** if a function dies, its lease expires. Items stuck in `generating` for more than 4 minutes are
     re-queued. The operator panel polls and re-kicks a stalled batch, and *Resume* / *Retry failed* are buttons.
   - About 500 cities at 40 req/min takes roughly 13-15 minutes. Raise `requestsPerMinute` and `concurrency` if the
     provider allows it.
5. **Gate (automatic).** When a batch finishes (and after every edit or regenerate), `runCityGate` scores every live
   page (`lib/city-launch/gate.ts`, `similarity.ts`):
   - **Near-duplicate check.** Place names are masked (own city/state/county plus every city name in the client's
     launch), and digits are collapsed. Then 5-word shingles are compared pairwise across *all* of the client's
     city pages. The score is the overlap coefficient |A∩B|/min(|A|,|B|), so a find-and-replace clone scores ~1.0.
   - **Thresholds.** ≥ 0.35 → **block** (cannot be approved or published). ≥ 0.18 → **warn** (read both before
     approving).
   - **Other blocks:** < 300 words, city named fewer than 2 times, a leftover `{placeholder}`, or a missing meta
     description.
   - **Invented business claims:** "licensed / insured / bonded", "certified", guarantees or warranties, years in
     business, awards, ratings or reviews, free estimates, 24/7 or same-day, prices or discounts, family-owned.
     A claim made in the business's own voice ("we", "our", the business name) blocks the page unless the business
     context the operator gave supports it. While writing, the job first makes **one automatic repair call** that
     rewrites only those sentences (rate-limited, and skipped if the tick has no time left). Anything still left is
     blocked for a human edit. In the real test, gpt-4o-mini added "all our plumbers are licensed and insured" to
     3 of 5 pages even though the prompt forbids it, which is why this check exists.
   - **Honesty blocks** (`lib/city-launch/honesty.ts`), all of which block approval:
     - `location_claim`: first-person location claims on a non-base page ("we are located in", "we're based in",
       "our <city> office/shop/location", "we are just N miles", "<business> is just N miles from"). "Based in
       <base city>" is allowed.
     - `unverified_local`: climate / hard water / soil / hazards / housing age / regulations / "known for" /
       reputation / rankings not backed by the facts above; "rapid growth" needs ≥ +8% since 2020, "growing" ≥ +1%;
       "Nth-largest" must match the Census state rank.
     - `geo_claim`: a stated distance or compass direction between two cities that disagrees with Census
       coordinates (45° / 30% tolerance).
   - **Automatic repair.** While writing, the job makes up to `CITY_LAUNCH_REPAIR_ROUNDS` (default 2) repair calls
     that rewrite only the flagged sentences, for business claims and honesty issues alike (rate-limited, skipped if
     the tick has no time left). Anything still left is blocked for a human edit.
   - **Other warnings:** fewer than 2 local references (county, nearby cities, base city), or "our city / our
     community" wording on a city that is not the business's base.
   - Approved pages are compared only with other approved pages, so a newer draft that copies an approved page is
     the one that gets blocked.
6. **Review (manual by design).** For each city the operator can **Review / Edit** (title, meta, H1, subhead, intro,
   sections, highlights, FAQ, CTA), **Preview** the draft (`?preview=1`, signed-in operators only), **Regenerate**
   (a fresh LLM draft), **Reject / Reopen**, or **Approve**. Bulk "Approve N gate-passing drafts" is available.
   - Approval needs the approver's name, and the gate must not be `block`.
   - Any edit resets approval.
7. **On approval (automatic).** The page is immediately live on the client's **Sitesinc preview**: the server
   component reads the store on each request, so there is no rebuild.
   - The page appears in `/demo/client/<projectId>/locations`, in the client preview home "Service areas" list, in
     nearby-city links on other approved pages, and in `/demo/client/<projectId>/sitemap.xml`.
   - On the deployed Sitesinc Netlify site the same happens as soon as this code is deployed there, because
     approved pages are read from Blobs.
   - Preview pages are `noindex`. Their canonical is the preview URL until production sign-off, then the client's
     domain.
8. **Real domain (manual by design).** `signoff-production` records Tony's sign-off. It needs a selected domain and
   at least one approved page, and it deploys nothing. After sign-off, `sitemap.xml?target=production` lists
   client-domain URLs (it returns 409 before), and the app will serve the client's pages on that domain as soon as
   requests for it reach the production site (see **Serving on the client's real domain** below). Pointing the
   domain at Netlify is the manual go-live step. `revoke-production` withdraws the sign-off; domain serving stops
   on the next request, because every client-domain request re-checks the sign-off.

### Serving on the client's real domain

**How it works.** `middleware.ts` looks at the request `Host`:

- **Sitesinc hosts are unchanged:** `sitesinc.co` and subdomains, `*.netlify.app` / `*.netlify.live` (deploy,
  branch and preview hosts), localhost / IPs / bare names / `.local` / `.internal`, the deploy env URLs (`URL`,
  `DEPLOY_PRIME_URL`, `DEPLOY_URL`, `NEXT_PUBLIC_SITE_URL`, `SITE_URL`), and anything in `SITESINC_HOSTS`
  (comma/space separated; add Sitesinc's own extra custom domains here if it ever gets more). Direct
  `/client-domain/...` requests on these hosts return 404.
- **Any other host** is rewritten to `app/client-domain/[host]/...`, which serves only: `/`, `/locations`,
  `/locations/<citySlug>`, approved/staged/published workspace pages (`/<slug>`, e.g. `/contact`), `/sitemap.xml`
  and `/robots.txt`. Everything else (including `/app`, `/api`, `/demo`) is 404.
- The host must map to a `ClientProject` whose `selectedDomain` equals it (www and apex both match) **and** whose
  City Launch production sign-off is recorded. Lookup: the `factory/client-domains/<host>` index written at sign-off,
  then a cached (60 s) scan of client projects. Unknown or unsigned hosts get 404. `www.` ↔ apex requests get a 308
  to the selected form.
- Client-domain pages are indexable (`index, follow`), with canonical, Open Graph and sitemap URLs on
  `https://<client domain>`; only approved city pages appear. No Sitesinc chrome, ticker or sample copy is rendered.
- Kill switch: `CLIENT_DOMAIN_ROUTING=off` treats every host as a Sitesinc host.
- Tests: `node --test scripts/client-domain.test.mjs` (host classification, mapping, sign-off requirement,
  www/apex, sitemap).

**Manual Netlify step (only after Tony's sign-off; not automated, not done yet):**

1. Netlify → the Sitesinc **production** site → Site configuration → Domain management → Production domains →
   **Add domain alias** → `<client domain>` (Netlify adds the `www.` variant automatically). Use the production
   site only: branch/preview contexts set `NEXT_PUBLIC_FACTORY_PREVIEW=1`, which adds an `X-Robots-Tag: noindex`
   header to every response.
2. DNS at the client's registrar (or move the zone to Netlify DNS, which creates these itself):
   - apex `@`: ALIAS / ANAME / flattened CNAME → `apex-loadbalancer.netlify.com`, or, if the provider has none,
     an `A` record → `75.2.60.5`
   - `www`: `CNAME` → `<sitesinc-site>.netlify.app`
   - remove any old A/AAAA/CNAME records for those names
3. Wait for Netlify to verify DNS and issue the Let's Encrypt certificate (Domain management → HTTPS).
4. Check: `curl -I https://<domain>/` → 200 without `X-Robots-Tag`; `curl -I https://www.<domain>/` → a single
   308 to the apex (no redirect loop); `/sitemap.xml` lists only approved city URLs on the client domain. Then
   submit the sitemap in the client's Search Console.

Netlify recommends no more than 50 domain aliases per site, so past ~50 live clients this needs a different setup
(e.g. a separate Netlify site per batch of clients).

### The animated page template

`components/city-launch/CityLanding.tsx`, `city-landing.module.css`, and `CityReveal.tsx` (a ~1 KB client
IntersectionObserver).

**Motion** is CSS only: drifting gradient orbs, a hero rise, an SVG service map that draws lines from the city to
its real nearest neighbours (exact Census coordinates) with ripple rings, scroll reveal, and a CTA sheen. All of it
sits inside `@media (prefers-reduced-motion: no-preference)`. With reduced motion, or no JS, everything renders
static and visible. The H1 (the likely LCP element) is moved, never hidden. There are no images and no
framer-motion.

**Design:** colours and layout (center / split) follow the client's bound design style (`cityTheme`).

**SEO and lead path:**

- unique `<title>` / meta description from the draft
- JSON-LD `LocalBusiness` subtype per niche (e.g. `Plumber`) with `areaServed` City + geo, plus BreadcrumbList and
  FAQPage
- internal links to the nearest approved cities and to "All locations"
- CTA = `tel:` link (client phone) plus `/demo/client/<projectId>/contact?city=<slug>`, a sticky mobile call button

Sitesinc's own pricing ticker is hidden on `/demo/client/*`.

### LLM provider (names only)

The first key present wins:

1. `CITY_LAUNCH_LLM_API_KEY` (+ optional `CITY_LAUNCH_LLM_BASE_URL`, OpenAI-compatible, default OpenRouter, and
   `CITY_LAUNCH_LLM_MODEL`)
2. `OPENROUTER_API_KEY`
3. `OPENAI_API_KEY`
4. `ANTHROPIC_API_KEY`
5. `GEMINI_API_KEY`
6. `EMERGENT_LLM_KEY` (Emergent universal key, as used by ScaleQuan; `gpt-4o-mini`)

The UI shows which env var name and model are in use, or a **missing key** state that disables queueing. Keys are
never logged or returned.

Tuning env vars: `CITY_LAUNCH_CONCURRENCY`, `CITY_LAUNCH_RPM`, `CITY_LAUNCH_MAX_ATTEMPTS`,
`CITY_LAUNCH_LLM_TIMEOUT_MS`, `CITY_LAUNCH_TICK_BUDGET_MS`, `CITY_LAUNCH_REPAIR_ROUNDS` (default 2),
`CITY_LAUNCH_BACKGROUND` (`on`/`off`, default on Netlify). Hosted hand-off and self-chaining need
`FACTORY_ACCESS_TOKEN`. Domain serving: `CLIENT_DOMAIN_ROUTING=off` (kill switch), `SITESINC_HOSTS`.

### API

`GET /api/factory/city-launch?projectId=` returns provider status, page registry and active batch progress
(`&slug=` returns one draft).

`POST /api/factory/city-launch` with `{op, projectId}`:

- `pick`, `queue`
- `control` (`pause|resume|cancel|retry_failed`)
- `edit`, `regenerate`
- `approve` (`slugs[]`, `approvedBy`), `reject`, `reopen`
- `gate`
- `signoff-production`, `revoke-production`

`POST /api/factory/city-launch/tick` continues a batch, and is used for chaining and fallback.
`POST /.netlify/functions/city-launch-background` (`{projectId, batchId}`, factory session cookie) is the
background writer; it answers 202 on Netlify.

### Ported from ScaleQuan Content Studio

`POST /drafts/generate-batch` maps to `lib/city-launch/prompts.ts`:

- same placeholders (`{city}`, `{state}`, `{keyword}`), default title/prompt templates, the 500 cap, and per-row
  `keyword` / `competitor_gaps` / `website_content` from the CSV template
- runs in TypeScript inside Sitesinc; the Python server is not called
- ScaleQuan's non-AI heuristic fallback was deliberately **not** ported, because Sitesinc never fakes copy

### Local test

```
SITESINC_STORE=local node scripts/city-launch/seed-local-client.mjs "Desert Flow Plumbing" plumbing Phoenix AZ "(602) 555-0142"
# set one LLM key in the process env (never commit it), then
SITESINC_STORE=local npx next dev   # open /app/clients/<id>
node --test scripts/city-launch.test.mjs scripts/client-domain.test.mjs scripts/city-launch-background.test.mjs
# live 5-city run (real LLM, isolated temp store; key in the process env only):
node scripts/city-launch/live-test.mjs <empty-dir> 5 25
# background function locally, no Netlify login: CITY_LAUNCH_BACKGROUND=on FACTORY_ACCESS_TOKEN=<any local value>
netlify dev --offline --framework '#custom' --command 'npx next dev -p 3200' --target-port 3200 --port 8888
```

`netlify dev` uses the local Blobs sandbox (`.netlify/blobs-serve`, site id `unlinked`), not `./data`, so a client
project has to exist there first. Next 16 prints a deprecation notice for `middleware.ts` (renamed `proxy.ts`
upstream); it still works.

## Truthfulness rules

- Do not claim auto-publish happened.
- Do not claim LLM competitor research ran unless an operator attached sources (or a real search provider is wired later).
- Do not claim a client baseline exists unless `latestBaselineId` on that client workspace resolves to a snapshot with matching `siteId` (or automation status is `captured`/`limited` with a real id).
- Do not reuse Sitesinc, smith-plumbing, or kurtis baselines for a client.
- Sitesinc case-study kickoff remains Sitesinc-only.
- If host cannot be resolved, status is `missing` - never a faked crawl against production.
- Domain availability is `unchecked` until a real RDAP/DNS answer exists; lookup failures are `error`, never `available`.
- Never purchase/reserve a domain. `purchase_approved` only records Tony's sign-off; buying happens manually.
- City Launch never writes copy without a real LLM reply (no template fallback). A missing key is shown as missing.
- City pages are only publishable when approved by a named human **and** the gate is not `block`.
- City Launch `signoff-production` records Tony's sign-off only. It never deploys and never claims a page is live on
  the client's domain; the domain alias + DNS step is manual.
- A city page never says or implies the business is located in a city other than its base, and never states
  climate, water, housing, growth or ranking facts that are not in Census data or an operator note with a source.

## Operator path (happy path)

1. Intake or `init-client-factory` → structured config + client workspace + seeded drafts + queued auto baseline + queued DomainIQ domain candidates (with availability check).
2. Open `/demo/client/<projectId>` (local or staging host).
3. Confirm automation status on `/app/clients/<projectId>` (baseline status, drafts seeded, competitors needs_search_provider, stage auto-states).
4. Manual Capture still available if auto status is `missing`/`failed`.
5. Open SEO workspace (`?site=<projectId>`) for inventory/issues scoped to that site.
6. DomainIQ section: pick a domain (status `selected`), get Tony's sign-off (`purchase_approved`), buy manually at a registrar.
7. City Launch section: pick cities → queue (≤ 500) → watch progress → review / edit / regenerate → approve. Approved
   pages appear on `/demo/client/<projectId>/locations`. Tony signs off production, then the manual production deploy.
