import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * TCPA calling guards for Retell outbound calls (see docs/retell.md).
 *
 * These are conservative engineering guardrails, not legal advice:
 *  - Calls only inside 08:00–20:45 in the CALLED party's local time, which
 *    sits inside the 8:00 AM–9:00 PM band the TCPA allows.
 *  - A manual do-not-call suppression list is checked before every call.
 *
 * Limits: a lead's timezone is inferred from its STATE only. Multi-zone
 * states use their most populous zone (FL/TX/TN/IN/MI included), so a lead
 * in a state's minority zone can be off by an hour — the 20:45 cutoff keeps
 * a one-hour error inside the legal band at both ends.
 */

/** State → IANA timezone of the state's most populous zone. */
export const STATE_TIMEZONES: Record<string, string> = {
  CA: "America/Los_Angeles",
  TX: "America/Chicago", // Central (Houston/Dallas); El Paso is Mountain
  FL: "America/New_York", // Eastern; the panhandle is Central
  NY: "America/New_York",
  IL: "America/Chicago",
  PA: "America/New_York",
  OH: "America/New_York",
  GA: "America/New_York",
  NC: "America/New_York",
  MI: "America/Detroit", // Eastern; a slice of the UP is Central
  NJ: "America/New_York",
  VA: "America/New_York",
  WA: "America/Los_Angeles",
  AZ: "America/Phoenix", // no daylight saving
  MA: "America/New_York",
  TN: "America/Chicago", // Central (Nashville/Memphis); Knoxville/Chattanooga are Eastern
  IN: "America/Indiana/Indianapolis", // Eastern; NW/SE corners are Central
  MO: "America/Chicago",
  WI: "America/Chicago",
  MD: "America/New_York",
  CO: "America/Denver",
  MN: "America/Chicago",
};

/** Minutes after local midnight at which calling may start (08:00). */
export const CALL_WINDOW_START_MINUTES = 8 * 60;
/** Minutes after local midnight at which calling must stop (20:45). */
export const CALL_WINDOW_END_MINUTES = 20 * 60 + 45;

/** Minutes since local midnight for `date` in the given IANA timezone. */
export function localMinutesOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return (hour % 24) * 60 + minute;
}

/** True only between 08:00 and 20:45 local time in `timeZone`. */
export function isWithinCallingHours(date: Date, timeZone: string): boolean {
  const minutes = localMinutesOfDay(date, timeZone);
  return minutes >= CALL_WINDOW_START_MINUTES && minutes <= CALL_WINDOW_END_MINUTES;
}

/**
 * Normalizes a US phone number to 10 digits: strips punctuation and a
 * leading country-code 1. Returns whatever digits remain (possibly not 10)
 * so callers can validate length themselves.
 */
export function normalizePhoneDigits(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
}

/** True when `phone` matches any entry of `suppressionList` (format-insensitive). */
export function isSuppressed(phone: string, suppressionList: string[]): boolean {
  const target = normalizePhoneDigits(phone);
  if (!target) return false;
  return suppressionList.some((entry) => normalizePhoneDigits(entry) === target);
}

/**
 * Loads the manual do-not-call suppression list from
 * data/retell-suppression.json (a JSON array of phone strings, any format).
 * Missing or unparseable file = empty list: the factory stays operable,
 * and the file's absence is visible in docs/retell.md as a known limit.
 */
export function loadSuppressionList(
  filePath: string = path.join(process.cwd(), "data", "retell-suppression.json")
): string[] {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "");
  } catch {
    return [];
  }
}
