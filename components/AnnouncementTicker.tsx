/**
 * Stationary giveaway ticker (Tony's order, 2026-11-27).
 *
 * This slot used to carry a scrolling pricing marquee. That ticker was
 * removed, and its copy also carried the retired day-31 auto-charge
 * monitoring line, which contradicts the approved opt-in policy — it
 * does not come back. Tony's replacement is a STATIONARY bar (no
 * scrolling, no animation) announcing the website giveaway: the name is
 * GIVEAWAY_NAME in lib/giveaway.ts ("The SitesInc Website Giveaway"),
 * entry is free, and the giveaway runs every week. The name is written
 * out here rather than imported because this component renders from a
 * client boundary (see SitesincTicker) and lib/giveaway pulls in
 * server-only store/mail code.
 *
 * The `announcement-ticker` class is kept on the wrapper so the
 * globals.css rule that hides the bar on client-site pages still
 * applies; the animated `announcement-ticker__track` class is gone.
 */
export default function AnnouncementTicker() {
  return (
    <div
      className="announcement-ticker sticky top-0 z-[100] flex items-center justify-center border-b border-brand-600 bg-brand-400 px-4 py-2.5"
      role="region"
      aria-label="Website giveaway"
    >
      <p className="text-center text-sm font-bold tracking-wide text-black sm:text-base">
        The SitesInc Website Giveaway — enter free, a new winner every week.
        <a
          href="/giveaway"
          data-analytics-cta="giveaway"
          data-analytics-location="ticker"
          className="ml-3 whitespace-nowrap underline decoration-2 underline-offset-2 transition hover:opacity-75"
        >
          Enter now
        </a>
      </p>
    </div>
  );
}
