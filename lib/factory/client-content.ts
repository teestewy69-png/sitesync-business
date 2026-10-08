/**
 * Client-supplied content (pure helpers): operator page copy, uploaded image validation and the structured
 * artwork list for the artist (portfolio) template. Nothing here invents content: every value comes from the
 * operator / client. Prices are dropped unless the client's pricing note says prices are listed publicly.
 */
import type {
  ArtworkAvailability,
  ClientArtwork,
  ClientAsset,
  ClientAssetRole,
  ClientContent,
  FactoryPage,
} from "./types";

/* --------------------------------- uploads -------------------------------- */

/** Per-file limit. Netlify function request bodies are capped near 6 MB, so 4 MB leaves room for multipart overhead. */
export const MAX_CLIENT_ASSET_BYTES = 4_000_000;
export const MAX_CLIENT_ASSETS = 250;
export const MAX_ALT_LENGTH = 200;

export const CLIENT_ASSET_TYPES: Record<string, { ext: string; contentType: string }> = {
  jpeg: { ext: ".jpg", contentType: "image/jpeg" },
  png: { ext: ".png", contentType: "image/png" },
  webp: { ext: ".webp", contentType: "image/webp" },
};

export const CLIENT_ASSET_ROLES: ClientAssetRole[] = ["work", "artist-photo", "logo", "other"];

/** Detect the real image type from the file's first bytes (the name and declared type are not trusted). */
export function sniffImageType(bytes: Uint8Array): (typeof CLIENT_ASSET_TYPES)[string] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return CLIENT_ASSET_TYPES.jpeg;
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return CLIENT_ASSET_TYPES.png;
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
    String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "WEBP"
  ) {
    return CLIENT_ASSET_TYPES.webp;
  }
  return null;
}

export type AssetUploadCheck =
  | { ok: true; ext: string; contentType: string; alt: string; role: ClientAssetRole; sourceName: string }
  | { ok: false; status: 400 | 413 | 415; error: string };

export function cleanSourceName(name: string): string {
  const base = String(name || "").split(/[\\/]/).pop() || "";
  return base.replace(/[^a-zA-Z0-9._ -]/g, "").trim().slice(0, 120) || "upload";
}

/** Validate one upload: size, real image type (JPEG/PNG/WebP by magic bytes), alt text and role. */
export function validateClientAssetUpload(input: {
  name: string;
  type?: string;
  bytes: Uint8Array;
  alt?: string;
  role?: string;
}): AssetUploadCheck {
  const size = input.bytes?.byteLength ?? 0;
  if (!size) return { ok: false, status: 400, error: "The file is empty." };
  if (size > MAX_CLIENT_ASSET_BYTES) {
    return {
      ok: false,
      status: 413,
      error: `File is too big (${(size / 1_000_000).toFixed(1)} MB). Keep images under ${MAX_CLIENT_ASSET_BYTES / 1_000_000} MB.`,
    };
  }
  const sniffed = sniffImageType(input.bytes);
  if (!sniffed) {
    return { ok: false, status: 415, error: "Only JPEG, PNG or WebP images can be uploaded." };
  }
  const declared = String(input.type || "").toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== sniffed.contentType && !(declared === "image/jpg" && sniffed.contentType === "image/jpeg")) {
    return { ok: false, status: 415, error: `File content is ${sniffed.contentType} but it was sent as ${declared}.` };
  }
  const alt = cleanText(input.alt, MAX_ALT_LENGTH);
  if (!alt) return { ok: false, status: 400, error: "Alt text is required (describe the image in a few words)." };
  const role = (CLIENT_ASSET_ROLES as string[]).includes(String(input.role || "")) ? (input.role as ClientAssetRole) : "work";
  return {
    ok: true,
    ext: sniffed.ext,
    contentType: sniffed.contentType,
    alt,
    role,
    sourceName: cleanSourceName(input.name),
  };
}

/** Public URL of an uploaded client image (served by app/api/client-assets/[projectId]/[file]). */
export function clientAssetUrl(projectId: string, filename: string): string {
  return `/api/client-assets/${encodeURIComponent(projectId)}/${encodeURIComponent(filename)}`;
}

export const CLIENT_ASSET_FILE = /^ast_[a-z0-9]{4,40}\.(jpg|png|webp)$/;

export function clientAssetKey(projectId: string, filename: string): string {
  if (!/^[a-z0-9_-]{1,80}$/i.test(projectId) || !CLIENT_ASSET_FILE.test(filename)) {
    throw new Error("Invalid client asset key.");
  }
  return `factory/clients/${projectId}/assets/${filename}`;
}

export function emptyClientContent(): ClientContent {
  return { assets: [], artworks: [], updatedAt: "" };
}

/* --------------------------------- pricing -------------------------------- */

/**
 * True only when the client's pricing note says prices are shown publicly (e.g. "Prices listed on each work").
 * "Available on request", blank or anything vague keeps every price hidden.
 */
