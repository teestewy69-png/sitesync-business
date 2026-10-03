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
- **Fresh store:** reads serve the code-default workspace (cached per process so dates are stable) but do not
  write. The seed is persisted by the first successful write (`updateWorkspace`). A stored document that is
  corrupt or has an unexpected project id makes reads/writes fail loudly instead of being reseeded over.
- **Concurrency:** `updateWorkspace` is optimistic read-modify-write: the write is conditional on the version read
  (Blobs ETag; content hash locally). On a conflict the mutation is re-applied to the fresh copy (up to 10 tries, with jittered backoff; calls inside one process are queued),
  then a 409 is returned. Limitations: the whole workspace is one document (every change rewrites it); the
  checklist is a whole-document replace sent by the browser, so two tabs saving different edits means the last
  save wins; local-dev locking is per process only.
- **Public intake** records the CRM lead/project first and then mirrors to the workspace; if only the mirror
  write fails the lead is kept and the failure is logged with `console.error`.

## Backup / export

`GET /api/factory/export` (operator session required, same cookie as `/app`) downloads one JSON file with leads,
inquiries, projects, orders (Stripe checkout URLs removed), workspace, baselines and checklists. It contains
customer names and emails: store it privately. Screenshot images are not embedded; the workspace lists their refs.

## Migrating existing local state

`node scripts/migrate-factory-state.mjs --target <local|staging|production> [--source data] ...`

Dry run by default; `--apply` is required to write; production additionally needs `--i-know-this-is-production`;
existing keys are skipped unless `--overwrite`. See the header of the script. Run the migration **before** the
first factory action on a Netlify site (the first write on an empty store persists the code-default seed, and a
create-only migration will then skip `factory/workspace`).
