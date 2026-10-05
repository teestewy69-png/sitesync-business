# Per-client factory wiring

This note describes what is **fully wired** vs **still manual** after the per-client factory path (and client baseline/crawl) landed on `staging-merge`.

## Model

- **Sitesinc growth case study** stays on `FACTORY_PROJECT_ID` (`sitesinc-growth-case-study`) and `factory/workspace`.
- **Each CRM client project** gets structured config fields on `ClientProject` plus its own workspace at `factory/clients/<projectId>/workspace`.
- Intake (`/api/subscribe`, `/api/inquiry` → `intakeToProject` → `recordIntakeProject`) no longer treats every lead as a mirror *into* the Sitesinc SEO factory as the build target. `factoryProjectId` on the intake mirror row is the **client project id**.
- **Baselines are site-scoped.** A client baseline uses `siteId = projectId`, crawls `/demo/client/<projectId>`, and is stored on that client's workspace (`latestBaselineId`). Day 0 / case-study pickers never fall across to demos or client previews (see `baseline-pick.ts`).

## Wired

1. **Structured client config** on `ClientProject`: `businessName`, `email`, `niche`, `businessType`, `city`, `state`, `phone`, `primaryGoal`, `notes`, `monitoringInterest`, `designStyleId`, `templateId`, `seededPages[]`, `factoryWorkspaceId`.
2. **Parsing helpers** in `lib/factory/client-config.ts` (normalize design id, infer niche/city/state/phone/goal from goals/details text).
3. **Template binding** via `lib/factory/client-templates.ts` (`local-service` ← smith-plumbing seed, `portfolio` ← kurtis seed, `general`). Binding seeds visible `seededPages` (slug/path/title/purpose/keywords).
4. **Design binding** persists `designStyleId` from `lib/design-styles.ts` on the project and in `workspace.clientContext`; deliverable preview uses `MiniSiteFrame` + `buildPreviewContent`.
5. **Client-scoped research/blueprint/briefs/pages** seeded from template + client niche/location/business (`lib/factory/client-pipeline.ts`, `client-workspace.ts`). Sitesinc `SEED_BRIEFS` / Sitesinc copy stay on the case-study workspace only.
6. **Analyze top 3** is attached to briefs via `competitorUrls` + factory action `set-brief-competitors` (not an untethered checklist checkbox).
7. **Deliverable preview**: `/demo/client/[projectId]` (and `/[slug]`) renders that client's structure + design. Operator surface: `/app/clients/[projectId]` (+ inbox links).
8. **Ops actions**: `init-client-factory`, `bind-client-design`, `set-brief-competitors`, `draft-client-page`, **`capture-client-baseline`**.
9. **Client baseline / crawl** (`lib/factory/client-baseline.ts` + existing `lib/factory/crawl.ts`):
   - Operator captures from `/app/clients/[projectId]` or SEO Intelligence (`?site=<projectId>`), or via `capture-client-baseline`.
   - Origin is the honest preview URL: `{host}/demo/client/<projectId>` with crawl paths from that client's seeded pages.
   - Snapshot `siteId` / `projectId` = client project id. Shared baseline store; **pointer** lives on the client workspace only (Sitesinc `latestBaselineId` is never set from a client crawl).
   - If the preview is down or thin, the UI shows **missing/limited** — pages are not invented.
10. **SEO Intelligence**: client projects with a factory workspace appear as their own site (`kind: client_preview`). Pages/issues/preflight bind to that site's baseline only.

## Still manual

- Writing final client-approved copy (seed drafts are structured placeholders, not LLM research).
- Choosing / confirming real competitor URLs (operator fills `competitorUrls`).
- Photos, logo, legal claims, pricing the client has not provided.
- Running the baseline capture when the preview host is reachable (operator-triggered; not a background crawler).
- **Netlify production publish for the client site** — explicitly not auto-wired. Preview ≠ live client domain.
- Search Console / analytics for a **live** client domain (not required for preview baselines).
- Backfill of legacy thin CRM projects (use `init-client-factory` with `projectId`).

## Truthfulness rules

- Do not claim auto-publish happened.
- Do not claim LLM competitor research ran unless an operator attached sources.
- Do not claim a client baseline exists unless `latestBaselineId` on that client workspace resolves to a snapshot with matching `siteId`.
- Do not reuse Sitesinc, smith-plumbing, or kurtis baselines for a client.
- Sitesinc case-study kickoff (`kickoff-to-staging` / `kickoff-to-publish`) remains Sitesinc-only.

## Operator path (happy path)

1. Intake or `init-client-factory` → structured config + client workspace.
2. Open `/demo/client/<projectId>` (local or staging host).
3. On `/app/clients/<projectId>`, **Capture client baseline** (or SEO workspace with `?site=<projectId>`).
4. Confirm baseline id, `capturedAt`, pages OK on the client page; open SEO workspace for inventory/issues scoped to that site.