export function pricingAllowsListedPrices(pricingNote: string | undefined | null): boolean {
  const note = String(pricingNote || "");
  if (!note.trim() || /request|inquir|ask|contact/i.test(note)) return false;
  return /\b(prices?|pricing)\b[^.]*\b(listed|shown|published|public|posted|displayed)\b|\b(listed|public|published)\s+prices?\b/i.test(note);
}

/* ------------------------------- artwork list ------------------------------ */

export const ARTWORK_AVAILABILITY: ArtworkAvailability[] = [
  "available",
  "reserved",
  "sold",
  "private_collection",
  "not_for_sale",
  "unknown",
];

const AVAILABILITY_LABEL: Record<ArtworkAvailability, string> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  private_collection: "Private collection",
  not_for_sale: "Not for sale",
  unknown: "",
};

export function availabilityLabel(value: ArtworkAvailability | undefined): string {
  return value ? AVAILABILITY_LABEL[value] || "" : "";
}

export const MAX_ARTWORKS = 300;

function cleanText(value: unknown, max: number): string {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeAvailability(value: unknown): ArtworkAvailability | "" | null {
  const raw = cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, "_");
  if (!raw) return "";
  if ((ARTWORK_AVAILABILITY as string[]).includes(raw)) return raw as ArtworkAvailability;
  return null;
}

export type ArtworkSanitizeResult = { artworks: ClientArtwork[]; errors: string[]; warnings: string[] };

/**
 * Clean an operator-supplied artwork list. Every field is optional; rows with no title and no image are skipped.
 * Unknown availability values or image ids are errors (nothing is guessed). Prices are dropped unless allowed.
 */
export function sanitizeArtworks(
  input: unknown,
  ctx: { assetIds: Iterable<string>; pricingNote?: string }
): ArtworkSanitizeResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(input)) return { artworks: [], errors: ["artworks must be a list."], warnings };
  if (input.length > MAX_ARTWORKS) errors.push(`Too many works (${input.length}); the limit is ${MAX_ARTWORKS}.`);
  const assetIds = new Set(ctx.assetIds);
  const pricesAllowed = pricingAllowsListedPrices(ctx.pricingNote);
  const seen = new Set<string>();
  const artworks: ClientArtwork[] = [];
  let droppedPrices = 0;
  input.slice(0, MAX_ARTWORKS).forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Row ${index + 1}: not an object.`);
      return;
    }
    const r = row as Record<string, unknown>;
    const title = cleanText(r.title, 160);
    const imageId = cleanText(r.imageId, 60);
    if (!title && !imageId) return;
    if (imageId && !assetIds.has(imageId)) {
      errors.push(`Row ${index + 1}${title ? ` (${title})` : ""}: image ${imageId} is not an uploaded asset.`);
      return;
    }
    const availability = normalizeAvailability(r.availability);
    if (availability === null) {
      errors.push(`Row ${index + 1}${title ? ` (${title})` : ""}: availability must be one of ${ARTWORK_AVAILABILITY.join(", ")}.`);
      return;
    }
    let id = cleanText(r.id, 60);
    if (!/^[a-z0-9_-]{1,60}$/i.test(id) || seen.has(id)) id = `art-${index + 1}`;
    while (seen.has(id)) id = `${id}x`;
    seen.add(id);
    const work: ClientArtwork = { id };
    const set = (key: "title" | "series" | "medium" | "year" | "size", value: string) => {
      if (value) work[key] = value;
    };
    set("title", title);
    set("series", cleanText(r.series, 80));
    set("medium", cleanText(r.medium, 160));
    set("year", cleanText(r.year, 20));
    set("size", cleanText(r.size, 80));
    if (availability) work.availability = availability;
    if (imageId) work.imageId = imageId;
    if (r.featured === true || r.featured === "true" || r.featured === "1" || r.featured === 1) work.featured = true;
    const price = cleanText(r.price, 40);
    if (price) {
      if (pricesAllowed) work.price = price;
      else droppedPrices += 1;
    }
    artworks.push(work);
  });
  if (droppedPrices) {
    warnings.push(`${droppedPrices} price(s) dropped: the client's pricing note does not say prices are listed publicly.`);
  }
  return { artworks, errors, warnings };
}

