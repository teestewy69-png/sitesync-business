import type { BacklinkRecord, BacklinkStatus } from "./types";

const BACKLINK_STATUSES: readonly BacklinkStatus[] = ["active", "lost", "pending"];

export function isAddBacklinkOp(op: string): boolean {
  return op === "add-backlink" || op === "add_backlink";
}

export function isPatchBacklinkOp(op: string): boolean {
  return op === "patch-backlink" || op === "patch_backlink";
}

export function isRemoveBacklinkOp(op: string): boolean {
  return op === "remove-backlink" || op === "remove_backlink";
}

function asField(body: Record<string, string | string[] | undefined>, key: string): string | undefined {
  if (body[key] === undefined) return undefined;
  return String(body[key]).trim();
}

export function createBacklinkRecord(
  body: Record<string, string | string[] | undefined>,
  id: string,
  when: string
): { ok: true; record: BacklinkRecord } | { ok: false; error: string } {
  const referringDomain = asField(body, "referringDomain") || "";
  const destinationUrl = asField(body, "destinationUrl") || "";
  if (!referringDomain || !destinationUrl) {
    return { ok: false, error: "Referring domain and destination URL are required. Do not fabricate links." };
  }
  const statusRaw = asField(body, "status");
  let status: BacklinkStatus = "active";
  if (statusRaw) {
    if (!BACKLINK_STATUSES.includes(statusRaw as BacklinkStatus)) {
      return { ok: false, error: "Invalid backlink status." };
    }
    status = statusRaw as BacklinkStatus;
  }
  return {
    ok: true,
    record: {
      id,
      referringDomain,
      destinationUrl,
      anchor: asField(body, "anchor") || "",
      relevance: asField(body, "relevance") || "",
      qualityNotes: asField(body, "qualityNotes") || "",
      acquisitionMethod: asField(body, "acquisitionMethod") || "",
      discoveredDate: (asField(body, "discoveredDate") || when).slice(0, 10),
      status,
    },
  };
}

export function patchBacklinkList(
  backlinks: BacklinkRecord[],
  body: Record<string, string | string[] | undefined>
): { ok: true; backlinks: BacklinkRecord[] } | { ok: false; error: string } {
  const id = asField(body, "id") || "";
  if (!id) return { ok: false, error: "Backlink id is required." };
  const idx = backlinks.findIndex((item) => item.id === id);
  if (idx < 0) return { ok: false, error: "Backlink not found." };

  const current = backlinks[idx];
  const next: BacklinkRecord = { ...current };

  const referringDomain = asField(body, "referringDomain");
  if (referringDomain !== undefined) next.referringDomain = referringDomain;
  const destinationUrl = asField(body, "destinationUrl");
  if (destinationUrl !== undefined) next.destinationUrl = destinationUrl;
  const anchor = asField(body, "anchor");
  if (anchor !== undefined) next.anchor = anchor;
  const relevance = asField(body, "relevance");
  if (relevance !== undefined) next.relevance = relevance;
  const qualityNotes = asField(body, "qualityNotes");
  if (qualityNotes !== undefined) next.qualityNotes = qualityNotes;
  const acquisitionMethod = asField(body, "acquisitionMethod");
  if (acquisitionMethod !== undefined) next.acquisitionMethod = acquisitionMethod;
  const discoveredDate = asField(body, "discoveredDate");
  if (discoveredDate !== undefined) next.discoveredDate = discoveredDate.slice(0, 10);

  const statusRaw = asField(body, "status");
  if (statusRaw !== undefined && statusRaw !== "") {
    if (!BACKLINK_STATUSES.includes(statusRaw as BacklinkStatus)) {
      return { ok: false, error: "Invalid backlink status." };
    }
    next.status = statusRaw as BacklinkStatus;
  }

  if (!next.referringDomain || !next.destinationUrl) {
    return { ok: false, error: "Referring domain and destination URL are required. Do not fabricate links." };
  }

  const copy = backlinks.slice();
  copy[idx] = next;
  return { ok: true, backlinks: copy };
}

export function removeBacklinkList(
  backlinks: BacklinkRecord[],
  body: Record<string, string | string[] | undefined>
): { ok: true; backlinks: BacklinkRecord[] } | { ok: false; error: string } {
  const id = asField(body, "id") || "";
  if (!id) return { ok: false, error: "Backlink id is required." };
  if (!backlinks.some((item) => item.id === id)) {
    return { ok: false, error: "Backlink not found." };
  }
  return { ok: true, backlinks: backlinks.filter((item) => item.id !== id) };
}
