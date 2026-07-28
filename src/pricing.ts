import { findPlan, SUBSCRIPTION_DISCOUNT_PERCENT } from './store';

/**
 * Pricing.
 *
 * This module exists because of a real bug. Three live sites offered
 * "Subscribe & save 5%" and then displayed the undiscounted price, because the
 * discount math was written per-site and only some sites got it. The saving was
 * invisible at the exact moment a buyer decides. Compute price here, once.
 */

export type PriceView = {
  /** What to display, e.g. "17.05". Already rounded to cents. */
  display: string;
  /** The undiscounted price, to strike through. Null when nothing is discounted. */
  original: string | null;
  /** Percent off applied, 0 for one-time. */
  discountPercent: number;
  /** Cadence label to append to a caption, e.g. "every month". Null for one-time. */
  cadence: string | null;
};

/**
 * Resolve what a buyer should actually see for a given base price and plan.
 *
 * @param basePrice the catalogue price as a string, e.g. "17.95"
 * @param planId    a selling_plan id, or null for one-time
 */
export function priceFor(basePrice: string, planId: string | null | undefined): PriceView {
  const plan = findPlan(planId);
  if (!plan) {
    return { display: basePrice, original: null, discountPercent: 0, cadence: null };
  }
  // Fall back to the headline discount if a plan somehow lacks one, so a
  // subscriber is never quoted MORE than the advertised saving.
  const pct = plan.discountPercent ?? SUBSCRIPTION_DISCOUNT_PERCENT;
  const discounted = (Number(basePrice) * (1 - pct / 100)).toFixed(2);
  return {
    display: discounted,
    original: basePrice,
    discountPercent: pct,
    cadence: plan.label.toLowerCase(),
  };
}

/** Formats a price string as currency for display, e.g. "17.05" -> "$17.05". */
export function formatPrice(price: string): string {
  return `$${price}`;
}
