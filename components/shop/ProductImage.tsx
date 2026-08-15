"use client";

import { useState } from "react";
import type { Product } from "@/data/products";
import { getProductImageSrc } from "@/data/products";

type Props = {
  product: Product;
  className?: string;
  imgClassName?: string;
  alt?: string;
};

/**
 * Shows `/products/{slug}.*` (or product.image) when available.
 * Falls back to the gold/dark gradient panel if the asset fails to load.
 */
export default function ProductImage({
  product,
  className = "",
  imgClassName = "absolute inset-0 h-full w-full object-cover",
  alt,
}: Props) {
  const src = getProductImageSrc(product);
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-brand-500/25 via-surface to-black ${className}`}
    >
      {!failed ? (
        // Public SVG/WebP assets under /products — plain img keeps SVG crisp.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? product.name}
          className={imgClassName}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}
