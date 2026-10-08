/**
 * City Launch LLM provider: resolve which key is configured (names only, never values) and make
 * OpenAI-compatible / Anthropic chat calls with timeouts and classified, retryable errors.
 *
 * Resolution order (first non-empty env var wins):
 *   CITY_LAUNCH_LLM_API_KEY  (+ CITY_LAUNCH_LLM_BASE_URL, default OpenRouter; CITY_LAUNCH_LLM_MODEL)
 *   OPENROUTER_API_KEY       https://openrouter.ai/api/v1                       openai/gpt-4o-mini (ScaleQuan default)
 *   OPENAI_API_KEY           https://api.openai.com/v1                          gpt-4o-mini
 *   ANTHROPIC_API_KEY        https://api.anthropic.com/v1/messages              claude-3-5-haiku-latest
 *   GEMINI_API_KEY           https://generativelanguage.googleapis.com/v1beta/openai   gemini-2.0-flash
 *   EMERGENT_LLM_KEY         https://integrations.emergentagent.com/llm         gpt-4o-mini (Emergent universal key, OpenAI-compatible proxy)
 * CITY_LAUNCH_LLM_MODEL overrides the model for whichever provider is picked.
 *
 * Pure + erasable TypeScript (env + fetch injected) so `node --test` can import it.
 */

export type LlmProviderId = "custom" | "openrouter" | "openai" | "anthropic" | "gemini" | "emergent";

export type LlmProvider = {
  id: LlmProviderId;
  envKey: string;
  label: string;
  baseUrl: string;
  model: string;
  format: "openai" | "anthropic";
};

export type LlmProviderStatus =
  | { configured: true; provider: LlmProviderId; envKey: string; label: string; model: string; baseUrl: string }
  | { configured: false; checked: string[]; detail: string };

type Env = Record<string, string | undefined>;

