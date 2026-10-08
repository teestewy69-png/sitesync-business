# SiteFlow (paused phase 2 code)

> **Status: PAUSED (phase 2). Decision: Path A, 2026-10-05.** The public offer is ONLY website builds at
> $1,995 (50% to start, 50% at launch, invoiced by hand) and optional $129/month monitoring. SiteFlow (product
> checkout, Stripe webhook, digital delivery, partner referrals, affiliate links) is switched off by
> `SITEFLOW_ENABLED` (unset = off; only `true`/`1` turns it on). The code from commits adf321d, 135e5d3 and 519831d is
> kept. City Launch and DomainIQ stay internal factory tools and are not offered publicly.
>
> With SiteFlow paused (`lib/siteflow/flag.ts`):
> - Middleware returns 404 for `/cart`, `/checkout`, `/tools`, `/go/*`, `/api/checkout`, `/api/download/*`,
>   `/api/stripe/webhook`, `/api/siteflow/*` and `/api/factory/siteflow*` on every host; each of those routes also
>   checks the flag itself. `?ref=` does nothing (no redirect, no cookie).
> - **The public shop is gone (2026-10-05).** `/shop`, the product pages, the "Other inquiries" page, the inquiry form,
>   `/api/inquiry`, `/api/products` and the shop components were removed. `/shop` and `/shop/*` 301 to `/`
>   (middleware, Sitesinc hosts). The Financial Consulting and Gold-Filled Jewelry entries and their images were
>   removed from the catalog. Nothing in `data/products.ts` is public or purchasable while paused.
> - `/cart` and `/checkout` remain as paused SiteFlow code (`components/siteflow/CheckoutChrome.tsx`,
>   `CartProvider`, `ProductImage`), 404 while paused. A future product launch needs new product pages: nothing
>   adds items to the cart today.
> - `/thank-you` only confirms build/monitoring requests; it ignores `?order=`/`session_id`.
> - The `/app` SiteFlow bay shows "Paused (phase 2)". The DomainIQ bay links to plain registrar search URLs (no `/go`,
>   no affiliate templates, no disclosure) and is internal only.
> - `/api/health` reports `siteflow: { status: "paused" }` and `stripe: false`.
>
> Turning it back on needs Tony's sign-off, `SITEFLOW_ENABLED=true` in Netlify and a redeploy, and a fresh copy
> review: the public copy no longer mentions products, checkout, referrals or affiliate links.
>
> ### Phase 2 roadmap (internal only, not on the public site)
> Moved off the homepage "Beyond the build" teaser on 2026-10-05:
> - Keep-it-earning kit: offer-page templates, update cadence, SEO refresh prompts (in progress, unpriced draft).
> - Niche playbooks: barber, contractor, coach and food-truck packs (idea only).
> - DomainIQ domain report and Local SEO audit report as paid products (drafts, unpriced).
> - Website template pack (draft, unpriced).
> - Monitoring via Stripe subscription (today it is invoiced by hand).
> - Partner referrals and registrar affiliate links.

SiteFlow is the money path for sitesinc.co: catalog, Stripe Checkout, verified webhook, paid order, automatic
fulfillment, partner commissions, and outbound affiliate links. **Nothing here touches live Stripe until
Tony sets live keys.** Everything works locally with a test key, or with no key at all using signed fake events.

## Flow

1. **Catalog**: `data/products.ts` is the single source of truth. Each entry has a `kind` (digital,
   subscription, service, affiliate_out), `priceCents` (undefined until Tony sets it), `stripeLookupKey`,
   `deliverable` (file, generator or manual), and `listed`. A product is public only when it is listed, not
   retired, and either contact-only or priced. Drafts return 404. (The retired Website Design bundle was removed
   from the catalog entirely on 2026-10-05.)
