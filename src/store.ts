/**
 * Facts about the Fourth Man Roasters Shopify store that every white-label
 * shares. These are the values that have drifted before, so they live here and
 * nowhere else.
 */

/** The one store every white-label checks out through. */
export const SHOP_DOMAIN = 'https://ywszd1-1j.myshopify.com';

export type SellingPlan = {
  /** Shopify selling_plan id. */
  id: string;
  /** Reader-facing cadence, e.g. "Every month". */
  label: string;
  /** Percent off, as an integer. */
  discountPercent: number;
};

/**
 * "Subscribe & Save" plans, verified against the live store.
 *
 * THIS LIST HAS CHANGED UNDERNEATH THE SITES BEFORE. Two older ids
 * (5663391998 every-2-weeks, 5663457534 every-2-months) were deleted upstream
 * and left linked in shipped sites, sending buyers to a dead selling_plan.
 * Re-verify with `node kch/scripts/shopify/selling-plans.mjs` before changing.
 *
 * Never index into this array from application code — key by `id`. A shrinking
 * list has crashed buy boxes that used `SELLING_PLANS[1]`.
 *
 * Last verified: 2026-07-27.
 */
export const SELLING_PLANS: readonly SellingPlan[] = [
  { id: '5663424766', label: 'Every month', discountPercent: 5 },
  { id: '5690294526', label: 'Every 2 weeks', discountPercent: 5 },
];

/**
 * The headline discount, for copy that quotes it ("save 5%"). Read this rather
 * than hardcoding a number in a sentence, so marketing copy cannot drift away
 * from what checkout actually charges.
 */
export const SUBSCRIPTION_DISCOUNT_PERCENT = 5;

/** Look a plan up by id. Returns null for one-time purchases. */
export function findPlan(planId: string | null | undefined): SellingPlan | null {
  if (!planId) return null;
  return SELLING_PLANS.find((p) => p.id === planId) ?? null;
}
