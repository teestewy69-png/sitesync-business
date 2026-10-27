/**
 * City Launch LLM provider: resolve which key is configured (names only, never values) and make
 * OpenAI-compatible / Anthropic chat calls with timeouts and classified, retryable errors.
 *
 * Resolution order (first non-empty env var wins):
 *   CITY_LAUNCH_LLM_API_KEY  (+ CITY_LAUNCH_LLM_BASE_URL, default OpenRouter; CITY_LAUNCH_LLM_MODEL)
 *   OPENROUTER_API_KEY       https://openrouter.ai/api/v1                       openai/gpt-4o-mini (ScaleQuan default)
 *   NETLIFY_AI_GATEWAY_KEY   NETLIFY_AI_GATEWAY_BASE_URL                        gpt-4o-mini
 *   OPENAI_API_KEY           OPENAI_BASE_URL or https://api.openai.com/v1       gpt-4o-mini
 *   ANTHROPIC_API_KEY        ANTHROPIC_BASE_URL or https://api.anthropic.com/v1  claude-haiku-4-5 (gateway) / claude-3-5-haiku-latest
 *   GEMINI_API_KEY           GOOGLE_GEMINI_BASE_URL or Google OpenAI-compat     gemini-2.0-flash
 *   EMERGENT_LLM_KEY         https://integrations.emergentagent.com/llm         gpt-4o-mini
 * Local / self-hosted (checked FIRST, no key needed): LLM_BASE_URL (OpenAI-compatible, e.g. Ollama
 * http://127.0.0.1:11434/v1) + LLM_MODEL (e.g. qwen3.8:latest), optional LLM_API_KEY. Hosted keys stay the
 * fallback when LLM_BASE_URL is unset. Reasoning models' <think> blocks are stripped from replies.
 * CITY_LAUNCH_LLM_MODEL overrides the model for the primary provider.
 * CITY_LAUNCH_LLM_MODEL_B is the second model on a 500-city dual-writer run (or a second configured provider).
 *
 * On Netlify with AI Gateway enabled, OPENAI_API_KEY / OPENAI_BASE_URL (and Anthropic/Gemini twins) are
 * injected - honour those base URLs so writing does not skip the gateway and hit the vendor with a placeholder key.
 *
 * Pure + erasable TypeScript (env + fetch injected) so `node --test` can import it.
 */

export type LlmProviderId = "local" | "custom" | "openrouter" | "netlify" | "openai" | "anthropic" | "gemini" | "emergent";

export type LlmProvider = {
  id: LlmProviderId;
  envKey: string;
  label: string;
  baseUrl: string;
  model: string;
  format: "openai" | "anthropic";
};

export type LlmResolved = { provider: LlmProvider; apiKey: string };

export type LlmRosterEntry = { envKey: string; label: string; model: string; format: "openai" | "anthropic" };

export type LlmProviderStatus =
  | { configured: true; provider: LlmProviderId; envKey: string; label: string; model: string; baseUrl: string; roster: LlmRosterEntry[] }
  | { configured: false; checked: string[]; detail: string };

type Env = Record<string, string | undefined>;

function trimUrl(value?: string): string {
  return (value || "").trim().replace(/\/+$/, "");
}

function viaGateway(baseUrl: string, vendorHost: string): boolean {
  const host = baseUrl.toLowerCase();
  return Boolean(baseUrl) && !host.includes(vendorHost);
}

type ProviderSpec = {
  id: LlmProviderId;
  envKey: string;
  label: string;
  format: "openai" | "anthropic";
  fallbackModel: string;
  baseUrl: (env: Env) => string;
  defaultModel: (env: Env, baseUrl: string) => string;
  altModel: (env: Env, baseUrl: string) => string;
};

