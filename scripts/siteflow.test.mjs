// SiteFlow: Stripe signature checks, webhook idempotency (local JSON store in a temp dir), signed download
// tokens, referral helpers, commission math + payout CSV, Checkout params, SSRF guard.
// No network, no keys, no real Stripe.
//   node --test scripts/siteflow.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { mkdtempSync, rmSync } = await import("node:fs");
const { tmpdir } = await import("node:os");
const path = (await import("node:path")).default;

// Isolate every store write (lib/persistence.ts resolves data/ from cwd at import time).
const REPO_CWD = process.cwd();
const TMP = mkdtempSync(path.join(tmpdir(), "siteflow-test-"));
delete process.env.NETLIFY;
delete process.env.NETLIFY_BLOBS_CONTEXT;
process.env.SITESINC_STORE = "local";
process.env.SITEFLOW_REFUND_WINDOW_DAYS = "30";
process.chdir(TMP);

const sig = await import("../lib/siteflow/stripe-signature.ts");
const tokens = await import("../lib/siteflow/tokens.ts");
const ref = await import("../lib/siteflow/ref.ts");
const cm = await import("../lib/siteflow/commission-math.ts");
const { buildCheckoutParams, SESSION_ID_PLACEHOLDER, matchingPriceId } = await import("../lib/stripe-checkout.ts");
const { isBlockedAddress, assertSafeUrl } = await import("../lib/siteflow/safe-fetch.ts");
const { redactSecrets } = await import("../lib/siteflow/sanitize.ts");
const store = await import("../lib/store.ts");
const state = await import("../lib/siteflow/state.ts");
const { processStripeEvent } = await import("../lib/siteflow/webhook.ts");
const catalog = await import("../data/products.ts");
const { destinationUrl, getProgram, outboundHref } = await import("../lib/affiliates.ts");

test.after(() => {
  process.chdir(REPO_CWD);
  rmSync(TMP, { recursive: true, force: true });
});

/* ------------------------------- signatures ------------------------------- */

test("stripe signature: valid, tampered, wrong secret, expired, multiple v1, rotation", () => {
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });
  const secret = "whsec_test_secret";
  const now = 1_800_000_000;
  const header = sig.signStripePayload(body, secret, now);
  assert.deepEqual(sig.verifyStripeSignature(body, header, [secret], { nowSec: now }), { ok: true, timestamp: now });
  assert.equal(sig.verifyStripeSignature(body + " ", header, [secret], { nowSec: now }).reason, "signature_mismatch");
  assert.equal(sig.verifyStripeSignature(body, header, ["whsec_other"], { nowSec: now }).reason, "signature_mismatch");
  assert.equal(sig.verifyStripeSignature(body, header, [secret], { nowSec: now + 301 }).reason, "timestamp_out_of_tolerance");
  assert.equal(sig.verifyStripeSignature(body, header, [], { nowSec: now }).reason, "no_secret");
  assert.equal(sig.verifyStripeSignature(body, null, [secret], { nowSec: now }).reason, "missing_header");
  assert.equal(sig.verifyStripeSignature(body, "garbage", [secret], { nowSec: now }).reason, "malformed_header");
  const multi = `t=${now},v1=${"0".repeat(64)},v1=${sig.computeSignature(body, secret, now)}`;
  assert.equal(sig.verifyStripeSignature(body, multi, [secret], { nowSec: now }).ok, true);
  assert.equal(sig.verifyStripeSignature(body, header, ["whsec_old", secret], { nowSec: now }).ok, true);
  assert.deepEqual(sig.webhookSecrets({ STRIPE_WEBHOOK_SECRET: " a , b ," }), ["a", "b"]);
});

/* --------------------------------- tokens --------------------------------- */

