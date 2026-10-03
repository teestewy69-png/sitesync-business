# Staging site (`test.sitesinc.co`)

The staging copy is a **separate Netlify site** that builds this repo from the `staging` branch. Production (`sitesyncllc` / `sitesinc.co`) stays on `master` and must not receive these flags.

Staging isolation is **opt-in**. If the flag is absent, every code path matches production.

## Required env var

Set this on the staging Netlify site only (Site settings → Environment variables). Use the same scopes you use for the rest of the staging env (typically all deploy contexts on that site).

| Variable | Value | Why |
|---|---|---|
| `NEXT_PUBLIC_SITE_ENV` | `staging` | Canonical flag. Available at build time and in both server and client bundles. |

`SITE_ENV=staging` is an equivalent **server-only** fallback. Prefer `NEXT_PUBLIC_SITE_ENV` so robots headers, the “Test site” badge, and analytics gating all see the same value.

Do **not** set either variable on the production site. Do **not** infer staging from Netlify `CONTEXT` or the hostname: this staging site is published as that site’s production deploy, so `CONTEXT` is `production`.

## Copy these from production

Use the same values as `sitesyncllc`, plus the flag above:

- `TITAN_SMTP_USER`
- `TITAN_SMTP_PASS`
- `TITAN_SMTP_HOST` (optional; defaults to `smtp.titan.email`)
- `SITE_NOTIFY_EMAIL`
- `FACTORY_ACCESS_TOKEN` (use a **separate** token from production if you can; required to open `/app`)
- `SITESINC_STORE=blobs`
- `NEXT_PUBLIC_SITE_URL=https://test.sitesinc.co`
- `NEXT_PUBLIC_GA_MEASUREMENT_ID` may be copied; staging **ignores** it unless you also set the staging GA var below
- Stripe / Search Console vars only if you need those flows on staging

`netlify.toml` already sets `SITE_NOTIFY_EMAIL` and `SITESINC_STORE` for all contexts. You still need the SMTP secrets and the staging flag in the Netlify UI.

## Optional

| Variable | Value | Effect |
|---|---|---|
| `NEXT_PUBLIC_GA_STAGING_MEASUREMENT_ID` | a GA4 ID such as `G-XXXXXXXXXX` | Load analytics on staging into this property only. If unset, staging loads **no** Google Analytics. |
| `SITE_ENV` | `staging` | Server-only fallback if you cannot set the public flag. Still set `NEXT_PUBLIC_SITE_ENV` so the badge and `X-Robots-Tag` header apply. |

## What the flag changes

1. **Search engines stay out**
   - `noindex, nofollow` robots meta on every page
   - `robots.txt` disallows `/` and omits the production sitemap
   - `/sitemap.xml` is empty (does not list `test.sitesinc.co` URLs)
   - `X-Robots-Tag: noindex, nofollow` on all paths
   - Canonical / Open Graph URLs stay on `https://sitesinc.co` so staging cannot compete as a second indexable origin

2. **Test leads stay obvious and separate**
   - Lead capture is still `/api/subscribe` and `/api/inquiry` → Netlify Blobs + Titan SMTP. Netlify Forms is not used.
   - Operator and customer emails sent through `sendMail` get a `[TEST]` subject prefix and a body line that names the staging site
   - Blobs go to store `sitesinc-crm-staging` instead of `sitesinc-crm`
   - Stored leads, inquiries, orders, and projects include `env: "staging"`

3. **Analytics**
   - Production `NEXT_PUBLIC_GA_MEASUREMENT_ID` is not loaded on staging
   - Staging analytics load only when `NEXT_PUBLIC_GA_STAGING_MEASUREMENT_ID` is set

4. **Operator cue**
   - A small “Test site” badge in the bottom-right corner

## Local check

```bash
NEXT_PUBLIC_SITE_ENV=staging npm run dev
```

Leave the flag unset for a production-identical local run.

## Factory / SEO state on staging

Staging uses the Blobs store `sitesinc-crm-staging` for the factory state as well as leads (see
`docs/FACTORY_STATE.md` for the key layout, behaviour and the migration tool).

**First deploy order: migrate first, then deploy.**

1. Dry run on the PC (no credentials, reads local files only):
   `node scripts/migrate-factory-state.mjs --target staging --source <main checkout>\data --only baselines,checklists`.
   Expect the real Sitesinc baselines and 1 checklist; demo baselines (127.0.0.1 / `/demo/`) are listed as SKIP; the
   workspace is not included.
2. Apply with a short-lived `NETLIFY_AUTH_TOKEN` in the shell only, plus `--site-id <id> --confirm-site <id>
   --expect-host test.sitesinc.co --apply`. The script checks with the Netlify API that the id really is the
   `test.sitesinc.co` site (staging refuses anything that is not a `test.*` host) before writing.
3. Deploy the new code to the staging site.
4. Initialize the workspace once: logged in to `/app`, `POST /api/factory/action` with `{"op":"init-workspace"}`.
   Until then public intake submissions are saved as leads but the workspace mirror is skipped (and logged).
5. Verify, in this order: (a) a **cold-start page load first** (no API call before it) of `/app/qa` and public
   `/case-study` returns 200 - this proves server components get a Blobs context; (b) `GET /api/factory/export`
   is 401 without the session and 200 with it, `warnings` is empty and counts match; (c) tick a QA item, reload,
   it persisted; (d) upload a screenshot, reload, it loads; (e) run one factory action; (f) do two actions in
   two tabs at once; (g) search the function logs for the **"no ETag" warning** (`Netlify Blobs returned no ETag
   on read`) - if it appears, conflict protection is off; (h) submit one test intake: the lead shows in the inbox
   and the workspace gets one intake project; (i) redeploy and confirm state survives; (j) `GET /api/health`
   shows `"ok": true`, `"workspace": "ok"`.
6. Download an export as the first dated backup.

**Rollback:** redeploy the previous deploy; the `factory/*` keys stay and are ignored by the old code. Export
first, because workspace edits made while the new code was live are invisible to the old code.