const PROVIDERS: ProviderSpec[] = [
  {
    id: "custom",
    envKey: "CITY_LAUNCH_LLM_API_KEY",
    label: "City Launch key",
    format: "openai",
    fallbackModel: "openai/gpt-4o-mini",
    baseUrl: (env) => trimUrl(env.CITY_LAUNCH_LLM_BASE_URL) || "https://openrouter.ai/api/v1",
    defaultModel: () => "openai/gpt-4o-mini",
    altModel: () => "openai/gpt-4.1-mini",
  },
  {
    id: "openrouter",
    envKey: "OPENROUTER_API_KEY",
    label: "OpenRouter",
    format: "openai",
    fallbackModel: "openai/gpt-4o-mini",
    baseUrl: () => "https://openrouter.ai/api/v1",
    defaultModel: () => "openai/gpt-4o-mini",
    altModel: () => "openai/gpt-4.1-mini",
  },
  {
    id: "netlify",
    envKey: "NETLIFY_AI_GATEWAY_KEY",
    label: "Netlify AI Gateway",
    format: "openai",
    fallbackModel: "gpt-4o-mini",
    baseUrl: (env) => trimUrl(env.NETLIFY_AI_GATEWAY_BASE_URL) || trimUrl(env.OPENAI_BASE_URL),
    defaultModel: () => "gpt-4o-mini",
    altModel: () => "gpt-4.1-mini",
  },
  {
    id: "openai",
    envKey: "OPENAI_API_KEY",
    label: "OpenAI",
    format: "openai",
    fallbackModel: "gpt-4o-mini",
    baseUrl: (env) => trimUrl(env.OPENAI_BASE_URL) || "https://api.openai.com/v1",
    defaultModel: () => "gpt-4o-mini",
    altModel: () => "gpt-4.1-mini",
  },
  {
    id: "anthropic",
    envKey: "ANTHROPIC_API_KEY",
    label: "Anthropic",
    format: "anthropic",
    fallbackModel: "claude-3-5-haiku-latest",
    baseUrl: (env) => trimUrl(env.ANTHROPIC_BASE_URL) || "https://api.anthropic.com/v1",
    defaultModel: (_env, baseUrl) => (viaGateway(baseUrl, "api.anthropic.com") ? "claude-haiku-4-5" : "claude-3-5-haiku-latest"),
    altModel: (_env, baseUrl) => (viaGateway(baseUrl, "api.anthropic.com") ? "claude-sonnet-4-5" : "claude-3-5-haiku-latest"),
  },
  {
    id: "gemini",
    envKey: "GEMINI_API_KEY",
    label: "Google Gemini",
    format: "openai",
    fallbackModel: "gemini-2.0-flash",
    baseUrl: (env) => trimUrl(env.GOOGLE_GEMINI_BASE_URL) || "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: () => "gemini-2.0-flash",
    altModel: () => "gemini-2.5-flash",
  },
  {
    id: "emergent",
    envKey: "EMERGENT_LLM_KEY",
    label: "Emergent universal key",
    format: "openai",
    fallbackModel: "gpt-4o-mini",
    baseUrl: () => "https://integrations.emergentagent.com/llm",
    defaultModel: () => "gpt-4o-mini",
    altModel: () => "gpt-4.1-mini",
  },
];

const LOCAL_SPEC: ProviderSpec = {
  id: "local",
  envKey: "LLM_BASE_URL",
  label: "Local OpenAI-compatible (Ollama)",
  format: "openai",
  fallbackModel: "llama3",
  baseUrl: (env) => trimUrl(env.LLM_BASE_URL),
  defaultModel: (env) => (env.LLM_MODEL || "").trim() || "llama3",
  altModel: (env) => (env.LLM_MODEL || "").trim() || "llama3",
};

export const LLM_ENV_KEYS = ["LLM_BASE_URL", ...PROVIDERS.map((p) => p.envKey)];

function labelFor(spec: ProviderSpec, baseUrl: string): string {
  if (spec.id === "openai" && viaGateway(baseUrl, "api.openai.com")) return "OpenAI via gateway";
  if (spec.id === "anthropic" && viaGateway(baseUrl, "api.anthropic.com")) return "Anthropic via gateway";
  if (spec.id === "gemini" && viaGateway(baseUrl, "generativelanguage.googleapis.com")) return "Gemini via gateway";
  return spec.label;
}

function toResolved(spec: ProviderSpec, env: Env, apiKey: string, model: string): LlmResolved {
  const baseUrl = spec.baseUrl(env);
  return {
    apiKey,
    provider: {
      id: spec.id,
      envKey: spec.envKey,
      label: labelFor(spec, baseUrl),
      baseUrl,
      model: model || spec.fallbackModel,
      format: spec.format,
    },
  };
}