test("download tokens: valid, tampered, wrong secret, expired, malformed", () => {
  const secret = "x".repeat(40);
  const now = 1_800_000_000;
  const token = tokens.signDownloadToken({ o: "ord_1", k: "kits/a.zip", f: "a.zip", exp: now + 60 }, secret);
  const ok = tokens.verifyDownloadToken(token, secret, now);
  assert.equal(ok.ok, true);
  assert.equal(ok.payload.k, "kits/a.zip");
  const [part, s] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ o: "ord_1", k: "kits/b.zip", f: "b.zip", exp: now + 60 })).toString("base64url");
  assert.equal(tokens.verifyDownloadToken(`${forged}.${s}`, secret, now).reason, "bad_signature");
  assert.equal(tokens.verifyDownloadToken(token, "y".repeat(40), now).reason, "bad_signature");
  assert.equal(tokens.verifyDownloadToken(token, secret, now + 61).reason, "expired");
  assert.equal(tokens.verifyDownloadToken(`${part}`, secret, now).reason, "malformed");
  assert.equal(tokens.verifyDownloadToken(token, "", now).reason, "no_secret");
  assert.equal(tokens.downloadTtlHours({}), 72);
  assert.equal(tokens.downloadTtlHours({ DOWNLOAD_LINK_TTL_HOURS: "24" }), 24);
});

/* ---------------------------------- refs ---------------------------------- */

test("ref helpers: codes, capture rules, clean redirects, self-referral", () => {
  assert.equal(ref.normalizeRefCode(" Jane-Doe "), "jane-doe");
  assert.equal(ref.normalizeRefCode("<script>"), "");
  assert.equal(ref.normalizeRefCode("a"), "");
  assert.equal(ref.shouldCaptureRef("GET", "/shop", "?ref=jane"), "jane");
  assert.equal(ref.shouldCaptureRef("GET", "/shop", "?ref=%3Cx%3E"), "invalid");
  assert.equal(ref.shouldCaptureRef("POST", "/shop", "?ref=jane"), "");
  assert.equal(ref.shouldCaptureRef("GET", "/api/checkout", "?ref=jane"), "");
  assert.equal(ref.shouldCaptureRef("GET", "/app", "?ref=jane"), "");
  assert.equal(ref.shouldCaptureRef("GET", "/logo.png", "?ref=jane"), "");
  assert.equal(ref.shouldCaptureRef("GET", "/shop", "?q=1"), "");
  assert.equal(ref.stripRefParam("/shop", "?ref=jane&q=1"), "/shop?q=1");
  assert.equal(ref.stripRefParam("/", "?ref=jane"), "/");
  assert.equal(ref.safeNextPath("//evil.com"), "/");
  assert.equal(ref.safeNextPath("https://evil.com"), "/");
  assert.equal(ref.safeNextPath("/\\evil.com"), "/");
  assert.equal(ref.safeNextPath("/shop?q=1"), "/shop?q=1");
  assert.equal(ref.refWindowDays({}), 30);
  assert.equal(ref.refWindowDays({ SITEFLOW_REF_WINDOW_DAYS: "60" }), 60);
  assert.equal(ref.isSelfReferral("Jane.Doe@gmail.com", ["janedoe+shop@googlemail.com"]), true);
  assert.equal(ref.isSelfReferral("jane@acme.com", ["jane+x@acme.com"]), true);
  assert.equal(ref.isSelfReferral("jane@acme.com", ["j.ane@acme.com"]), false);
  assert.equal(ref.isSelfReferral("jane@acme.com", [null, undefined]), false);
});

/* ------------------------------- commissions ------------------------------- */

