/**
 * Store-backed client content: uploaded images (Netlify Blobs on Netlify, ./data locally - same backend selection
 * as every other factory document), operator page copy and the structured artwork list. Every write goes through
 * the client workspace document, so a template rebuild (refreshClientWorkspace) keeps it.
 */
import { createHash } from "node:crypto";
import { deleteBinary, readBinary, writeBinary } from "@/lib/persistence";
import { newId } from "@/lib/store";
import type { ClientBuildConfig } from "./client-config";
import {
  applyOperatorCopy,
  clientAssetKey,
  clientCopyIssues,
  CLIENT_ASSET_FILE,
  CLIENT_ASSET_ROLES,
  emptyClientContent,
  isOperatorCopy,
  MAX_ALT_LENGTH,
  MAX_CLIENT_ASSETS,
  MAX_PAGE_COPY_CHARS,
  normalizeCopyBody,
  sanitizeArtworks,
  suppliedContentFrom,
  validateClientAssetUpload,
} from "./client-content";
import { autoSeedClientDraftPages, readClientWorkspace, updateClientWorkspace } from "./client-workspace";
import type { ClientAsset, ClientAssetRole, ClientContent, FactoryWorkspace } from "./types";

export class ClientContentError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ClientContentError";
    this.status = status;
  }
}

async function requireWorkspace(projectId: string): Promise<FactoryWorkspace> {
  const ws = await readClientWorkspace(projectId);
  if (!ws) throw new ClientContentError("Client workspace not initialized yet (run init-client-factory first).", 404);
  return ws;
}

function contentOf(ws: FactoryWorkspace): ClientContent {
  const c = ws.clientContent || emptyClientContent();
  return { assets: c.assets || [], artworks: c.artworks || [], updatedAt: c.updatedAt || "" };
}

/* --------------------------------- assets --------------------------------- */

export async function saveClientAsset(
  projectId: string,
  input: { name: string; type?: string; bytes: Uint8Array; alt?: string; role?: string },
  actor = "operator"
): Promise<{ asset: ClientAsset; deduped: boolean }> {
  const check = validateClientAssetUpload(input);
  if (!check.ok) throw new ClientContentError(check.error, check.status);
  const ws = await requireWorkspace(projectId);
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const existing = contentOf(ws).assets.find((a) => a.sha256 === sha256);
  if (existing) return { asset: existing, deduped: true };
  if (contentOf(ws).assets.length >= MAX_CLIENT_ASSETS) {
    throw new ClientContentError(`This client already has ${MAX_CLIENT_ASSETS} images; delete some first.`, 409);
  }
  const id = newId("ast").toLowerCase();
  const filename = `${id}${check.ext}`;
  const key = clientAssetKey(projectId, filename);
  await writeBinary(key, input.bytes, check.contentType);
  const asset: ClientAsset = {
    id,
    filename,
    key,
    contentType: check.contentType,
    bytes: input.bytes.byteLength,
    sha256,
    sourceName: check.sourceName,
    alt: check.alt,
    role: check.role,
    uploadedAt: new Date().toISOString(),
    uploadedBy: actor,
  };
  const race: { deduped: ClientAsset | null } = { deduped: null };
  try {
    await updateClientWorkspace(projectId, (current) => {
      const content = contentOf(current);
      race.deduped = content.assets.find((a) => a.sha256 === sha256) || null;
      if (race.deduped) return current;
      if (content.assets.length >= MAX_CLIENT_ASSETS) {
        throw new ClientContentError(`This client already has ${MAX_CLIENT_ASSETS} images; delete some first.`, 409);
      }
      current.clientContent = { ...content, assets: [...content.assets, asset], updatedAt: asset.uploadedAt };
      return current;
    });
  } catch (err) {
    await deleteBinary(key).catch(() => undefined);
    throw err;
  }
  if (race.deduped) {
    await deleteBinary(key).catch(() => undefined);
    return { asset: race.deduped, deduped: true };
  }
  return { asset, deduped: false };
}

/** Bytes of an uploaded client image, only while it is still listed on the client (deleted assets are not served). */
export async function readClientAsset(
  projectId: string,
  filename: string
): Promise<{ bytes: Buffer; contentType: string; alt: string } | null> {
  if (!/^[a-z0-9_-]{1,80}$/i.test(projectId) || !CLIENT_ASSET_FILE.test(filename)) return null;
  const ws = await readClientWorkspace(projectId);
  const asset = ws?.clientContent?.assets?.find((a) => a.filename === filename);
  if (!asset) return null;
  const bytes = await readBinary(clientAssetKey(projectId, filename));
  return bytes ? { bytes, contentType: asset.contentType, alt: asset.alt } : null;
}