2. **Checkout** (`/checkout` → `POST /api/checkout`): the server re-prices the cart from the catalog
   (`lib/catalog.ts quoteCart`), validates fulfillment inputs, records the order, and creates a Stripe Checkout
   Session (`lib/stripe-checkout.ts`). Line items use the synced Stripe price only when its amount, currency
   and interval match the catalog; otherwise they use inline `price_data` with the catalog amount. A postal
   address is collected only for physical goods. Metadata carries `orderId`, `siteflow=1` and `ref`.
   With no Stripe key, the order is recorded and emailed. The page says so, and no fake payment is claimed.
3. **Webhook** (`POST /api/stripe/webhook`): raw body plus `Stripe-Signature` verification (HMAC-SHA256, 5-minute
   tolerance, several secrets during rotation). Each event id is processed once (`lib/siteflow/state.ts
   claimEvent`), and ledger and commission ids derive from Stripe object ids, so a retry or a second event for the same
   session never double-counts. Handles `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `invoice.paid`, `charge.refunded` and `customer.subscription.deleted`.
   Processing errors return 500 so Stripe retries. Unknown sessions (other sites on the account) are ignored.
4. **Thank-you page**: `/thank-you?order=…&session_id=…` confirms the session with Stripe server-side and
   marks the order paid (idempotent with the webhook). Download links appear only for a verified paid session.
5. **Fulfillment** (`lib/siteflow/fulfillment.ts`) runs after the response:
   - *file*: a private file in the `sitesinc-deliverables` Blobs store (`data/private/deliverables/` locally),
     uploaded in the /app SiteFlow bay.
   - *generator*: the DomainIQ domain report or the Local SEO audit (crawl of up to 15 pages through an SSRF-safe fetcher),
     generated as HTML, stored privately.
   - *manual*: website monitoring setup. It shows in the bay under "Needs manual setup".
   The buyer gets one email with signed, expiring download links (`/api/download/<token>`, default 72 h).
   It retries 3 times with backoff, then marks the order `failed`, records the failure and emails the owner. The bay has Retry/Resend.
6. **Partners** (in-house referrals): `https://sitesinc.co/<any page>?ref=<code>` → middleware → `/api/siteflow/ref`
   validates the code against active partners and sets an HttpOnly `sf_ref` cookie (default 30 days, last valid click
   wins), then redirects to the clean URL. Checkout re-validates it. A commission is created when payment is confirmed
   (rate per partner, base = total − tax − shipping), stays `pending` through the refund window (default 30 days),
   and is reduced or voided by refunds. Self-referrals (same mailbox, ignoring +tags and Gmail dots) earn nothing.
   Subscriptions earn on the first N paid invoices (per partner, default first payment only).
   Payouts are manual: "Approve due" → download the month's payout CSV → pay partners yourself → "Mark payout paid".
7. **Outbound affiliate links**: `/go/<slug>?d=<domain>&src=<where>` logs the click and 302s to the registrar.
   It uses the tracking template from `AFFILIATE_<SLUG>_URL_TEMPLATE` when set, and the plain registrar link otherwise.
   Used by the DomainIQ bay, the DomainIQ report and `/tools` (noindex and unlinked unless `SITEFLOW_TOOLS_PAGE=listed`).
   Links carry `rel="sponsored nofollow noopener"` and a disclosure.

## Automatic vs manual

