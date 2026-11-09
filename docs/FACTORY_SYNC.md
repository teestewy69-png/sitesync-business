# Local Website Factory backup + production sync (Windows)

Tony’s local Factory repo (`C:\Users\Vero2\Sitesinc-Factory`) shares git history with public [sitesinc.co](https://sitesinc.co). This tooling fast-forwards **local code** to the **exact published Netlify production commit**, not to GitHub `origin/master`.

It does **not** run on Grok Bot. It is a user-requested, one-time install on Tony’s PC. Cloud agents must not touch that PC.

## What it will and will not do

Does:

- Read public `https://sitesinc.co/release.json` (no Netlify token, no cookies).
- `git fetch origin` only after the `origin` URL is the known GitHub repo.
- Verify the production SHA is a 40-character hex commit **and** an ancestor of `origin/master`.
- Backup verified code (`git bundle`) plus local `.env.local` and `data/factory` + `data/store` **before** any update.
- `git merge --ff-only <productionSha>` when the tree is clean.
- Defer while Factory is already bound to `127.0.0.1:3000` (no process killing).
- Run `npm ci` only when `package-lock.json` changed, or `package.json` **dependency fields** changed. A scripts-only `package.json` edit is not an install change; status is `updated` with `deps: unchanged`.
- Run before `Start Sitesinc Factory.bat` so tests are not against stale published code.

Does **not**:

- `git reset --hard`, `git stash`, `git clean`, force push, any push, or any deploy.
- Follow `remote` / `command` / `url` / `script` fields if they ever appear in `/release.json`.
- Fall back to `origin/master` when metadata is missing or invalid (fail closed).
- Claim env/data parity. **`codeInSync` is git-only.** Production Netlify env secrets are not local `.env.local`. Production CRM lives in Netlify Blobs, not `data/store`.
- Upload backups or secrets to GitHub.
- Kill unrelated `node` processes or a running Factory.

## Production change required before the job can FF

Live production currently has **no** public commit metadata (`GET https://sitesinc.co/release.json` is 404; `/api/health` has no SHA). This PR adds a **build-time** manifest:

1. Merge this PR to `master` (parent obtains Tony’s approval).
2. Publish a normal Netlify **production** deploy of `sitesyncllc` (`SITE_ID` `e4f05aab-7228-4962-87c3-2035218d94db`).
3. Confirm `https://sitesinc.co/release.json` returns JSON like:

```json
{
  "schema": "sitesinc-production-release/v1",
  "present": true,
  "commit": "<40-char SHA of that production deploy>",
  "context": "production",
  "site": "sitesinc.co",
  "publishedAt": "<ISO>"
}
```

Until step 3, the local job **logs `manifest_missing` and does not change git**. The Start shortcut still launches Factory.

The generator runs as part of `npm run build` from Netlify `COMMIT_REF`. Preview, branch, staging (`NEXT_PUBLIC_SITE_ENV=staging`), and local builds keep the stub (`present: false`) so they 404. Invalid `COMMIT_REF` on a real production publish **fails the build**.

No Netlify token is required in any local script.

## Install (Tony’s PC, after the production publish)

Environment: Windows PowerShell 5.1, git 2.54, Node 22, repo on `master`.

From an ordinary (non-admin is fine) PowerShell:

```powershell
cd C:\Users\Vero2\Sitesinc-Factory
git fetch origin
git checkout master
git merge --ff-only origin/master
npm ci
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\factory-sync\windows\install.ps1
```

Defaults (override with `-RepoRoot`, `-BackupDir`, `-DesktopDir`):

| Path | Role |
| --- | --- |
| `C:\Users\Vero2\Sitesinc-Factory` | git checkout |
| `C:\Users\Vero2\factory-backups` | backups, `status.json`, logs, lock |
| `C:\Users\Vero2\OneDrive\Desktop\Start Sitesinc Factory.bat` | launcher (replaced; previous copy saved under `factory-backups\launcher-previous\`) |

The installer also writes:

- Desktop `Sync Factory Now.bat`
- Desktop `Factory Sync Status.bat`
- Task Scheduler `SitesincFactorySync` every 15 minutes, `MultipleInstances = IgnoreNew`
- `scripts\factory-sync\windows\local-config.json` (gitignored)

Dry run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\factory-sync\windows\install.ps1 -DryRun
```

Manual sync without the installer:

```powershell
cd C:\Users\Vero2\Sitesinc-Factory
node scripts\factory-sync\sync.mjs --reason=manual
node scripts\factory-sync\sync.mjs --status
```

## Pause / resume / uninstall

```powershell
cd C:\Users\Vero2\Sitesinc-Factory
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\factory-sync\windows\pause.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\factory-sync\windows\resume.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\factory-sync\windows\uninstall.ps1
```

Uninstall removes the scheduled task only. Backups, secrets, repo, `.env.local`, and `data\` stay. `Start Sitesinc Factory.bat` stays unless you pass `-RemoveDesktopShortcuts` (that still leaves the Start bat).

## Status and logs

| File | Meaning |
| --- | --- |
| `C:\Users\Vero2\factory-backups\status.json` | last run: `codeInSync`, `codeSync`, SHAs, message |
| `C:\Users\Vero2\factory-backups\PENDING-SYNC.txt` | present only while a production FF is deferred because Factory is running |
| `C:\Users\Vero2\factory-backups\logs\factory-sync.log` | append-only log (rotated at ~2MB) |

`codeSync` values: `in_sync`, `updated`, `updated_deps_failed`, `deferred_factory_running`, `blocked_dirty`, `blocked_untracked_collision`, `blocked_ahead`, `blocked_diverged`, `blocked_origin`, `manifest_missing`, `manifest_invalid`, `network_failure`, `backup_failed`, `lock_held`.

`updated` means git HEAD matches production. `deps` is `unchanged` unless an install was needed. `updated_deps_failed` means git already moved and `npm ci` then failed (`deps: npm_ci_failed`); the log has the npm error tail. Stop Factory on `127.0.0.1:3000` before retrying `npm ci` — Windows often locks `node_modules` while `next dev` is running. Sync is supposed to defer the git update while that port is listening.

## Backups and retention

```
C:\Users\Vero2\factory-backups\
  code\<utc>_<sha>\     repo.bundle + verified.ok   (keep 10 verified versions)
  secrets\<utc>_<sha>\  .env.local                  (ACL-restricted, never pruned by the job)
  data\<utc>_<sha>\     factory\ and store\
  launcher-previous\    previous Start bat
```

Code prune deletes **only** `code\` folders whose names match `YYYY-MM-DDTHH-MM-SSZ_<sha>` **and** contain `verified.ok`. Unrelated files in `factory-backups` are never deleted. Secrets backups stay local with restricted permissions.

## Stop conditions (no data loss)

Sync stops, without rewriting git, when:

- tracked files are dirty
- an untracked file would be overwritten
- local history is ahead of or diverged from production
- `origin` is not `github.com/teestewy69-png/sitesync-business`
- Factory is listening on `127.0.0.1:3000`
- backup verification fails
- another sync holds the lock
- `/release.json` is missing, not JSON, wrong schema, or SHA is not in origin

## Parent one-time local FF

If local `master` is behind today’s published SHA `f69a60bc57aa8f31302a484763e8c1aa4d5de9d4`, parent does that backed-up fast-forward **separately**. This job only fast-forwards; it will not reset a local checkout that is ahead of production.

## Files

| Path | Role |
| --- | --- |
| `scripts/factory-sync/lib.mjs` | sync engine |
| `scripts/factory-sync/sync.mjs` | CLI |
| `scripts/factory-sync/write-production-release-manifest.mjs` | production `/release.json` bake |
| `scripts/factory-sync/windows/*` | install / task / shortcuts |
| `app/release.json/route.ts` | public manifest route |
| `lib/generated/production-release.json` | committed stub; overwritten on production build only |