/** "Acrylic on canvas · 45 × 45 in · 2020 · Available" (+ price only when the pricing note allows it). */
export function artworkCaption(work: ClientArtwork, pricingNote?: string): string {
  return [
    work.medium,
    work.size,
    work.year,
    availabilityLabel(work.availability),
    work.price && pricingAllowsListedPrices(pricingNote) ? work.price : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Featured works first (in list order), then the rest. */
export function orderedArtworks(works: ClientArtwork[]): ClientArtwork[] {
  return [...works.filter((w) => w.featured), ...works.filter((w) => !w.featured)];
}

export type PreviewWork = {
  id: string;
  title: string;
  series: string;
  caption: string;
  image: { src: string; alt: string } | null;
};

export function previewWorks(
  projectId: string,
  content: ClientContent | null | undefined,
  pricingNote?: string,
  limit?: number
): PreviewWork[] {
  if (!content?.artworks?.length) return [];
  const byId = new Map((content.assets || []).map((a) => [a.id, a]));
  const list = orderedArtworks(content.artworks).map((work) => {
    const asset = work.imageId ? byId.get(work.imageId) : undefined;
    return {
      id: work.id,
      title: work.title || "Untitled",
      series: work.series || "",
      caption: artworkCaption(work, pricingNote),
      image: asset ? { src: clientAssetUrl(projectId, asset.filename), alt: asset.alt || work.title || "Artwork" } : null,
    };
  });
  return typeof limit === "number" ? list.slice(0, limit) : list;
}

export function assetByRole(content: ClientContent | null | undefined, role: ClientAssetRole): ClientAsset | null {
  return content?.assets?.find((a) => a.role === role) || null;
}

/* -------------------------------- page copy -------------------------------- */

export const MAX_PAGE_COPY_CHARS = 20_000;

const COPY_CLAIM_PATTERNS: Array<[RegExp, string]> = [
  [/\btestimonials?\b|\breviews?\b|★|\b\d(\.\d)?\s?stars?\b|\brated \d/i, "reviews, ratings or testimonials"],
  [/booked jobs|book the crew|hired them/i, "booked-jobs claims"],
  [/sitesinc\.co|live at sitesinc/i, "Sitesinc branding"],
  [/\[FACTORY DRAFT/i, "the factory draft marker"],
];

/**
 * Reasons operator copy cannot be saved as client copy. Prices ("$" amounts) are only allowed when the client's
 * pricing note says prices are listed publicly; review / testimonial / rating language is never allowed here.
 */
export function clientCopyIssues(text: string, pricingNote?: string): string[] {
  const issues: string[] = [];
  if (/\$\s?\d/.test(text) && !pricingAllowsListedPrices(pricingNote)) {
    issues.push("Contains a price, but the client's pricing note does not say prices are listed publicly.");
  }
  for (const [pattern, label] of COPY_CLAIM_PATTERNS) {
    const match = text.match(pattern);
    if (match) issues.push(`Contains ${label} ("${match[0]}"). Client copy carries no invented proof.`);
  }
  return issues;
}

export function normalizeCopyBody(body: string): string {
  return String(body || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function headingsFromBody(body: string): string[] {
  return body
    .split("\n")
    .map((line) => /^#{1,3}\s+(.+)$/.exec(line.trim())?.[1]?.trim() || "")
    .filter(Boolean)
    .slice(0, 20);
}

/** Plain-text excerpt of the first paragraphs (headings skipped), cut on a sentence boundary when possible. */
export function copyExcerpt(body: string, max = 420): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split("\n")
        .filter((line) => !/^#{1,6}\s/.test(line.trim()))
        .map((line) => line.replace(/^[-*]\s+/, "").trim())
        .join(" ")
        .trim()
    )
    .filter((p) => p && !/^\[.*\]$/.test(p));
  let out = "";
  for (const p of paragraphs) {
    if (!out) out = p;
    else if (out.length + p.length + 1 <= max) out = `${out} ${p}`;
    else break;
  }
  if (out.length <= max) return out;
  const cut = out.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return stop > max * 0.5 ? cut.slice(0, stop + 1) : `${cut.replace(/\s+\S*$/, "")}…`;
}

export function wordCountOf(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

export function isOperatorCopy(page: Pick<FactoryPage, "source"> | null | undefined): boolean {
  return page?.source === "operator";
}

/**
 * Put operator-supplied client copy on a page. It becomes a review draft (never auto-approved): any earlier approval
 * is cleared, so the approval gate applies to the new words. Template rebuilds keep it (source "operator").
 */
export function applyOperatorCopy(
  page: FactoryPage,
  input: { body: string; title?: string; metaDescription?: string },
  actor: string,
  when: string
): FactoryPage {
  const body = normalizeCopyBody(input.body);
  const title = cleanText(input.title, 160) || page.title;
  const meta = cleanText(input.metaDescription, 155) || page.metaDescription;
  return {
    ...page,
    title,
    metaDescription: meta,
    headings: headingsFromBody(body),
    body,
    wordCount: wordCountOf(body),
    status: "ready_for_review",
    noindex: true,
    approvedBy: "",
    approvedAt: "",
    source: "operator",
    copyUpdatedAt: when,
    copyUpdatedBy: actor,
  };
}

/** Summary of supplied content that templated drafts use instead of placeholders. */
export type SuppliedContent = {
  artworks: ClientArtwork[];
  hasArtistPhoto: boolean;
};

export function suppliedContentFrom(content: ClientContent | null | undefined): SuppliedContent {
  return {
    artworks: content?.artworks || [],
    hasArtistPhoto: Boolean(assetByRole(content, "artist-photo")),
  };
}
