"use client";

import { scrollToId } from "@/lib/scroll";

type Props = {
  target: string;
  label: string;
  className: string;
};

export default function HeroScrollButton({ target, label, className }: Props) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => scrollToId(target)}
    >
      {label}
    </button>
  );
}