test("commission math: rate, refunds, approval window, recurring terms, payout CSV", () => {
  assert.equal(cm.commissionCents(10000, 20), 2000);
  assert.equal(cm.commissionCents(10000, 20, 2500), 1500);
  assert.equal(cm.commissionCents(10000, 0), 0);
  assert.equal(cm.isValidRate(150), false);
  assert.equal(cm.commissionBase({ total: 11000, tax: 800, shipping: 200 }), 10000);
  assert.equal(cm.earnsOnPayment({ recurringPayments: 0 }, 1), true);
  assert.equal(cm.earnsOnPayment({ recurringPayments: 0 }, 2), false);
  assert.equal(cm.earnsOnPayment({ recurringPayments: 3 }, 3), true);
  assert.equal(cm.earnsOnPayment({ recurringPayments: 3 }, 4), false);

  const partner = { code: "jane", name: "Jane", email: "jane@acme.com", ratePct: 20, recurringPayments: 0 };
  const c = cm.newCommission({ id: "c-1", partner, orderId: "o1", sourceId: "cs_1", baseCents: 10000, currency: "usd", paidAt: "2026-09-01T00:00:00.000Z", refundWindowDays: 30 });
  assert.equal(c.commissionCents, 2000);
  assert.equal(c.approvableAt, "2026-10-01T00:00:00.000Z");
  assert.equal(cm.effectiveStatus(c, Date.parse("2026-09-15T00:00:00Z")), "pending");
  assert.equal(cm.effectiveStatus(c, Date.parse("2026-10-02T00:00:00Z")), "approved");
  const partial = cm.applyRefundToCommission(c, 5000);
  assert.equal(partial.commissionCents, 1000);
  assert.equal(partial.status, "pending");
  const full = cm.applyRefundToCommission(partial, 10000);
  assert.equal(full.status, "void");
  assert.equal(cm.applyRefundToCommission({ ...c, status: "paid" }, 10000).status, "paid");

  assert.deepEqual(cm.payoutRows([c], [partner], "2026-09"), []);
  const rows = cm.payoutRows([c, full], [{ ...partner, name: "=HYPERLINK(1)" }], "2026-10");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].commissionCents, 2000);
  const csv = cm.payoutCsv(rows, "2026-10");
  assert.match(csv, /"'=HYPERLINK\(1\)"/);
  assert.match(csv, /"20\.00"/);
  assert.throws(() => cm.payoutRows([], [], "Oct"));
});

/* ------------------------------ checkout params ----------------------------- */

function order(overrides = {}) {
  return {
    id: "ord_test1",
    status: "awaiting_stripe",
    email: "buyer@example.com",
    name: "Buyer",
    address: "",
    city: "",
    zip: "",
    items: [{ slug: "website-monitoring", name: "Website Monitoring", quantity: 1, unitAmount: 129, lineTotal: 129, unitAmountCents: 12900, kind: "subscription", interval: "month", stripeLookupKey: "sitesinc_monitoring_monthly" }],
    subtotal: 129,
    createdAt: new Date().toISOString(),
    mode: "subscription",
    requiresShipping: false,
    ...overrides,
  };
}

test("checkout params: session placeholder, no address for digital, subscription metadata, price matching", () => {
  const p = buildCheckoutParams({ order: order({ ref: "jane" }), origin: "https://test.sitesinc.co" });
  assert.ok(String(p.success_url).endsWith(`session_id=${SESSION_ID_PLACEHOLDER}`));
  assert.equal(p.mode, "subscription");
  assert.equal(p.shipping_address_collection, undefined);
  assert.deepEqual(p.subscription_data, { metadata: { orderId: "ord_test1", siteflow: "1", ref: "jane" } });
  assert.equal(p.payment_intent_data, undefined);
  assert.equal(p.client_reference_id, "ord_test1");
  assert.equal(p.line_items[0].price_data.unit_amount, 12900);
  assert.deepEqual(p.line_items[0].price_data.recurring, { interval: "month" });

  const shipped = buildCheckoutParams({
    order: order({ mode: "payment", requiresShipping: true, items: [{ slug: "x", name: "X", quantity: 2, unitAmount: 10, lineTotal: 20, unitAmountCents: 1000, kind: "digital" }] }),
    origin: "http://localhost:3000",
  });
  assert.deepEqual(shipped.shipping_address_collection, { allowed_countries: ["US"] });
  assert.equal(shipped.customer_creation, "always");
  assert.equal(shipped.payment_intent_data.metadata.orderId, "ord_test1");

  const item = order().items[0];
  const good = { id: "price_ok", active: true, currency: "usd", unit_amount: 12900, recurring: { interval: "month" } };
  assert.equal(matchingPriceId(item, good), "price_ok");
  assert.equal(matchingPriceId(item, { ...good, unit_amount: 9900 }), null);
  assert.equal(matchingPriceId(item, { ...good, recurring: null }), null);
  const prices = new Map([["sitesinc_monitoring_monthly", good]]);
  assert.deepEqual(buildCheckoutParams({ order: order(), origin: "http://x", prices }).line_items[0], { price: "price_ok", quantity: 1 });
});

