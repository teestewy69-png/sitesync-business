/** FlipRadar: the first flip (build-to-sell) project config. */
export const FLIPRADAR_FLIP_CONFIG = {
  mode: "flip" as const,
  businessName: "FlipRadar",
  domain: "flipradar.co",
  niche: "house flipping / real-estate investing",
  businessType: "content-tools",
  primaryGoal: "Build to sell",
  offer: "Free house-flipping calculators, city flip-market data and guides for small investors",
  ga4MeasurementId: "G-X306Z6MEQH",
  gscProperty: "sc-domain:flipradar.co",
  /** AdSense: flipradar.co added but NOT approved ("Low value content", ads.txt not found as of 2026-10-20). */
  adsensePublisherId: "ca-pub-2781122781186262",
  adsenseApproved: false,
  /** GA4 stream currently points at https://flipradar-app.netlify.app; update the stream URL at launch on flipradar.co. */
  ga4StreamUrl: "https://flipradar-app.netlify.app",
  /** flipradar.co GSC properties exist but are NOT verified for Tony's account yet. */
  gscVerified: false,
  sellTargetMonths: 6,
  notes: "Pivot from NBA props to house flipping. Sell around month 6 (Flippa or private); hold to 12 if trend is strong. Plan: /workspace/flipradar-flip/PLAN.md",
};
