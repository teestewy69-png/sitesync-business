# Per-client factory wiring

This note describes what is **fully wired** vs **still manual** after the per-client factory path landed on `staging-merge`.

## Model

- **Sitesinc growth case study** stays on `FACTORY_PROJECT_ID` (`sitesinc-growth-case-study`) and `factory/workspace`.
- **Each CRM client project** gets structured config fields on `ClientProject` plus its own workspace at `factory/clients/<projectId>/workspace`.
- Intake (`/api/subscribe`, `/api/inquiry` → `intakeToProject` → `recordIntakeProject`) no longer treats every lead as a mirror *into* the Sitesinc SEO factory as the build target. `factoryProjectId` on the intake mirror row is the **client project id**.

## Wired

1. **Structured client config** on `ClientProject`: `businessName`, `email`, `niche`, `businessType`, `city`, `state`, `phone`, `primaryGoal`, `notes`, `monitoringInterest`, `designStyleId`, `templateId`, `seededPages[]`, `factoryWorkspaceId`.
2. **Parsing helpers** in `lib/factory/client-config.ts` (normalize design id, infer niche/city/state/phone/goal from goals/details text).
3. **Template binding** via `lib/factory/client-templates.ts` (`local-service` ← smith-plumbing seed, `portfolio` ← kurtis seed, `general`). Binding seeds visible `seededPages` (slug/path/title/purpose/keywords).
4. **Design binding** persists `designStyleId` from `lib/design-styles.ts` on the project and in `workspace.clientContext`; deliverable preview uses `MiniSiteFrame` + `buildPreviewContent`.
5. **Client-scoped research/blueprint/briefs/pages** seeded from template + client niche/location/business (`lib/factory/client-pipeline.ts`, `client-workspace.ts`). Sitesinc `SEED_BRIEFS` / Sitesinc copy stay on the case-study workspace only.
6. **Analyze top 3** is attached to briefs via `competitorUrls` + factory action `set-brief-competitors` (not an untethered checklist checkbox).
7. **Deliverable preview**: `/demo/client/[projectId]` (and `/[slug]`) renders that client's structure + design. Operator surface: `/app/clients/[projectId]` (+ inbox links).
8. **Ops actions**: `init-client-factory`, `bind-client-design`, `set-brief-competitors`.

## Still manual

- Writing final client-approved copy (seed drafts are structured placeholders, not LLM research).
- Choosing / confirming real competitor URLs (operator fills `competitorUrls`).
- Photos, logo, legal claims, pricing the client has not provided.
- Capturing a live baseline crawl for the client (optional, operator-triggered).
- **Netlify production publish for the client site** — explicitly not auto-wired. Preview ≠ live client domain.
- Backfill of legacy thin CRM projects (use `init-client-factory` with `projectId`).

## Truthfulness rules

- Do not claim auto-publish happened.
- Do not claim LLM competitor research ran unless an operator attached sources.
- Sitesinc case-study kickoff (`kickoff-to-staging` / `kickoff-to-publish`) remains Sitesinc-only.