| Automatic | Manual (Tony / operator) |
| --- | --- |
| Pricing from the catalog, Checkout Session, tax/shipping excluded from commissions | Setting prices, listing products |
| Payment confirmation (webhook + thank-you check), revenue ledger (test/live split) | Uploading the kit and template-pack zips |
| File + generated-report delivery by email with signed links, retries, failure alerts | Website monitoring setup ("Mark done") |
| Commission creation, refund voiding, approval eligibility after the refund window | Approving, paying partners, "Mark payout paid" |
| Click logging for outbound links | Joining affiliate programs and pasting tracking templates |
| Read-only Stripe catalog check in the bay | Running the sync script with `--apply`; refunds in the Stripe dashboard |

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SITEFLOW_ENABLED` | Master switch. Unset (default) = paused; every other SiteFlow variable is ignored. `true` re-enables. |
| `STRIPE_SECRET_KEY` | Test key (`sk_test_`/`rk_test_`) until go-live. The bay and `/api/health` show the mode. |
| `STRIPE_WEBHOOK_SECRET` | Endpoint signing secret (`whsec_…`). Comma-separate two while rotating. Without it the webhook answers 503. |
| `DOWNLOAD_SIGNING_SECRET` | 32+ random chars. Required on Netlify (local dev has a fallback). |
| `DOWNLOAD_LINK_TTL_HOURS` | Default 72. |
| `SITEFLOW_REF_WINDOW_DAYS` | Referral cookie window, default 30. |
| `SITEFLOW_REFUND_WINDOW_DAYS` | Refund window and commission approval delay, default 30. |
| `SITEFLOW_TOOLS_PAGE` | `listed` to make `/tools` indexable. |
| `AFFILIATE_{NAMECHEAP,PORKBUN,DYNADOT,SPACESHIP}_URL_TEMPLATE` | https tracking template with `{url}` and/or `{domain}`. |
| `NEXT_PUBLIC_SITE_URL` | Origin for success/cancel URLs and partner links. |

Stripe webhook endpoint: `https://<site>/api/stripe/webhook` with the six events above.

## Stripe catalog sync

```bash
node scripts/siteflow/stripe-sync.mjs            # dry run (no key = offline plan)
node scripts/siteflow/stripe-sync.mjs --apply    # test key: create/update products + prices
```

It refuses live keys unless `--allow-live` is passed. Products get the id `sitesinc_<slug>`, and prices are found by lookup key. A changed
price creates a new price (`transfer_lookup_key`) and deactivates the old one. Unpriced, retired and contact-only
entries are skipped and listed. Checkout never depends on the sync: a missing or mismatched price falls back to inline pricing.

## Local testing

```bash
node --test scripts/siteflow.test.mjs

# With the Stripe CLI (test mode):
stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints whsec_… → STRIPE_WEBHOOK_SECRET in .env.local
npm run dev  # add an item, check out with card 4242 4242 4242 4242

# Without Stripe at all: place an order (no key = recorded), then post a signed fake event:
STRIPE_WEBHOOK_SECRET=whsec_local_test npm run dev
STRIPE_WEBHOOK_SECRET=whsec_local_test node scripts/siteflow/send-test-event.mjs paid <orderId>
STRIPE_WEBHOOK_SECRET=whsec_local_test node scripts/siteflow/send-test-event.mjs refund <orderId> <cents>
```

Local state lives in `data/siteflow/` and `data/private/` (gitignored). On Netlify it lives in Blobs (separate staging stores).

## Decisions for Tony

- Prices for the Keep-It-Earning kit, DomainIQ domain report, Local SEO audit report and template pack, and whether to list each.
  Website Monitoring is priced at $129/mo but stays unlisted until Tony lists it.
- Upload the kit and template-pack zip files (bay → catalog table). List a file product only after its file is uploaded: an order placed before the upload fails delivery, retries, and alerts the owner (checkout does not check for the file).
- Which affiliate programs to join, their tracking templates, and whether to list `/tools`.
- Per-partner commission rate, how many subscription payments earn, the attribution window (30 days) and last-click attribution.
- Refund policy and window (30 days). This also drives commission approval.
- Already decided: the 4 placeholder affiliate bundles are deleted, the Website Design bundle is removed,
  SiteFlow is paused (Path A), and the public shop with its Financial Consulting and Gold-Filled Jewelry
  entries was removed (2026-10-05).

## Caveats

- `updateOrder` on Blobs is read-modify-write and not atomic. Concurrent webhook and thank-you updates are designed to be
  idempotent (same fields, same values), but simultaneous unrelated edits to one order could race.
- Netlify Functions limit request bodies (about 6 MB), so very large deliverable uploads through the bay may fail. Upload
  big zips with the Blobs CLI to the `sitesinc-deliverables` store under the catalog `fileKey` instead.
- The Dynadot search URL parameter (`?domain=`) is not documented by Dynadot. Plain links fall back to the home page if it changes.