/* ---------------------------------- catalog --------------------------------- */

test("catalog: no fake bundles, retired bundle hidden, drafts unlisted, contact-only kept", () => {
  const slugs = catalog.getPublicProducts().map((p) => p.slug);
  for (const gone of ["mack-makeup-bundle", "home-gym-bundle", "home-pet-grooming-kit", "longevity-life-bundle"]) {
    assert.equal(catalog.getCatalogEntry(gone), undefined);
  }
  assert.ok(!slugs.includes("website-design-digital-bundle"));
  assert.equal(catalog.getProduct("website-design-digital-bundle"), undefined);
  assert.ok(slugs.includes("financial-consulting"));
  assert.ok(slugs.includes("gold-filled-jewelry"));
  for (const p of catalog.getPublicProducts()) assert.ok(p.contactOnly || p.price, `${p.slug} listed without a price`);
});

/* ------------------------------------ SSRF ---------------------------------- */

test("SSRF guard: private/reserved addresses and hosts are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "64:ff9b::7f00:1"]) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700:4700::1111"]) assert.equal(isBlockedAddress(ip), false, ip);
  for (const url of ["http://localhost/", "http://127.0.0.1/", "http://[::1]/", "file:///etc/passwd", "http://user:pw@example.com/", "http://example.com:8080/", "http://intranet/", "http://printer.local/"]) {
    assert.throws(() => assertSafeUrl(url), url);
  }
  assert.equal(assertSafeUrl("https://example.com/page").hostname, "example.com");
});

test("sanitize + affiliates: secrets redacted, plain links without templates, templates must be https", () => {
  assert.doesNotMatch(redactSecrets("bad key sk_test_abcdefghijklmnop123 and whsec_abcdefghijk123"), /sk_test_abc|whsec_abc/);
  const nc = getProgram("namecheap");
  assert.equal(destinationUrl(nc, { domain: "acme.com" }, {}).tracked, false);
  assert.equal(destinationUrl(nc, {}, { AFFILIATE_NAMECHEAP_URL_TEMPLATE: "http://x/{url}" }).tracked, false);
  const t = destinationUrl(nc, { domain: "acme.com" }, { AFFILIATE_NAMECHEAP_URL_TEMPLATE: "https://aff.example/c?u={url}" });
  assert.equal(t.tracked, true);
  assert.ok(t.url.startsWith("https://aff.example/c?u=https%3A%2F%2F"));
  assert.equal(outboundHref("", "namecheap", { domain: "Acme.com", src: "domainiq-bay" }), "/go/namecheap?d=acme.com&src=domainiq-bay");
});

/* --------------------------- webhook idempotency ---------------------------- */

