"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { products } from "@/data/products";
import { createZip } from "@/lib/create-zip";
import { productPageHtml, shopListingHtml } from "@/lib/shop-export";

async function fetchBytes(url: string): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export default function DownloadShopPages() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const encoder = new TextEncoder();
      const files = [
        {
          name: "shop.html",
          data: encoder.encode(shopListingHtml(products)),
        },
      ];

      for (const product of products) {
        files.push({
          name: `product-${product.slug}.html`,
          data: encoder.encode(productPageHtml(product)),
        });

        const photoUrl = product.image.src;
        const fallbackUrl = `/products/${product.imageFile}`;
        let bytes: Uint8Array<ArrayBuffer>;
        try {
          bytes = await fetchBytes(photoUrl);
        } catch {
          bytes = await fetchBytes(fallbackUrl);
        }
        files.push({
          name: `images/${product.imageFile}`,
          data: bytes,
        });
      }

      const zip = createZip(files);
      const blob = new Blob([zip], { type: "application/zip" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "sitesync-shop-pages.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not build the shop download.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:border-brand-400/50 disabled:cursor-wait disabled:opacity-70"
      >
        <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        {busy ? "Preparing zip…" : "Download shop pages"}
      </button>
      {error ? (
        <p className="max-w-xs text-xs text-red-300">{error}</p>
      ) : (
        <p className="max-w-xs text-xs text-slate-500 sm:text-right">
          Saves an offline ZIP with the catalog, product pages, and photos.
        </p>
      )}
    </div>
  );
}
