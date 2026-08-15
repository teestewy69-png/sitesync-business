const TICKER_COPY =
  "Be one of the 1st 10 customers and receive 1/2 off on your website build";

export default function AnnouncementTicker() {
  // Duplicate segments for a seamless CSS loop (translate -50%).
  const segments = Array.from({ length: 4 }, (_, i) => (
    <span key={i} className="inline-flex shrink-0 items-center gap-8 px-4">
      <span>{TICKER_COPY}</span>
      <span aria-hidden className="text-red-500/50">
        •
      </span>
    </span>
  ));

  return (
    <div
      className="sticky top-0 z-[60] flex h-10 items-center overflow-hidden border-b border-red-500/20 bg-black/95 backdrop-blur-md sm:h-11"
      role="region"
      aria-label="Launch offer"
    >
      <div className="flex w-max animate-ticker whitespace-nowrap text-xs font-semibold tracking-wide text-red-500 sm:text-sm">
        <div className="flex shrink-0 items-center">{segments}</div>
        <div className="flex shrink-0 items-center" aria-hidden>
          {segments}
        </div>
      </div>
    </div>
  );
}
