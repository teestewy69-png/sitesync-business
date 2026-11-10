/**
 * Brand metadata for client deliverable previews (/demo/client/[projectId]/...): tab icon and share image
 * from the client's own uploads, so a client preview never shows Sitesinc's logo, favicon or share card.
 * Pure (no "@/" imports) so tests can load it directly.
 */
import type { Metadata } from "next";
import type { ClientAsset, ClientContent } from "./types";

const assetUrl = (projectId: string, filename: string) =>
  `/api/client-assets/${encodeURIComponent(projectId)}/${encodeURIComponent(filename)}`;

const firstByRole = (content: ClientContent | null | undefined, role: string): ClientAsset | null =>
  content?.assets?.find((asset) => asset.role === role) || null;

function absolute(path: string, hostOrigin?: string | null): string {
  const origin = String(hostOrigin || "").replace(/\/$/, "");
  return origin && /^https?:\/\//i.test(origin) ? `${origin}${path}` : path;
}

export type ClientPreviewBrand = {
  /** Square tab icon: the "icon" upload, else the "logo" upload. */
  icon: { src: string; alt: string; contentType: string } | null;
  logo: { src: string; alt: string } | null;
  /** Share image (og:image): the "share" upload, else the logo. Absolute when a host origin is known. */
  shareImage: { url: string; alt: string } | null;
};

export function clientPreviewBrand(
  projectId: string,
  content: ClientContent | null | undefined,
  hostOrigin?: string | null
): ClientPreviewBrand {
  const icon = firstByRole(content, "icon") || firstByRole(content, "logo");
  const logo = firstByRole(content, "logo");
  const share = firstByRole(content, "share") || logo;
  return {
    icon: icon ? { src: assetUrl(projectId, icon.filename), alt: icon.alt, contentType: icon.contentType } : null,
    logo: logo ? { src: assetUrl(projectId, logo.filename), alt: logo.alt } : null,
    shareImage: share ? { url: absolute(assetUrl(projectId, share.filename), hostOrigin), alt: share.alt } : null,
  };
}

/**
 * Metadata fields for a client preview page. Always replaces the root layout's Sitesinc icons (with the client's
 * icon, or an empty data URI when none is uploaded) and only emits Open Graph / Twitter images from client uploads.
 */
export function clientPreviewBrandMetadata(
  brand: ClientPreviewBrand,
  page: { title: string; description: string; siteName: string }
): Pick<Metadata, "icons" | "openGraph" | "twitter"> {
  const icon = brand.icon
    ? { url: brand.icon.src, type: brand.icon.contentType || "image/png" }
    : { url: "data:," };
  const icons: Metadata["icons"] = { icon: [icon], shortcut: [icon], apple: brand.icon ? [{ url: brand.icon.src }] : [] };
  if (!brand.shareImage) return { icons, openGraph: null, twitter: null };
  return {
    icons,
    openGraph: {
      title: page.title,
      description: page.description,
      siteName: page.siteName,
      type: "website",
      images: [{ url: brand.shareImage.url, alt: brand.shareImage.alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: page.title,
      description: page.description,
      images: [brand.shareImage.url],
    },
  };
}
