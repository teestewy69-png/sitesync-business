import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Retell AI voice-agent integration (see docs/retell.md).
 *
 * Server-side only. Every value comes from environment variables
 * (Netlify: Site settings → Environment variables) — never commit a real
 * API key, agent id, or phone number to this repo.
 */

export type RetellConfig = {
  apiKey: string;
  agentInboundId?: string;
  agentOutbound1Id?: string;
  agentOutbound2Id?: string;
  fromNumber?: string;
  webhookSecret?: string;
};

/** Returns null when Retell is not configured at all (no API key). */
export function getRetellConfig(env: NodeJS.ProcessEnv = process.env): RetellConfig | null {
  const apiKey = env.RETELL_API_KEY?.trim();
  if (!apiKey) return null;
  const pick = (value: string | undefined) => value?.trim() || undefined;
  return {
    apiKey,
    agentInboundId: pick(env.RETELL_AGENT_INBOUND_ID),
    agentOutbound1Id: pick(env.RETELL_AGENT_OUTBOUND_1_ID),
    agentOutbound2Id: pick(env.RETELL_AGENT_OUTBOUND_2_ID),
    fromNumber: pick(env.RETELL_FROM_NUMBER),
    webhookSecret: pick(env.RETELL_WEBHOOK_SECRET),
  };
}

export type CreateOutboundCallInput = {
  /** Destination number, E.164 (e.g. +19095550134). */
  toNumber: string;
  agentId: string;
  /** Passed to the agent as Retell LLM dynamic variables. */
  dynamicVariables?: Record<string, string>;
  /** Test seam: defaults to the global fetch. */
  fetchImpl?: typeof fetch;
};

export type RetellCallResponse = {
  call_id?: string;
  [key: string]: unknown;
};

/**
 * Places one outbound call via Retell's create-phone-call endpoint.
 * Throws a descriptive Error on any non-2xx response or missing config.
 */
export async function createOutboundCall(input: CreateOutboundCallInput): Promise<RetellCallResponse> {
  const config = getRetellConfig();
  if (!config) {
    throw new Error("Retell is not configured: RETELL_API_KEY is not set.");
  }
  if (!config.fromNumber) {
    throw new Error("Retell is not configured: RETELL_FROM_NUMBER is not set.");
  }
  if (!input.agentId) {
    throw new Error("Retell outbound call needs an agent id.");
  }
  const doFetch = input.fetchImpl ?? fetch;
  const res = await doFetch("https://api.retellai.com/v2/create-phone-call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from_number: config.fromNumber,
      to_number: input.toNumber,
      agent_id: input.agentId,
      retell_llm_dynamic_variables: input.dynamicVariables ?? {},
    }),
  });
  const data = (await res.json().catch(() => null)) as RetellCallResponse | null;
  if (!res.ok) {
    const detail =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : `HTTP ${res.status}`;
    throw new Error(`Retell create-phone-call failed (${res.status}): ${detail}`);
  }
  return data ?? {};
}

/**
 * Verifies a Retell webhook signature.
 *
 * Retell sends header `x-retell-signature` formatted `v={timestamp},d={hmac}`,
 * where hmac is the HMAC-SHA256 hex digest of `${rawBody}${timestamp}` keyed
 * with the signing key. The key is RETELL_WEBHOOK_SECRET when set, otherwise
 * the Retell API key. Kept standalone so it is unit-testable without a request.
 */
export function verifyRetellSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  keyOverride?: string
): boolean {
  const config = getRetellConfig();
  const key = keyOverride || config?.webhookSecret || config?.apiKey;
  if (!key || !signatureHeader) return false;
  const match = /^v=([^,]+),d=([0-9a-fA-F]+)$/.exec(signatureHeader.trim());
  if (!match) return false;
  const [, timestamp, digest] = match;
  const expected = createHmac("sha256", key).update(`${rawBody}${timestamp}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(digest.toLowerCase(), "utf8");
  return expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
}
