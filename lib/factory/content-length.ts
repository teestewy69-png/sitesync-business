/**
 * General factory feature: per-article target length. Every drafted article (client or flip mode) is checked
 * against a min/max word window. Default window tops out at 1,500 words (Tony's "up to 1,500-word content").
 */
export type ContentLengthTarget = { min: number; target: number; max: number };

export const DEFAULT_ARTICLE_LENGTH: ContentLengthTarget = { min: 900, target: 1500, max: 1500 };
export const MAX_ARTICLE_WORDS = 1500;

export type ContentLengthCheck = {
  words: number;
  min: number;
  max: number;
  target: number;
  status: "ok" | "too_short" | "too_long";
  message: string;
};

export function countWords(text: string): number {
  const plain = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`|\-]+/g, " ")
    .trim();
  return plain ? plain.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length : 0;
}

/** Normalize a requested target: clamp to 1..1500 and keep min <= target <= max. */
export function lengthTarget(input: Partial<ContentLengthTarget> = {}): ContentLengthTarget {
  const clamp = (n: unknown, fallback: number) => {
    const v = Math.round(Number(n));
    return Number.isFinite(v) && v > 0 ? Math.min(v, MAX_ARTICLE_WORDS) : fallback;
  };
  const max = clamp(input.max, DEFAULT_ARTICLE_LENGTH.max);
  const target = Math.min(clamp(input.target, max), max);
  const min = Math.min(clamp(input.min, Math.min(DEFAULT_ARTICLE_LENGTH.min, target)), target);
  return { min, target, max };
}

export function checkContentLength(text: string, target: Partial<ContentLengthTarget> = {}): ContentLengthCheck {
  const t = lengthTarget(target);
  const words = countWords(text);
  const status = words < t.min ? "too_short" : words > t.max ? "too_long" : "ok";
  const message =
    status === "ok"
      ? `${words} words (window ${t.min}-${t.max}).`
      : status === "too_short"
        ? `${words} words: needs at least ${t.min - words} more (min ${t.min}).`
        : `${words} words: cut ${words - t.max} (max ${t.max}).`;
  return { words, ...t, status, message };
}
