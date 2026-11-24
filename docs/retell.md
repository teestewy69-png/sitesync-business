# Retell AI voice agents

Three Retell agents serve SitesInc:

| Agent | Env var | Job |
|---|---|---|
| Inbound answering agent | `RETELL_AGENT_INBOUND_ID` | Answers calls to the Retell number; the webhook below turns each finished call into a factory lead + an email to Tony. |
| Outbound agent 1 | `RETELL_AGENT_OUTBOUND_1_ID` | Appointment-setting: calls a lead, offers an appointment for Tony to call back and close. |
| Outbound agent 2 | `RETELL_AGENT_OUTBOUND_2_ID` | Same job as agent 1 (second voice/script for the test batch). |

**Live account mapping (verified 2026-11-24):** the Retell number +1 (909) 323-1575
is wired inbound AND outbound to the "Sitesinc Sales Agent"
(`agent_780d2cbbf2a50870f17fc56674`), so it fills both the inbound slot and
outbound 1. Outbound 2 is the "Conversation Flow Agent"
(`agent_9ab20e7f5695ac6053fab54636`). A third agent, "Sitesinc Receptionist"
(`agent_7c35ed3dccd56202ee8a4ea4d0`), is not assigned to the number.

The agents, their prompts, and their voices live in the Retell dashboard — this
repo only places outbound calls, receives call webhooks, and guards both with
TCPA checks. Nothing here works until a real API key is configured (below).

## Config

Set in **Netlify: Site settings → Environment variables** (never in code, never
in git). See `.env.local.example` for the commented list.

| Variable | Required | Notes |
|---|---|---|
| `RETELL_API_KEY` | Yes | Bearer key for the Retell API and the default webhook signing key. Unset = integration disabled: webhook answers 503, factory call route answers 503. |
| `RETELL_AGENT_INBOUND_ID` | Dashboard only | Recorded for reference; the webhook accepts any of Tony's agents. |
| `RETELL_AGENT_OUTBOUND_1_ID` | For agent 1 calls | |
| `RETELL_AGENT_OUTBOUND_2_ID` | For agent 2 calls | |
| `RETELL_FROM_NUMBER` | For outbound | Retell number calls are placed from, E.164 (e.g. `+19095550134`). |
| `RETELL_WEBHOOK_SECRET` | No | Separate webhook signing key. Unset = signatures are verified against `RETELL_API_KEY`. |

Code: `lib/retell.ts` (config, `createOutboundCall`, `verifyRetellSignature`),
`lib/retell-guards.ts` (TCPA guards), `lib/retell-batch.ts` (batch loader/filter).

## Webhook (inbound + call results)

In the Retell dashboard, set the webhook URL on each agent (or the account
webhook) to:

```
https://sitesinc.co/api/retell/webhook
```

Route: `app/api/retell/webhook/route.ts`. Behavior:

- Verifies `x-retell-signature` (HMAC-SHA256 of `rawBody + timestamp`, format
  `v={timestamp},d={hmac}`). Bad signature → 401. No key configured → 503.
- `call_started` and other events are acknowledged with 200 and ignored.
- On `call_ended` / `call_analyzed`, the call is saved as a lead with
  `source: "retell"` in the same store as the public subscribe form (caller
  number, direction, agent id, summary, transcript excerpt), and a
  notification email goes to the notify address (`SITE_NOTIFY_EMAIL`,
  default `save@sitesinc.co`). Lead ids derive from the Retell call id, so
  webhook retries do not duplicate leads.

## Placing an outbound call (factory)

Route: `app/api/factory/retell/call/route.ts` — factory-session gated by
middleware and re-checked in the route, exactly like every `/api/factory/*`
route.

```
POST /api/factory/retell/call
{ "phone": "(909) 555-0134", "business": "Walnut Barbers", "city": "Walnut", "state": "CA", "agent": 1 }
```

- Runs the TCPA guards first (below) and refuses with a 4xx + reason when
  blocked: 403 suppressed number, 422 outside calling hours, 400 bad
  phone/state.
- On success it calls Retell `POST /v2/create-phone-call` with dynamic
  variables `{ business_name, city, callback_offer: "appointment" }` and
  returns `{ ok: true, callId }`.

## The 55-lead test batch

Tony supplies the test leads in `data/retell-test-batch.csv`
(header: `business,phone,city,state`). The file ships header-only.
`loadBatchRows()` parses it; `filterCallable(rows, now)` splits it into
callable rows and skipped rows with a reason per row (invalid phone,
suppressed, or outside calling hours). The batch is a test set: it exists to
see what needs tweaking before any larger calling.

## TCPA guards and their limits

Guards live in `lib/retell-guards.ts` and run before every outbound call:

1. **Calling hours:** 08:00–20:45 in the called party's local time — inside
   the TCPA's 8:00 AM–9:00 PM band at both ends.
2. **Suppression list:** `data/retell-suppression.json` is a manual JSON
   array of do-not-call numbers (any format; matching ignores punctuation
   and the leading 1). **It is manual:** when someone says "don't call me,"
   a human must add the number to that file (or to Retell's own controls)
   before the next run. It ships empty.
3. **Phone validity:** only clean 10-digit US numbers are called.

Known limits, stated plainly:

- Timezones are inferred from the lead's **state**, using the state's most
  populous zone. Multi-zone states (FL, TX, TN, IN, MI, …) can be off by an
  hour for minority-zone leads; the 20:45 cutoff absorbs a one-hour error
  without leaving the legal band.
- These guards are engineering guardrails, not legal advice, and they do
  not check any external DNC registry.

## Not yet verified (needs the real key)

Until Tony's real `RETELL_API_KEY` and agent ids are in Netlify, the
following are **untested against the live Retell API**:

- Placing a real outbound call end to end (request accepted, agent speaks,
  dynamic variables land).
- Live webhook delivery from Retell to `/api/retell/webhook` (signature
  verification is unit-tested with a dummy key; Retell's production
  signing has not been observed yet).
- The exact shape of Retell's `call_ended` / `call_analyzed` payloads in
  Tony's account — the webhook reads defensively, so missing fields degrade
  to a lead with phone + direction only.

Tests: `scripts/retell.test.mjs` (config, hours window, suppression
normalization, batch filter, signature valid/tampered) — run directly with
`node scripts/retell.test.mjs` (kept out of the `npm test` list, like the
free-audit guard tests).