const PROVIDERS: Array<Omit<LlmProvider, "model"> & { defaultModel: string }> = [
  { id: "custom", envKey: "CITY_LAUNCH_LLM_API_KEY", label: "City Launch key", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini", format: "openai" },
  { id: "openrouter", envKey: "OPENROUTER_API_KEY", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "openai/gpt-4o-mini", format: "openai" },
  { id: "openai", envKey: "OPENAI_API_KEY", label: "OpenAI", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", format: "openai" },
  { id: "anthropic", envKey: "ANTHROPIC_API_KEY", label: "Anthropic", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-5-haiku-latest", format: "anthropic" },
  { id: "gemini", envKey: "GEMINI_API_KEY", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-2.0-flash", format: "openai" },
  { id: "emergent", envKey: "EMERGENT_LLM_KEY", label: "Emergent universal key", baseUrl: "https://integrations.emergentagent.com/llm", defaultModel: "gpt-4o-mini", format: "openai" },
];

export const LLM_ENV_KEYS = PROVIDERS.map((p) => p.envKey);

export function resolveLlmProvider(env: Env): { provider: LlmProvider; apiKey: string } | null {
  for (const p of PROVIDERS) {
    const apiKey = (env[p.envKey] || "").trim();
    if (!apiKey) continue;
    const baseUrl = p.id === "custom" ? (env.CITY_LAUNCH_LLM_BASE_URL || "").trim().replace(/\/+$/, "") || p.baseUrl : p.baseUrl;
    const model = (env.CITY_LAUNCH_LLM_MODEL || "").trim() || p.defaultModel;
    return { provider: { id: p.id, envKey: p.envKey, label: p.label, baseUrl, model, format: p.format }, apiKey };
  }
  return null;
}

/** Safe to show in the UI: names + model only, never the key. */
export function describeLlmProvider(env: Env): LlmProviderStatus {
  const resolved = resolveLlmProvider(env);
  if (!resolved) {
    return {
      configured: false,
      checked: [...LLM_ENV_KEYS],
      detail: `No LLM key configured. Set one of ${LLM_ENV_KEYS.join(", ")} in the environment (Netlify env or .env.local). City Launch will not write or fake copy without it.`,
    };
  }
  const { provider } = resolved;
  return { configured: true, provider: provider.id, envKey: provider.envKey, label: provider.label, model: provider.model, baseUrl: provider.baseUrl };
}

export type LlmErrorKind = "missing_key" | "auth" | "rate_limit" | "server" | "timeout" | "network" | "bad_response" | "client";

export class LlmError extends Error {
  kind: LlmErrorKind;
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
  constructor(kind: LlmErrorKind, message: string, extra: { status?: number; retryAfterMs?: number } = {}) {
    super(message);
    this.name = "LlmError";
    this.kind = kind;
    this.status = extra.status;
    this.retryAfterMs = extra.retryAfterMs;
    this.retryable = kind === "rate_limit" || kind === "server" || kind === "timeout" || kind === "network" || kind === "bad_response";
  }
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatResult = { content: string; model: string; usage?: { promptTokens?: number; completionTokens?: number } };

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

function retryAfter(headers: { get(name: string): string | null }): number | undefined {
  const raw = headers.get("retry-after");
  if (!raw) return undefined;
  const secs = Number(raw);
  if (Number.isFinite(secs)) return Math.min(120_000, Math.max(0, secs * 1000));
  const at = Date.parse(raw);
  return Number.isFinite(at) ? Math.min(120_000, Math.max(0, at - Date.now())) : undefined;
}

function classifyStatus(status: number, body: string, headers: { get(name: string): string | null }): LlmError {
  const snippet = body.replace(/\s+/g, " ").slice(0, 200);
  if (status === 401 || status === 403) return new LlmError("auth", `Provider rejected the key (${status}). ${snippet}`, { status });
  if (status === 402) return new LlmError("auth", `Provider says the account is out of credit (402). ${snippet}`, { status });
  if (status === 429) return new LlmError("rate_limit", `Rate limited (429). ${snippet}`, { status, retryAfterMs: retryAfter(headers) });
  if (status >= 500) return new LlmError("server", `Provider error ${status}. ${snippet}`, { status, retryAfterMs: retryAfter(headers) });
  return new LlmError("client", `Provider returned ${status}. ${snippet}`, { status });
}

export async function chatCompletion(
  resolved: { provider: LlmProvider; apiKey: string },
  messages: ChatMessage[],
  opts: { fetchImpl?: FetchLike; timeoutMs?: number; temperature?: number; maxTokens?: number; jsonMode?: boolean; appName?: string } = {}
): Promise<ChatResult> {
  const doFetch = (opts.fetchImpl || (globalThis.fetch as unknown as FetchLike));
  const { provider, apiKey } = resolved;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000);
  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;
  if (provider.format === "anthropic") {
    url = `${provider.baseUrl}/messages`;
    headers = { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
    body = {
      model: provider.model,
      max_tokens: opts.maxTokens ?? 3000,
      temperature: opts.temperature ?? 0.6,
      system: messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n"),
      messages: messages.filter((m) => m.role !== "system"),
    };
  } else {
    url = `${provider.baseUrl}/chat/completions`;
    headers = { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
    if (provider.id === "openrouter" || provider.id === "custom") headers["X-Title"] = opts.appName || "Sitesinc City Launch";
    body = { model: provider.model, messages, temperature: opts.temperature ?? 0.6, max_tokens: opts.maxTokens ?? 3000 };
    if (opts.jsonMode && (provider.id === "openai" || provider.id === "emergent" || provider.id === "openrouter")) {
      body.response_format = { type: "json_object" };
    }
  }
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await doFetch(url, { method: "POST", headers, body: JSON.stringify(body), signal: controller.signal });
  } catch (err) {
    clearTimeout(timer);
    if ((err as { name?: string })?.name === "AbortError") throw new LlmError("timeout", `No reply within ${Math.round((opts.timeoutMs ?? 90_000) / 1000)}s.`);
    throw new LlmError("network", `Network error: ${err instanceof Error ? err.message : "unknown"}`);
  }
  let text = "";
  try {
    text = await res.text();
  } catch (err) {
    clearTimeout(timer);
    throw new LlmError("network", `Reading reply failed: ${err instanceof Error ? err.message : "unknown"}`);
  }
  clearTimeout(timer);
  if (!res.ok) throw classifyStatus(res.status, text, res.headers);
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new LlmError("bad_response", "Provider reply was not JSON.");
  }
  if (provider.format === "anthropic") {
    const parts = Array.isArray(json.content) ? (json.content as Array<{ type?: string; text?: string }>) : [];
    const content = parts.filter((p) => p.type === "text").map((p) => p.text || "").join("");
    if (!content) throw new LlmError("bad_response", "Empty Anthropic reply.");
    const usage = json.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return { content, model: String(json.model || provider.model), usage: { promptTokens: usage?.input_tokens, completionTokens: usage?.output_tokens } };
  }
  const choice = (Array.isArray(json.choices) ? json.choices[0] : null) as { message?: { content?: string } } | null;
  const content = choice?.message?.content || "";
  if (!content) throw new LlmError("bad_response", "Empty completion.");
  const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  return { content, model: String(json.model || provider.model), usage: { promptTokens: usage?.prompt_tokens, completionTokens: usage?.completion_tokens } };
}