export async function updateClientAsset(
  projectId: string,
  assetId: string,
  patch: { alt?: string; role?: string }
): Promise<FactoryWorkspace> {
  await requireWorkspace(projectId);
  const alt = patch.alt === undefined ? undefined : String(patch.alt).replace(/\s+/g, " ").trim().slice(0, MAX_ALT_LENGTH);
  if (alt !== undefined && !alt) throw new ClientContentError("Alt text cannot be empty.");
  const role =
    patch.role === undefined
      ? undefined
      : (CLIENT_ASSET_ROLES as string[]).includes(patch.role)
        ? (patch.role as ClientAssetRole)
        : null;
  if (role === null) throw new ClientContentError(`Role must be one of ${CLIENT_ASSET_ROLES.join(", ")}.`);
  return updateClientWorkspace(projectId, (current) => {
    const content = contentOf(current);
    if (!content.assets.some((a) => a.id === assetId)) throw new ClientContentError("Asset not found.", 404);
    current.clientContent = {
      ...content,
      assets: content.assets.map((a) =>
        a.id === assetId ? { ...a, ...(alt !== undefined ? { alt } : {}), ...(role ? { role } : {}) } : a
      ),
      updatedAt: new Date().toISOString(),
    };
    return current;
  });
}

export async function deleteClientAsset(projectId: string, assetId: string): Promise<FactoryWorkspace> {
  await requireWorkspace(projectId);
  const found: { removed?: ClientAsset } = {};
  const ws = await updateClientWorkspace(projectId, (current) => {
    const content = contentOf(current);
    found.removed = content.assets.find((a) => a.id === assetId);
    if (!found.removed) throw new ClientContentError("Asset not found.", 404);
    current.clientContent = {
      assets: content.assets.filter((a) => a.id !== assetId),
      artworks: content.artworks.map((w) => {
        if (w.imageId !== assetId) return w;
        const rest = { ...w };
        delete rest.imageId;
        return rest;
      }),
      updatedAt: new Date().toISOString(),
    };
    return current;
  });
  if (found.removed) await deleteBinary(found.removed.key).catch(() => undefined);
  return ws;
}

/* -------------------------------- artworks -------------------------------- */

export async function setClientArtworks(
  projectId: string,
  artworks: unknown,
  pricingNote: string
): Promise<{ workspace: FactoryWorkspace; warnings: string[]; count: number }> {
  const ws = await requireWorkspace(projectId);
  const check = sanitizeArtworks(artworks, { assetIds: contentOf(ws).assets.map((a) => a.id), pricingNote });
  if (check.errors.length) throw new ClientContentError(check.errors.slice(0, 8).join(" "));
  const workspace = await updateClientWorkspace(projectId, (current) => {
    const content = contentOf(current);
    const ids = new Set(content.assets.map((a) => a.id));
    const missing = check.artworks.find((w) => w.imageId && !ids.has(w.imageId));
    if (missing) throw new ClientContentError(`Image ${missing.imageId} was deleted meanwhile; reload and retry.`, 409);
    current.clientContent = { ...content, artworks: check.artworks, updatedAt: new Date().toISOString() };
    return current;
  });
  return { workspace, warnings: check.warnings, count: check.artworks.length };
}

/* -------------------------------- page copy ------------------------------- */

export async function setClientPageCopy(
  projectId: string,
  slug: string,
  input: { body: string; title?: string; metaDescription?: string },
  ctx: { actor: string; pricingNote: string }
): Promise<FactoryWorkspace> {
  const ws = await requireWorkspace(projectId);
  if (!ws.pages.some((p) => p.slug === slug)) throw new ClientContentError(`No page "${slug}" on this client's template.`, 404);
  const body = normalizeCopyBody(input.body);
  if (!body) throw new ClientContentError("Page copy is empty. Use clear-client-page-copy to go back to the template draft.");
  if (body.length > MAX_PAGE_COPY_CHARS) {
    throw new ClientContentError(`Page copy is too long (${body.length} characters; limit ${MAX_PAGE_COPY_CHARS}).`);
  }
  const issues = clientCopyIssues([input.title || "", input.metaDescription || "", body].join("\n"), ctx.pricingNote);
  if (issues.length) throw new ClientContentError(issues.join(" "));
  const when = new Date().toISOString();
  return updateClientWorkspace(projectId, (current) => {
    current.pages = current.pages.map((page) => (page.slug === slug ? applyOperatorCopy(page, input, ctx.actor, when) : page));
    return current;
  });
}

/** Drop operator copy from one page and put the current template draft back (still a review draft). */
export async function clearClientPageCopy(
  projectId: string,
  slug: string,
  config: ClientBuildConfig
): Promise<FactoryWorkspace> {
  const ws = await requireWorkspace(projectId);
  const page = ws.pages.find((p) => p.slug === slug);
  if (!page) throw new ClientContentError(`No page "${slug}" on this client's template.`, 404);
  if (!isOperatorCopy(page)) throw new ClientContentError(`Page "${slug}" has no operator copy.`);
  return updateClientWorkspace(projectId, (current) => {
    const target = current.pages.find((p) => p.slug === slug);
    if (!target) return current;
    const blank = { ...target, body: "", headings: [], approvedBy: "", approvedAt: "", source: "template" as const };
    delete blank.copyUpdatedAt;
    delete blank.copyUpdatedBy;
    const { pages } = autoSeedClientDraftPages([blank], current.briefs, config, suppliedContentFrom(current.clientContent));
    current.pages = current.pages.map((p) => (p.slug === slug ? pages[0] : p));
    return current;
  });
}
