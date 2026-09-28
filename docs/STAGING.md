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
