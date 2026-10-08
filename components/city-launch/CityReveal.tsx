"use client";

import { useEffect } from "react";

/**
 * Progressive scroll-reveal for City Launch pages. Content is fully visible without JS; this only adds
 * the motion class when the visitor has not asked for reduced motion. ~0.5 kB, no dependencies.
 */
export default function CityReveal({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    root.classList.add("cl-motion");
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("cl-in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    nodes.forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, [rootId]);
  return null;
}
