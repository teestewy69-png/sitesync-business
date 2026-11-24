import { readFileSync } from "node:fs";
import path from "node:path";
import {
  isSuppressed,
  isWithinCallingHours,
  loadSuppressionList,
  normalizePhoneDigits,
  STATE_TIMEZONES,
} from "./retell-guards";

/**
 * The 55-lead Retell outbound test batch (see docs/retell.md).
 *
 * Tony supplies the rows in data/retell-test-batch.csv
 * (header: business,phone,city,state). filterCallable() applies the TCPA
 * guards from lib/retell-guards.ts before any number may be called.
 */

export type BatchRow = {
  business: string;
  phone: string;
  city: string;
  state: string;
};

export type SkippedRow = { row: BatchRow; reason: string };

export type CallableFilterResult = {
  callable: BatchRow[];
  skipped: SkippedRow[];
};

/** Minimal CSV reader: handles quoted fields, embedded commas, and "" escapes. */
export function parseBatchCsv(text: string): BatchRow[] {
  const rows: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    rows.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushRecord();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) pushRecord();

  const nonEmpty = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmpty.length === 0) return [];
  const [header, ...body] = nonEmpty;
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = {
    business: col("business"),
    phone: col("phone"),
    city: col("city"),
    state: col("state"),
  };
  return body.map((r) => ({
    business: (idx.business >= 0 ? r[idx.business] : "")?.trim() ?? "",
    phone: (idx.phone >= 0 ? r[idx.phone] : "")?.trim() ?? "",
    city: (idx.city >= 0 ? r[idx.city] : "")?.trim() ?? "",
    state: (idx.state >= 0 ? r[idx.state] : "")?.trim().toUpperCase() ?? "",
  }));
}

/** Reads data/retell-test-batch.csv (header-only until Tony adds the 55 rows). */
export function loadBatchRows(
  filePath: string = path.join(process.cwd(), "data", "retell-test-batch.csv")
): BatchRow[] {
  try {
    return parseBatchCsv(readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

/** A callable US number normalizes to exactly 10 digits. */
export function isValidUsPhone(phone: string): boolean {
  return normalizePhoneDigits(phone).length === 10;
}

/**
 * Splits batch rows into callable vs skipped, in task order:
 * valid US phone → not on the suppression list → inside calling hours
 * for the row's state timezone.
 */
export function filterCallable(
  rows: BatchRow[],
  now: Date,
  suppressionList: string[] = loadSuppressionList()
): CallableFilterResult {
  const callable: BatchRow[] = [];
  const skipped: SkippedRow[] = [];
  for (const row of rows) {
    if (!isValidUsPhone(row.phone)) {
      skipped.push({ row, reason: `invalid US phone number: "${row.phone}"` });
      continue;
    }
    if (isSuppressed(row.phone, suppressionList)) {
      skipped.push({ row, reason: "on the do-not-call suppression list" });
      continue;
    }
    const timeZone = STATE_TIMEZONES[row.state.toUpperCase()];
    if (!timeZone) {
      skipped.push({ row, reason: `no timezone mapping for state "${row.state}"` });
      continue;
    }
    if (!isWithinCallingHours(now, timeZone)) {
      skipped.push({ row, reason: `outside calling hours in ${timeZone} (08:00–20:45 local)` });
      continue;
    }
    callable.push(row);
  }
  return { callable, skipped };
}
