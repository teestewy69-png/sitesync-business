const TICKER_COPY =
  "Website builds starting at $1,995 · $997.50 to start · $997.50 at launch · Optional monitoring $129/month · Request, not a purchase";

export default function AnnouncementTicker() {
  // Duplicate segments for a seamless CSS loop (translate -50%).
  const segments = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="inline-flex shrink-0 items-center gap-10 px-5">
      <span>{TICKER_COPY}</span>
      <span aria-hidden className="text-white/70">
        •
      </span>
    </span>
  ));

  return (
    <div
      className="announcement-ticker sticky top-0 z-[100] flex h-11 items-center overflow-hidden border-b border-red-700 bg-red-600 sm:h-12"
      role="region"
      aria-label="Current pricing"
    >
      <div className="announcement-ticker__track flex w-max whitespace-nowrap text-sm font-bold uppercase tracking-wide text-white sm:text-base">
        <div className="flex shrink-0 items-center">{segments}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {segments}
        </div>
      </div>
    </div>
  );
}
