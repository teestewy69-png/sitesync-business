"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/data/products";
import {
  getProductImageFallbackSrc,
  getProductImageSrc,
} from "@/data/products";

type Props = {
  product: Product;
  className?: string;
  imgClassName?: string;
  alt?: string;
};

/**
 * Tries the bundled product photo, then `/products/{slug}.svg`, then a gradient.
 */
export default function ProductImage({
  product,
  className = "",
  imgClassName = "absolute inset-0 h-full w-full object-cover",
  alt,
}: Props) {
  const primary = getProductImageSrc(product);
  const fallback = getProductImageFallbackSrc(product);
  const [src, setSrc] = useState(primary);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setSrc(primary);
    setFailed(false);
  }, [primary, product.slug]);

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br from-brand-500/25 via-surface to-black ${className}`}
    >
      {!failed ? (
        // Public SVG/WebP assets under /products — plain img keeps SVG crisp.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={src}
          src={src}
          alt={alt ?? product.name}
          className={imgClassName}
          onError={() => {
            if (src !== fallback) {
              setSrc(fallback);
              return;
            }
            setFailed(true);
          }}
        />
      ) : null}
    </div>
  );
}