test("webhook: same event twice = one payment, one commission; refund voids it; self-referral earns nothing", async () => {
  const at = new Date().toISOString();
  await state.createPartner({ code: "jane", name: "Jane", email: "jane@acme.com", ratePct: 25, recurringPayments: 0, status: "active", createdAt: at, updatedAt: at });
  await store.appendOrder(order({
    id: "ord_pay1",
    mode: "payment",
    ref: "jane",
    items: [{ slug: "keep-it-earning-kit", name: "Kit", quantity: 1, unitAmount: 100, lineTotal: 100, unitAmountCents: 10000, kind: "digital" }],
    subtotal: 100,
  }));
  const paid = [];
  const deps = { onPaid: (id) => paid.push(id) };
  const event = {
    id: "evt_paid_1",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_test_1", object: "checkout.session", mode: "payment", payment_status: "paid", status: "complete", amount_total: 10000, currency: "usd", payment_intent: "pi_test_1", customer: "cus_test_1", client_reference_id: "ord_pay1", metadata: { orderId: "ord_pay1", siteflow: "1", ref: "jane" }, customer_details: { email: "buyer@example.com" }, total_details: { amount_tax: 0, amount_shipping: 0 }, livemode: false } },
  };
  const first = await processStripeEvent(event, deps);
  assert.equal(first.status, "processed");
  const second = await processStripeEvent(event, deps);
  assert.equal(second.status, "duplicate");
  // A different event for the same session (e.g. async_payment_succeeded) must not double-count either.
  const third = await processStripeEvent({ ...event, id: "evt_paid_2", type: "checkout.session.async_payment_succeeded" }, deps);
  assert.equal(third.status, "processed");
  assert.deepEqual(paid, ["ord_pay1"]);

  const o = await store.findOrderById("ord_pay1");
  assert.equal(o.status, "paid");
  assert.equal(o.amountPaidCents, 10000);
  const revenue = (await state.listRevenue()).filter((r) => r.orderId === "ord_pay1");
  assert.equal(revenue.length, 1);
  let commissions = (await state.listCommissions()).filter((c) => c.orderId === "ord_pay1");
  assert.equal(commissions.length, 1);
  assert.equal(commissions[0].commissionCents, 2500);
  assert.equal(commissions[0].status, "pending");

  const refund = {
    id: "evt_refund_1",
    type: "charge.refunded",
    livemode: false,
    data: { object: { id: "ch_test_1", object: "charge", amount_refunded: 10000, currency: "usd", payment_intent: "pi_test_1", customer: "cus_test_1", metadata: {} } },
  };
  assert.equal((await processStripeEvent(refund, deps)).status, "processed");
  assert.equal((await processStripeEvent(refund, deps)).status, "duplicate");
  const refunded = await store.findOrderById("ord_pay1");
  assert.equal(refunded.status, "refunded");
  commissions = (await state.listCommissions()).filter((c) => c.orderId === "ord_pay1");
  assert.equal(commissions[0].status, "void");
  assert.equal((await state.listRevenue()).filter((r) => r.orderId === "ord_pay1").length, 2);

  // Self-referral: partner buys through their own link.
  await store.appendOrder(order({ id: "ord_self", mode: "payment", ref: "jane", email: "jane+shop@acme.com", items: [{ slug: "keep-it-earning-kit", name: "Kit", quantity: 1, unitAmount: 100, lineTotal: 100, unitAmountCents: 10000, kind: "digital" }], subtotal: 100 }));
  await processStripeEvent({ ...event, id: "evt_self", data: { object: { ...event.data.object, id: "cs_self", payment_intent: "pi_self", client_reference_id: "ord_self", metadata: { orderId: "ord_self" }, customer_details: { email: "jane@acme.com" } } } }, deps);
  assert.equal((await state.listCommissions()).filter((c) => c.orderId === "ord_self").length, 0);
  assert.equal((await store.findOrderById("ord_self")).refRejected, "self_referral");

  // Unknown session (another site on the same Stripe account) is ignored, not an error.
  const other = await processStripeEvent({ ...event, id: "evt_other", data: { object: { ...event.data.object, id: "cs_other", client_reference_id: null, metadata: {} } } }, deps);
  assert.equal(other.status, "ignored");
});

test("webhook: failed processing is retryable (event not marked done)", async () => {
  await store.appendOrder(order({ id: "ord_retry", mode: "payment", items: [{ slug: "keep-it-earning-kit", name: "Kit", quantity: 1, unitAmount: 100, lineTotal: 100, unitAmountCents: 10000, kind: "digital" }], subtotal: 100 }));
  const event = {
    id: "evt_retry",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: { id: "cs_retry", mode: "payment", payment_status: "paid", amount_total: 10000, currency: "usd", payment_intent: "pi_retry", client_reference_id: "ord_retry", metadata: { orderId: "ord_retry" }, livemode: false } },
  };
  await assert.rejects(processStripeEvent(event, { onPaid: () => { throw new Error("boom"); } }));
  const again = await processStripeEvent(event, { onPaid: () => {} });
  assert.equal(again.status, "processed");
});
