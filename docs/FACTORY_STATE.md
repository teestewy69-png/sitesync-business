# Factory / SEO state persistence

Factory state (workspace, dated baselines, QA checklists, uploaded screenshots) lives in the same
durable layer as leads: `lib/persistence.ts`.

| Where it runs | Backend | Location |
| --- | --- | --- |
| Netlify production | Netlify Blobs store `sitesinc-crm` | keys `factory/...` |
| Netlify staging (`NEXT_PUBLIC_SITE_ENV=staging`) | Netlify Blobs store `sitesinc-crm-staging` | keys `factory/...` |
| Local / dev | files under `data/` (git-ignored) | unchanged from before |

## Keys

| Key | Local file | Content |
| --- | --- | --- |
| `factory/workspace` | `data/factory/workspace.json` | the workspace document |
| `factory/baselines/<id>` | `data/factory/baselines/<id>.json` | one dated crawl baseline |
| `factory/checklists/<project>` | `data/factory/checklists/<project>.json` | operator QA checklist |
| `factory/screenshots/<file>` | `data/factory/screenshots/<file>` | uploaded image (binary blob) |
| `factory/health-probe` | `data/factory/health-probe.json` | write/read probe used by health checks |

## Behaviour

- **Writes never fail silently.** `writeWorkspace`, `updateWorkspace`, `saveBaseline`, `saveScreenshot`,
  `writeChecklist` throw a `StoreError`; `/api/factory/*` routes answer 500 (409 on a write conflict) with the
  error text and the UI shows it ("Not saved: ...").
- **Fresh store ("not initialized"):** reads serve the code-default workspace (cached per process so dates are
  stable) but do not write. A stored document that is corrupt or has an unexpected project id makes reads/writes
  fail loudly instead of being reseeded over.
- **The public intake mirror never creates the workspace.** `recordIntakeProject` (called by the public
  `/api/subscribe`, the website build request; `/api/inquiry` was removed with the shop on 2026-10-05) saves the lead + project in the CRM first, then mirrors into the workspace
  *only if a workspace document already exists* (`updateExistingWorkspace`). On a store with no workspace it
  writes nothing and logs `Factory workspace mirror SKIPPED ...` with `console.warn`; the lead is unaffected.
  Reason: a visitor submitting the form on a fresh store used to persist the code-default seed, which made a later
  create-only migration skip the real workspace.
- **Initializing the store.** The workspace document appears when (a) the workspace is migrated, or (b) an
  operator runs `POST /api/factory/action` with `{"op":"init-workspace"}` (operator session cookie required;
  create-only, returns `created:false` and changes nothing if a workspace exists), or (c) any other `/app`
  operator action that updates the workspace runs (operator actions are deliberate, so they may create it).
  Until then the mirror is off and `/api/health` reports `workspace: "not_initialized"` (informational, not unhealthy).
- **Concurrency (revisioned documents).** The workspace and the QA checklists are read-modify-written through
  `updateWorkspace` / `writeChecklist`. On Netlify Blobs they use race-safe revisions (see "Write path" below), not
  ETag `onlyIfMatch`. On a conflict the mutation is re-applied to the fresh copy (up to 30 rounds, jittered backoff;
  calls inside one process are queued), then a 409 is returned (never a silent loss). Limitations: the whole workspace is
  one document (every change rewrites it); the checklist is a whole-document replace sent by the browser, so two tabs
  saving different edits means the last save wins; local-dev locking is per process only.
- **Blobs context in server components.** Server-rendered pages cannot see the request, so every
  document/record function in `lib/persistence.ts` calls `ensureBlobsContext()` (alias `getFactoryContext()`),
  which reads `headers()` itself and connects Blobs from the `x-nf-blobs` header when the runtime did not
  inject `NETLIFY_BLOBS_CONTEXT`. It is a no-op with the local backend. A page that reads factory state therefore
  cannot forget it. This is the part that must be proven on staging with a cold-start page load.
- **Public pages degrade, `/app` stays strict.** `/case-study` and the published factory pages
  (`/website-design`, `/packages`, ...) use `readPublicWorkspace()` / `readPublicCaseStudy()`: if the store fails
  or the workspace is corrupt they log (`console.error`, no secrets) and render a placeholder / 404 / noindex
  metadata, never a 500. All `/app/*` pages and `/api/factory/*` routes keep failing loudly.
- **Health:** `GET /api/health` (unauthenticated, minimal) now includes `factoryStoreWritable` (real write+read
  probe via `docStoreHealth()`) and `workspace` (`ok | not_initialized | corrupt | unreadable`). `ok` is `false`
  with HTTP 503 when the CRM store is not writable, the factory probe fails, or the workspace is corrupt/unreadable.

## One-click publish (decision)

