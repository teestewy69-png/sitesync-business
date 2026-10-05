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

## Truthfulness rules

- Do not claim auto-publish happened.
- Do not claim LLM competitor research ran unless an operator attached sources (or a real search provider is wired later).
- Do not claim a client baseline exists unless `latestBaselineId` on that client workspace resolves to a snapshot with matching `siteId` (or automation status is `captured`/`limited` with a real id).
- Do not reuse Sitesinc, smith-plumbing, or kurtis baselines for a client.
- Sitesinc case-study kickoff remains Sitesinc-only.
- If host cannot be resolved, status is `missing` - never a faked crawl against production.

## Operator path (happy path)

1. Intake or `init-client-factory` → structured config + client workspace + seeded drafts + queued auto baseline.
2. Open `/demo/client/<projectId>` (local or staging host).
3. Confirm automation status on `/app/clients/<projectId>` (baseline status, drafts seeded, competitors needs_search_provider, stage auto-states).
4. Manual Capture still available if auto status is `missing`/`failed`.
5. Open SEO workspace (`?site=<projectId>`) for inventory/issues scoped to that site.
