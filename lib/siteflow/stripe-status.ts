/** Read-only comparison of the catalog against Stripe prices (by lookup key). Never creates anything. */
import { catalog } from "@/data/products";
import { safeError } from "./sanitize";
import { writeStripeStatus, type StripeCatalogStatus } from "./state";
import { pricesByLookupKey, stripeKeyMode, stripeSecretKey } from "./stripe";

export async function checkStripeCatalog(): Promise<StripeCatalogStatus> {
  const mode = stripeKeyMode(stripeSecretKey());
  const entries = catalog.filter((e) => e.stripeLookupKey && !e.retired && !e.contactOnly);
  const status: StripeCatalogStatus = {
    checkedAt: new Date().toISOString(),
    mode,
    source: "runtime-check",
    items: entries.map((e) => ({
      slug: e.slug,
      lookupKey: e.stripeLookupKey!,
      catalogCents: typeof e.priceCents === "number" ? e.priceCents : null,
      state: typeof e.priceCents === "number" ? "unchecked" : "unpriced",
    })),
  };
  if (mode === "test" || mode === "live") {
    try {
      const prices = await pricesByLookupKey(entries.map((e) => e.stripeLookupKey!), { fresh: true });
      for (const item of status.items) {
        if (item.state === "unpriced") continue;
        const price = prices.get(item.lookupKey);
        if (!price) item.state = "missing";
        else {
          item.priceId = price.id;
          item.stripeCents = price.unit_amount;
          const entry = entries.find((e) => e.slug === item.slug)!;
          const wantInterval = entry.kind === "subscription" ? entry.interval || "month" : null;
          item.state =
            price.unit_amount === item.catalogCents && (price.recurring?.interval || null) === wantInterval
              ? "in_sync"
              : "amount_mismatch";
        }
      }
    } catch (err) {
      status.error = safeError(err, "Stripe check failed");
    }
  } else {
    status.error = mode === "unset" ? "STRIPE_SECRET_KEY is not set." : "STRIPE_SECRET_KEY is not a valid Stripe secret key.";
  }
  await writeStripeStatus(status);
  return status;
}