`kickoff-to-publish` / `publish-pages` changes the workspace document at runtime. That means an operator click in
`/app` makes a factory page live on the production site **immediately, with no code deploy** (before this change
publishing needed a deploy carrying the git-ignored file). This is intentional and kept as is. Consequences:
the production site is only as safe as the operator login (`FACTORY_ACCESS_TOKEN`); there is no second approval
step; roll a page back with the `rollback` action (or edit the workspace) - no deploy needed; export before bulk
publishing. Homepage is still never replaced automatically.

## Backup / export (manual)

`GET /api/factory/export` (operator session required, same cookie as `/app`) downloads one JSON file with leads,
inquiries, projects, orders (Stripe checkout URLs removed), workspace, baselines and checklists. It contains
customer names and emails: store it privately. Manual export is the backup strategy (no schedule, no restore tool).

The file has a `warnings` array. Empty means nothing was skipped. Entries:
`baseline_corrupt` / `baseline_invalid` (a stored baseline could not be read and is NOT in the export),
`workspace_not_persisted` (the workspace shown is only the code-default seed). Counts include `baselinesSkipped`.
`screenshots.bytesIncluded` is `false`: image files are not in the export, only references
(`factory.workspace.screenshots`); back the images up separately if they matter.

## Migrating existing local state

`node scripts/migrate-factory-state.mjs --target <local|staging|production> [options]` (header of the script has the
full list). Dry run by default, creates only (never overwrites unless `--overwrite`), never deletes, verifies by
reading back.

What is migrated (decision): **only real SEO baselines and the QA checklist.**

- `--only baselines,checklists` (default group set is `baselines,checklists,screenshots`; the **workspace is skipped
  unless you add it**). `--exclude screenshots` etc. remove groups.
- Demo / local-dev baselines (origin `127.0.0.1`, `localhost`, or a `/demo/` path - e.g. the Smith Plumbing and
  Kurtis demo sites) are **excluded by default** (`--include-demo-baselines` to copy them).
- If you do include the workspace you must choose `--scrub-workspace` (strips `intakeProjects`, conversion
  events and deployment records, keeps briefs/pages/stages/study/indexing/backlinks) or `--workspace-as-is`.
- Staging/production **apply** also needs `--site-id`, `--expect-host <host>`, `--confirm-site <same id>` and env
  `NETLIFY_AUTH_TOKEN`. Before any write the script calls the Netlify API (`GET /sites/{id}`) and refuses unless the
  site really serves `--expect-host`; `--target staging` requires a `test.*` host and `--target production`
  refuses a site that has any `test.`/`staging.` host. The token is only read from the environment, never printed.

Example (staging, real baselines + checklist only):

```
node scripts/migrate-factory-state.mjs --target staging --source <main checkout>\data --only baselines,checklists
# review the list (expect the Sitesinc baselines + 1 checklist, demo baselines under SKIP), then:
$env:NETLIFY_AUTH_TOKEN = "<short-lived token>"
node scripts/migrate-factory-state.mjs --target staging --source <main checkout>\data --only baselines,checklists `
  --site-id <staging site id> --confirm-site <staging site id> --expect-host test.sitesinc.co --apply
