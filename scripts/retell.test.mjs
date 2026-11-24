// Retell AI integration: config, TCPA guards, 55-lead batch filter, webhook signature.
// No network and no real keys — signature tests build HMACs with a dummy key.
//   node --test scripts/retell.test.mjs     (Node >= 22.18 for TypeScript type stripping)
import { register } from "node:module";
register("./fixtures/ts-resolver.mjs", import.meta.url);

const assert = (await import("node:assert/strict")).default;
const { default: test } = await import("node:test");
const { createHmac } = await import("node:crypto");
const { getRetellConfig, verifyRetellSignature } = await import("../lib/retell.ts");
const {
  isSuppressed,
  isWithinCallingHours,
  loadSuppressionList,
  normalizePhoneDigits,
  STATE_TIMEZONES,
} = await import("../lib/retell-guards.ts");
const { filterCallable, loadBatchRows, parseBatchCsv } = await import("../lib/retell-batch.ts");

const RETELL_ENV_KEYS = [
  "RETELL_API_KEY",
  "RETELL_AGENT_INBOUND_ID",
  "RETELL_AGENT_OUTBOUND_1_ID",
  "RETELL_AGENT_OUTBOUND_2_ID",
  "RETELL_FROM_NUMBER",
  "RETELL_WEBHOOK_SECRET",
];
function clearRetellEnv() {
  for (const key of RETELL_ENV_KEYS) delete process.env[key];
}

test("retell config is null when RETELL_API_KEY is unset, and reads ids when set", () => {
  clearRetellEnv();
  assert.equal(getRetellConfig(), null);

  process.env.RETELL_API_KEY = "dummy-key";
  process.env.RETELL_AGENT_INBOUND_ID = "agent_in";
  process.env.RETELL_AGENT_OUTBOUND_1_ID = "agent_out1";
  process.env.RETELL_AGENT_OUTBOUND_2_ID = "agent_out2";
  process.env.RETELL_FROM_NUMBER = "+19095550134";
  const config = getRetellConfig();
  assert.equal(config.apiKey, "dummy-key");
  assert.equal(config.agentInboundId, "agent_in");
  assert.equal(config.agentOutbound1Id, "agent_out1");
  assert.equal(config.agentOutbound2Id, "agent_out2");
  assert.equal(config.fromNumber, "+19095550134");
  assert.equal(config.webhookSecret, undefined);
  clearRetellEnv();
});

test("calling hours window is 08:00-20:45 in the called party's timezone", () => {
  const la = STATE_TIMEZONES.CA;
  // 2026-01-15 is PST (UTC-8) in Los Angeles.
  assert.equal(isWithinCallingHours(new Date("2026-01-15T16:00:00Z"), la), true, "08:00 exactly opens");
  assert.equal(isWithinCallingHours(new Date("2026-01-15T15:59:00Z"), la), false, "07:59 is too early");
  assert.equal(isWithinCallingHours(new Date("2026-01-16T04:45:00Z"), la), true, "20:45 exactly still allowed");
  assert.equal(isWithinCallingHours(new Date("2026-01-16T04:46:00Z"), la), false, "20:46 is too late");
  assert.equal(isWithinCallingHours(new Date("2026-01-15T21:00:00Z"), la), true, "midday is fine");
});

test("calling hours are timezone-aware, including no-DST Arizona", () => {
  const instant = new Date("2026-01-15T13:00:00Z");
  assert.equal(isWithinCallingHours(instant, STATE_TIMEZONES.NY), true, "08:00 in New York");
  assert.equal(isWithinCallingHours(instant, STATE_TIMEZONES.CA), false, "05:00 in Los Angeles");
  const winterMorning = new Date("2026-01-15T15:00:00Z");
  assert.equal(isWithinCallingHours(winterMorning, STATE_TIMEZONES.AZ), true, "08:00 in Phoenix (no DST)");
  assert.equal(isWithinCallingHours(winterMorning, STATE_TIMEZONES.CA), false, "07:00 in Los Angeles");
});

test("suppression matching ignores formatting and the leading country code", () => {
  assert.equal(normalizePhoneDigits("+1 (909) 555-0134"), "9095550134");
  assert.equal(normalizePhoneDigits("909.555.0134"), "9095550134");
  assert.equal(isSuppressed("+1 (909) 555-0134", ["9095550134"]), true);
  assert.equal(isSuppressed("9095550134", ["+1 909-555-0134"]), true);
  assert.equal(isSuppressed("(909) 555-9999", ["9095550134"]), false);
  assert.equal(isSuppressed("", ["9095550134"]), false);
});

test("batch filter keeps good rows and skips bad phone, suppressed, and after-hours rows", () => {
  // 08:30 in New York (inside), 05:30 in Los Angeles (outside).
  const now = new Date("2026-01-15T13:30:00Z");
  const rows = [
    { business: "Good NY Barbers", phone: "(212) 555-0147", city: "New York", state: "NY" },
    { business: "Bad Phone", phone: "123", city: "New York", state: "NY" },
    { business: "Suppressed Salon", phone: "2125550199", city: "New York", state: "NY" },
    { business: "Too Early LA", phone: "(310) 555-0111", city: "Los Angeles", state: "CA" },
  ];
  const { callable, skipped } = filterCallable(rows, now, ["+1 (212) 555-0199"]);
  assert.deepEqual(
    callable.map((r) => r.business),
    ["Good NY Barbers"]
  );
  assert.equal(skipped.length, 3);
  const reasonFor = (name) => skipped.find((s) => s.row.business === name)?.reason ?? "";
  assert.match(reasonFor("Bad Phone"), /invalid US phone/);
  assert.match(reasonFor("Suppressed Salon"), /suppression list/);
  assert.match(reasonFor("Too Early LA"), /outside calling hours/);
});

test("batch CSV parser handles quotes and the shipped file is header-only", () => {
  const parsed = parseBatchCsv(
    'business,phone,city,state\n"Barber, The",+1 909-555-0134,Walnut,ca\n'
  );
  assert.deepEqual(parsed, [
    { business: "Barber, The", phone: "+1 909-555-0134", city: "Walnut", state: "CA" },
  ]);
  // data/retell-test-batch.csv ships with only a header until Tony adds the 55 rows.
  assert.deepEqual(loadBatchRows(), []);
  assert.deepEqual(loadSuppressionList(), []);
});

test("webhook signature verifies a genuine signature and rejects tampering", () => {
  clearRetellEnv();
  const key = "dummy-retell-test-key";
  process.env.RETELL_API_KEY = key;
  const body = JSON.stringify({ event: "call_ended", call: { call_id: "call_123" } });
  const timestamp = "1768478400000";
  const digest = createHmac("sha256", key).update(`${body}${timestamp}`).digest("hex");
  const header = `v=${timestamp},d=${digest}`;

  assert.equal(verifyRetellSignature(body, header), true);
  assert.equal(verifyRetellSignature(`${body} `, header), false, "tampered body must fail");
  assert.equal(verifyRetellSignature(body, "v=1,d=deadbeef"), false, "wrong digest must fail");
  assert.equal(verifyRetellSignature(body, "not-a-signature"), false, "malformed header must fail");
  assert.equal(verifyRetellSignature(body, null), false, "missing header must fail");
  clearRetellEnv();
  assert.equal(verifyRetellSignature(body, header), false, "no key configured must fail closed");
});
