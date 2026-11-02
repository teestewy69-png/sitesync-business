# Analytics (GA4)

Property **sitesinc.co**, web stream `https://sitesinc.co`, Measurement ID `G-0XHXXSSB1N`.

## Config

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | `G-0XHXXSSB1N` | Production property. Build-time (`NEXT_PUBLIC_`). |
| `NEXT_PUBLIC_GA_STAGING_MEASUREMENT_ID` | unset | Staging only (`NEXT_PUBLIC_SITE_ENV=staging`). Unset = no GA on staging. |

Code: `lib/site-env.ts` (ID + allowed hosts), `components/Analytics.tsx` (loader + page views),
`lib/analytics.ts` (event helper, the only place that calls `gtag`).

## Where it does NOT fire

GA loads only when **all** of these hold:

1. The hostname is `sitesinc.co` or `www.sitesinc.co` (staging build: `test.sitesinc.co`, and only with the staging ID set).
   So localhost, `*.netlify.app` deploy previews / branch deploys, and any other host load nothing.
2. `NEXT_PUBLIC_SITE_ENV=staging` (or `SITE_ENV=staging`) is **not** set. On staging the production ID is never used.
3. The route is not `/demo/*` (all demo sites, including `/demo/client/*` client previews), `/app/*` (factory admin) or `/api/*`.
   Page views and events are dropped on those paths even after gtag has loaded.

Every helper in `lib/analytics.ts` is a no-op when `window.gtag` is missing (blocked, not loaded, excluded host)
and is wrapped in `try/catch`, so forms and checkout behave the same with or without GA.

## What fires

| Event | Where | Params |
|---|---|---|
| `page_view` | Every App Router pathname change (`components/Analytics.tsx`, `send_page_view: false` on config so there is no double count) | `page_path`, `page_location` |
| `generate_lead` | `components/EmailCapture.tsx`: after `/api/subscribe` returns OK (website build request, homepage `#checklist`) | `form_name=website_build_request`, `monitoring_opt_in`, `page_path` |
| `select_content` | Design style picker on the homepage (`components/PickYourDesign.tsx`) | `content_type=design_style`, `content_id`, `page_path` |
| `click` | Elements with `data-analytics-cta` (delegated listener in `Analytics.tsx`) | `cta_name`, `cta_location`, `link_url`, `page_path` |

`click` CTAs: `see_pricing` (hero nav), `start_build` (hero + pricing), `see_designs` (hero),
`monitoring` (pricing), `proof_<target>` (proof section).
To track another CTA add `data-analytics-cta="name"` (and optionally `data-analytics-location`).

No PII is ever sent: no email, phone, name or message text.

## Going live

1. Nothing is live until a **production deploy** of this code to sitesinc.co. Previews and staging send nothing by design.
2. After the deploy, check GA4 Realtime / DebugView on https://sitesinc.co.
3. In GA4 Admin, **Events** (or **Key events**), mark `generate_lead` as a **key event**
   (it appears in the list after it has fired at least once).

There is no shop (removed 2026-10-05): no `select_item`, `add_to_cart`, `begin_checkout` or `product_inquiry` events.
Sitesinc sells website builds and optional monitoring only.

## Website data dashboard (`/app/website-data`)

Operator page (factory auth) that reads **real** GA4 + Search Console numbers for a picked period
(Today / 7d / 30d / 90d or custom dates).

| Metric | Source |
|---|---|
| Visitors | GA4 `totalUsers` |
| Page views | GA4 `screenPageViews` |
| Impressions / Clicks | Search Console searchAnalytics |
| Revenue | GA4 `purchaseRevenue` (or a "not tracked" state if the metric is unavailable) |
| Daily visitors sparkline | GA4 `totalUsers` by date |
| Top pages | GA4 `pagePath` |
| Top search queries | Search Console `query` |

Needs the same service account as SEO (`GOOGLE_SERVICE_ACCOUNT_KEY_FILE`) plus
`GA4_PROPERTY_ID` and `GOOGLE_SEARCH_CONSOLE_SITE_URL` (e.g. `sc-domain:sitesinc.co`).
Missing credentials, API errors, and empty periods render a clean state — numbers are never invented.

Default property is sitesinc.co. A client project is used only when it has its own
`ga4PropertyId` / `gscSiteUrl` on the CRM record. Sitesinc's property is never borrowed.

**Estimated value** is labeled as an estimate. Formula: last 12 months of GA4 `purchaseRevenue` × 2.
If that revenue is missing or $0, the card stays a placeholder (this factory has no comparable-sale feed).
