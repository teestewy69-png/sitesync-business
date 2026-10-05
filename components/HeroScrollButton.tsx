"use client";

import { scrollToId } from "@/lib/scroll";

type Props = {
  target: string;
  label: string;
  className: string;
  /** Optional GA4 CTA name, picked up by the delegated listener in Analytics.tsx. */
  analyticsCta?: string;
  analyticsLocation?: string;
};

export default function HeroScrollButton({
  target,
  label,
  className,
  analyticsCta,
  analyticsLocation,
}: Props) {
  return (
    <button
      type="button"
      className={className}
      data-analytics-cta={analyticsCta}
      data-analytics-location={analyticsCta ? analyticsLocation : undefined}
      onClick={() => scrollToId(target)}
    >
      {label}
    </button>
  );
}
