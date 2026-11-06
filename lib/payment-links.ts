import { PATH_A_OFFER } from "@/lib/offer-copy";

/**
 * Live buy.stripe.com Payment Links for the public $1,995 website build (SITESYNC acct_1U3WHRDFMZliAuPB).
 * These are public URLs, not secrets. Optional NEXT_PUBLIC_STRIPE_LINK_* env vars override
 * the baked-in live URLs (for example on staging).
 */

export const LIVE_PAYMENT_LINKS = {
  startDeposit: "https://buy.stripe.com/4gM7sL7z74T7aX38o2a3u05",
  launchBalance: "https://buy.stripe.com/eVqdR9cTr1GV9SZ5bQa3u06",
  flatRate: "https://buy.stripe.com/14AcN56v385j7KR0VAa3u07",
  monitoring: "https://buy.stripe.com/aFa28r8Db4T73uB0VAa3u08",
} as const;

export const LIVE_PAYMENT_LINK_IDS = {
  startDeposit: "plink_1UTl69DFMZliAuPBdSNGsH66",
  launchBalance: "plink_1UTl6ADFMZliAuPBe021mZxI",
  flatRate: "plink_1UTl6BDFMZliAuPBORs4O8TM",
  monitoring: "plink_1UTl6CDFMZliAuPBXXDK43oO",
} as const;

export type PaymentLinkKey = keyof typeof LIVE_PAYMENT_LINKS;

export type PaymentLink = {
  key: PaymentLinkKey;
  url: string;
  amount: string;
  title: string;
  cta: string;
  description: string;
  analytics: string;
  primary?: boolean;
};

function publicUrl(name: string, fallback: string): string {
  const value = (typeof process !== "undefined" ? process.env[name] : "")?.trim();
  return value || fallback;
}

export function paymentLinkUrl(key: PaymentLinkKey): string {
  const envName = {
    startDeposit: "NEXT_PUBLIC_STRIPE_LINK_START_DEPOSIT",
    launchBalance: "NEXT_PUBLIC_STRIPE_LINK_LAUNCH_BALANCE",
    flatRate: "NEXT_PUBLIC_STRIPE_LINK_FLAT",
    monitoring: "NEXT_PUBLIC_STRIPE_LINK_MONITORING",
  }[key];
  return publicUrl(envName, LIVE_PAYMENT_LINKS[key]);
}

export function paymentLinks(): Record<PaymentLinkKey, PaymentLink> {
  return {
    startDeposit: {
      key: "startDeposit",
      url: paymentLinkUrl("startDeposit"),
      amount: PATH_A_OFFER.startDue,
      title: "50% start deposit",
      cta: `Pay ${PATH_A_OFFER.startDue} to start`,
      description: `50% of the ${PATH_A_OFFER.buildFrom} website build. Work starts after this payment and your onboarding details.`,
      analytics: "pay_start_deposit",
      primary: true,
    },
    launchBalance: {
      key: "launchBalance",
      url: paymentLinkUrl("launchBalance"),
      amount: PATH_A_OFFER.launchDue,
      title: "50% launch balance",
      cta: `Pay ${PATH_A_OFFER.launchDue} launch balance`,
      description: `Remaining 50% of the ${PATH_A_OFFER.buildFrom} website build, due at launch. Use this if you already paid the start deposit.`,
      analytics: "pay_launch_balance",
    },
    flatRate: {
      key: "flatRate",
      url: paymentLinkUrl("flatRate"),
      amount: PATH_A_OFFER.buildFrom,
      title: `${PATH_A_OFFER.buildFrom} flat`,
      cta: `Pay ${PATH_A_OFFER.buildFrom} flat`,
      description: `The same ${PATH_A_OFFER.buildFrom} website build in one payment.`,
      analytics: "pay_flat_rate",
      primary: true,
    },
    monitoring: {
      key: "monitoring",
      url: paymentLinkUrl("monitoring"),
      amount: "$129/mo",
      title: "Optional monitored SEO",
      cta: "Start monitored SEO ($129/mo)",
      description: PATH_A_OFFER.monitoring,
      analytics: "pay_monitoring",
    },
  };
}

export const DEFAULT_PAYMENT_KEYS: PaymentLinkKey[] = ["startDeposit", "flatRate", "launchBalance", "monitoring"];
