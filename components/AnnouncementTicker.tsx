const TICKER_COPY =
  "Be one of the 1st 10 customers and receive 1/2 off on your website build";

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
      aria-label="Launch offer"
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