function listed(env: Env): Array<{ spec: ProviderSpec; apiKey: string; baseUrl: string }> {
  const out: Array<{ spec: ProviderSpec; apiKey: string; baseUrl: string }> = [];
  const localBase = trimUrl(env.LLM_BASE_URL);
  if (localBase && (env.LLM_MODEL || "").trim() && /^https?:\/\//i.test(localBase)) {
    out.push({ spec: LOCAL_SPEC, apiKey: (env.LLM_API_KEY || "").trim() || "ollama", baseUrl: localBase });
  }
  for (const spec of PROVIDERS) {
    const apiKey = (env[spec.envKey] || "").trim();
    if (!apiKey) continue;
    const baseUrl = spec.baseUrl(env);
    if (!baseUrl) continue;
    out.push({ spec, apiKey, baseUrl });
  }
  return out;
}

export function resolveLlmProvider(env: Env): LlmResolved | null {
  const first = listed(env)[0];
  if (!first) return null;
  const model = first.spec.id === "local"
    ? (env.LLM_MODEL || "").trim()
    : (env.CITY_LAUNCH_LLM_MODEL || "").trim() || first.spec.defaultModel(env, first.baseUrl);
  return toResolved(first.spec, env, first.apiKey, model);
}

/**
 * One or two writers for a batch. Prefers pairing a different provider format (OpenAI-compat + Anthropic)
 * so a 500-city run is not one model's skeleton. Falls back to CITY_LAUNCH_LLM_MODEL_B on the primary.
 */
export function resolveLlmRoster(env: Env, opts: { twoModels?: boolean } = {}): LlmResolved[] {
  const primary = resolveLlmProvider(env);
  if (!primary) return [];
  if (opts.twoModels === false) return [primary];
  const rows = listed(env);
  const other = rows.find((row) => row.spec.format !== primary.provider.format);
  if (other) {
    const modelB = (env.CITY_LAUNCH_LLM_MODEL_B || "").trim() || other.spec.defaultModel(env, other.baseUrl);
    const second = toResolved(other.spec, env, other.apiKey, modelB);
    if (second.provider.model !== primary.provider.model || second.provider.id !== primary.provider.id) return [primary, second];
  }
  const alt = (env.CITY_LAUNCH_LLM_MODEL_B || "").trim() || rows[0].spec.altModel(env, rows[0].baseUrl);
  if (alt && alt !== primary.provider.model) {
    return [primary, { apiKey: primary.apiKey, provider: { ...primary.provider, model: alt } }];
  }
  return [primary];
}

export function pickResolvedForSlug(roster: LlmResolved[], slug: string): LlmResolved {
  if (!roster.length) throw new Error("No LLM provider in roster.");
  if (roster.length === 1) return roster[0];
  let h = 0;
  for (let i = 0; i < slug.length; i += 1) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return roster[h % roster.length];
}

function rosterEntries(env: Env): LlmRosterEntry[] {
  return resolveLlmRoster(env).map((r) => ({
    envKey: r.provider.envKey,
    label: r.provider.label,
    model: r.provider.model,
    format: r.provider.format,
  }));
}

/** Safe to show in the UI: names + model only, never the key. */
export function describeLlmProvider(env: Env): LlmProviderStatus {
  const resolved = resolveLlmProvider(env);
  if (!resolved) {
    return {
      configured: false,
      checked: [...LLM_ENV_KEYS],
      detail: `No LLM key configured. Set one of ${LLM_ENV_KEYS.join(", ")} in the environment (Netlify env, Netlify AI Gateway, or .env.local). City Launch will not write or fake copy without it.`,
    };
  }
  const { provider } = resolved;
  return {
    configured: true,
    provider: provider.id,
    envKey: provider.envKey,
    label: provider.label,
    model: provider.model,
    baseUrl: provider.baseUrl,
    roster: rosterEntries(env),
  };
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
    if (opts.jsonMode && provider.format === "openai" && provider.id !== "gemini") {
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
  const content = stripThinking(choice?.message?.content || "");
  if (!content) throw new LlmError("bad_response", "Empty completion.");
  const usage = json.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
  return { content, model: String(json.model || provider.model), usage: { promptTokens: usage?.prompt_tokens, completionTokens: usage?.completion_tokens } };
}

/** Remove reasoning blocks (<think>...</think>) some local models (qwen3) put before the answer. */
export function stripThinking(text: string): string {
  return String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
}