```

### First-deploy order (important)

1. **Migrate first, deploy second.** Put the baselines/checklist into the target store before the new code is live
   on that site. The old code never reads `factory/*` keys, so this is inert. Production: dry run with
   `--target production --i-know-this-is-production`, then `--apply` (create-only, never `--overwrite`).
2. Deploy the new code to that site.
3. Initialize the workspace: `POST /api/factory/action {"op":"init-workspace"}` while logged in to `/app`
   (or do any operator action). Until then the intake mirror is deliberately off.
4. Verify (see `docs/STAGING.md`), then take an export and keep it as the dated backup.

### Rollback notes

- Redeploy the previous Netlify deploy ("Publish deploy"). The new `factory/*` keys stay in Blobs; the old code
  never reads them, so CRM data is unaffected.
- Workspace edits made while the new code was live remain in `factory/workspace` and are invisible to old code:
  **export before rolling back.**
- To discard migrated factory state, delete only the `factory/` keys of that store with Netlify Blobs tooling.
  The migration script has no undo. Never delete other keys.
- Do not use `--overwrite` on a store that has live edits: it replaces keys without a backup.

### Write path on Blobs: why not `onlyIfMatch` (finding from real staging Blobs)

Staging verification on real Blobs found that ETag `onlyIfMatch` is **not airtight under overlap**: with 10 simultaneous
read-modify-write updates to one key, several writers read the same ETag and all got `modified:true`, so 7-9 of 10 updates
survived in every trial (pairs of writers were safe 20/20). `onlyIfMatch` on a missing key also answered
`{modified:true, etag:""}` while creating nothing. `onlyIfNew` was race-safe (20/20 single winner). Reads do return ETags.

Chosen design (`lib/revisioned-docs.ts`, used for `factory/workspace` and `factory/checklists/*` only):

- Revision *n* of a document is the append-only claim blob `_rev/<key>/<n>` = `{rev, id, at, value}`. A writer that last saw
  revision *r* writes claim *r+1* with `onlyIfNew`. Exactly one writer can win slot *r+1*; everyone else gets
  `modified:false` = conflict, re-reads, re-applies its change and retries. No lock, lease, expiry or stale-lock takeover.
- The document key itself stays a readable copy with `metadata.rev` (created with `onlyIfNew` = revision 1, rolled forward
  after each win). It is only a hint: readers follow claims `r+1, r+2, ...` until one is missing, so a failed or stale
  roll-forward can never hide a committed update, and a writer that dies after winning has still committed.
- Creation never uses `onlyIfMatch`. A document without metadata (the migration script's output) is revision 0.
- The newest 50 claims are kept (older ones deleted). A writer would have to be 50 revisions stale to re-claim a deleted slot.
- Cost: a read is 2 requests (base + one probe for the next claim) instead of 1; a write is 2 (claim + base copy) plus an
  occasional delete. Fine for one operator.
- Local-json mode is unchanged (content-hash compare inside one process); the in-process update queue is kept.
- Other keys (baselines, screenshots, health probe, leads) keep the plain get/set path.
- The ETag "no ETag" fallback no longer applies to the workspace/checklists. It only remains for keys written with the
  generic unconditional `writeDoc`.

Storage notes: the `_rev/...` keys live in the same store (`sitesinc-crm` / `sitesinc-crm-staging`) and are not listed by
`listDocKeys`. To discard a revisioned document completely, delete BOTH `factory/workspace` (or the checklist key) and its
`_rev/<key>/` keys; `migrate-factory-state.mjs --overwrite` on a store with live revisions would only replace the hint copy
(revision 0) and the old claims would win again, so do not use `--overwrite` there. Rollback to older code is still clean:
older code reads only the base key, which is kept current by the roll-forward (it may lag a revision or two).

## Local mock-Blobs run (what it did and did not show)

The e2e run also exercised `SITESINC_STORE=blobs` against the BlobsServer mock that ships with
`@netlify/blobs` (`@netlify/blobs/server`): create-only init, 20 simultaneous updates across two app instances without loss, a
binary screenshot round trip, corrupt-JSON detection (`SyntaxError` -> `corrupt`), and graceful public pages.
Two findings to carry to staging:

- **Concurrency mock (kept outside the repo) and `scripts/revisioned-docs.test.mjs`** simulate the real finding: stale
  ETags accepted while writers overlap, `onlyIfMatch` on a missing key reporting success, atomic `onlyIfNew`. The old
  algorithm loses updates there; the revisioned algorithm loses none at 10- and 20-way concurrency. This is a model of the
  observed behaviour, not the real service. Local results: OLD (onlyIfMatch) lost 90/100 (10-way x10) and 107/120 (20-way x6)
  against the stale-ETag mock; NEW lost 0 (unit sim 10-way x30 and 20-way x20; real @netlify/blobs client 10-way x10 and
  20-way x6). The mock is deliberately harsher than staging (which kept 7-9 of 10), so the OLD counts are an upper bound;
  the NEW result, zero lost, is what matters.
- **Header-derived context and strong reads:** with the installed `@netlify/blobs` 11.1.0, `connectLambda()` (the
  `x-nf-blobs` header route) sets no `uncachedEdgeURL`, and the store is opened with `consistency: "strong"`, which
  that library refuses without it (`BlobsConsistencyError`). The header route therefore only works if the platform also
  injects `NETLIFY_BLOBS_CONTEXT` (with `uncachedEdgeURL`). This affects leads too (same `getCrmStore()`), predates
  this change, and must be confirmed on staging. The shared `ensureBlobsContext()` does connect the context from
  the header in server components (verified), it just cannot add what the header does not carry.

## Still to re-verify on real staging Blobs (needs Tony's OK and a short-lived token)

Run a scratch-key test only (never `factory/workspace` itself): create `scratch/rev-test` via the revisioned path, then
run 10-way and 20-way simultaneous read-modify-write trials (a few trials each) and confirm zero lost updates; confirm
`onlyIfNew` on claim keys keeps a single winner under 20 writers; confirm `get` of the next claim key is visible
immediately after a `set` on another connection (strong consistency / `uncachedEdgeURL`); confirm `delete` of old claims
works; then delete the scratch keys. Also still unproven: the `x-nf-blobs` header route (see above), list behaviour,
the binary round trip, and the Netlify build/function runtime. Local runs use the `local-json` backend or in-memory mocks.
