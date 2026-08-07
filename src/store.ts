/**
 * Facts about the Fourth Man Roasters Shopify store that every white-label
 * shares. These are the values that have drifted before, so they live here and
 * nowhere else.
 */

import type { Weight } from './catalog';

/** The one store every white-label checks out through. */
export const SHOP_DOMAIN = 'https://ywszd1-1j.myshopify.com';

export type SellingPlan = {
  /** Shopify selling_plan id. */
  id: string;
  /** Reader-facing cadence, e.g. "Every month". */
  label: string;
  /** Percent off, as an integer. */
  discountPercent: number;
  /**
   * The weights this plan is actually attached to on Shopify.
   *
   * A selling plan is not offered store-wide. It is attached to specific
   * variants, and passing a plan id for a variant it is not attached to sends
   * the buyer to a broken checkout. Offer a plan only for a weight listed here.
   */
  weights: readonly Weight[];
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
  // "Subscribe & Save" (group 2693267710). 20 lb only, and the only plans
  // that discount anything.
  { id: '5663424766', label: 'Every month', discountPercent: 5, weights: ['20 lb'] },
  { id: '5690294526', label: 'Every 2 weeks', discountPercent: 5, weights: ['20 lb'] },
  // "Subscribe to The Coffee Club" (group 2734424318). Every size, no discount.
  // It is attached to 20 lb as well, but we deliberately do not offer it there:
  // a 20 lb buyer should always get the 5% plan, never the 0% one by accident.
  { id: '5705826558', label: 'Every month', discountPercent: 0, weights: ['1 lb', '2 lb', '5 lb'] },
  { id: '5705793790', label: 'Every 2 weeks', discountPercent: 0, weights: ['1 lb', '2 lb', '5 lb'] },
];

/**
 * The plans a given weight can actually be bought on, best discount first.
 *
 * Always go through this rather than reading SELLING_PLANS directly. On
 * 2026-08-06 the Subscribe & Save group was narrowed to the 20 lb variants,
 * which silently left every smaller size with no subscribe option while the
 * product-level check still looked healthy. Verify coverage with
 * `node kch/scripts/shopify/subscription-coverage.mjs`.
 */
export function plansForWeight(weight: Weight): readonly SellingPlan[] {
  return SELLING_PLANS.filter((p) => p.weights.includes(weight)).sort(
    (a, b) => b.discountPercent - a.discountPercent
  );
}

/**
 * The headline discount, for copy that quotes it. Read this rather than
 * hardcoding a number in a sentence, so marketing copy cannot drift away from
 * what checkout actually charges.
 *
 * ZERO as of 2026-08-06 (Andrew): the everyday subscription is not discounted.
 * It is sold on convenience and steady support instead of a percentage.
 *
 * The 20 lb is the ONE exception and carries 5%, which is why this constant is
 * no longer the whole story. Do not use it to price anything — use
 * `priceFor(price, planId)`, which reads the rate off the plan. This is only
 * for copy that speaks about subscriptions in general, and while it is 0 that
 * copy must not quote a saving.
 *
 * This has to stay in step with the live Shopify selling plans, which are what
 * checkout actually applies. Verify with `node kch/scripts/shopify/selling-plans.mjs`.
 */
export const SUBSCRIPTION_DISCOUNT_PERCENT = 0;

/** Look a plan up by id. Returns null for one-time purchases. */
export function findPlan(planId: string | null | undefined): SellingPlan | null {
  if (!planId) return null;
  return SELLING_PLANS.find((p) => p.id === planId) ?? null;
}
