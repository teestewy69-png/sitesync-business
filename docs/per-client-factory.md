# Per-client factory wiring

This note describes what is **fully wired** vs **still manual** after the per-client factory path (and client baseline/crawl + automation) landed on `staging-merge`.

## Model

- **Sitesinc growth case study** stays on `FACTORY_PROJECT_ID` (`sitesinc-growth-case-study`) and `factory/workspace`.
- **Each CRM client project** gets structured config fields on `ClientProject` plus its own workspace at `factory/clients/<projectId>/workspace`.
- Intake (`/api/subscribe`, `/api/inquiry` → `intakeToProject` → `recordIntakeProject`) no longer treats every lead as a mirror *into* the Sitesinc SEO factory as the build target. `factoryProjectId` on the intake mirror row is the **client project id**.
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
| Domain purchase | **Manual by design** | Tony signs off (`domainiq-approve-purchase` records who/when). Sitesinc never buys, reserves, or registers a domain |
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
8. **Ops actions**: `init-client-factory`, `bind-client-design`, `set-brief-competitors`, `draft-client-page`, `capture-client-baseline`, **`backfill-client-factories`**.
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

## Truthfulness rules

- Do not claim auto-publish happened.
- Do not claim LLM competitor research ran unless an operator attached sources (or a real search provider is wired later).
- Do not claim a client baseline exists unless `latestBaselineId` on that client workspace resolves to a snapshot with matching `siteId` (or automation status is `captured`/`limited` with a real id).
- Do not reuse Sitesinc, smith-plumbing, or kurtis baselines for a client.
- Sitesinc case-study kickoff remains Sitesinc-only.
- If host cannot be resolved, status is `missing` - never a faked crawl against production.
- Domain availability is `unchecked` until a real RDAP/DNS answer exists; lookup failures are `error`, never `available`.
- Never purchase/reserve a domain. `purchase_approved` only records Tony's sign-off; buying happens manually.

## Operator path (happy path)

1. Intake or `init-client-factory` → structured config + client workspace + seeded drafts + queued auto baseline + queued DomainIQ domain candidates (with availability check).
2. Open `/demo/client/<projectId>` (local or staging host).
3. Confirm automation status on `/app/clients/<projectId>` (baseline status, drafts seeded, competitors needs_search_provider, stage auto-states).
4. Manual Capture still available if auto status is `missing`/`failed`.
5. Open SEO workspace (`?site=<projectId>`) for inventory/issues scoped to that site.
6. DomainIQ section: pick a domain (status `selected`), get Tony's sign-off (`purchase_approved`), buy manually at a registrar.
