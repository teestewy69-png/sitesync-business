/** Error text that is safe to store and show: secrets/tokens/emails redacted, length-capped. */
export function safeError(err: unknown, fallback = "Unknown error"): string {
  const raw = err instanceof Error ? `${err.name === "Error" ? "" : `${err.name}: `}${err.message}` : String(err ?? fallback);
  return redactSecrets(raw || fallback).slice(0, 300);
}

export function redactSecrets(text: string): string {
  return text
    .replace(/\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]+/g, "$1_$2_[redacted]")
    .replace(/\bwhsec_[A-Za-z0-9]+/g, "whsec_[redacted]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:token|key|secret|password|sig)=)[^&\s]+/gi, "$1[redacted]")
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
}
