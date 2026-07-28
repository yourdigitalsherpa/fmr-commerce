import { SHOP_DOMAIN } from './store';

/**
 * Attribution and checkout.
 *
 * Every white-label sells Fourth Man's beans through Fourth Man's Shopify, so
 * the order has to carry WHO sold it. That rides the cart permalink as cart
 * attributes, survives checkout, lands on the order, and drives the payout
 * report.
 *
 * SILENT-FAILURE WARNING: `partner` must exactly match a key in
 * kch/scripts/shopify/registry.json -> labels. If it does not, orders still
 * succeed and the payout report attributes nothing. There is no error to see.
 */
export type Attribution = {
  /** Must byte-match a registry `labels` key, e.g. "SHPRD Coffee Roasters". */
  partner: string;
  /** The label's single owning rep slug, e.g. "cameron". */
  rep: string;
};

export type BuyOptions = {
  qty?: number;
  /** Shopify selling_plan id; omit or null for a one-time purchase. */
  sellingPlanId?: string | null;
};

/**
 * Build the cart permalink that creates a cart and sends the buyer straight to
 * checkout with attribution stamped on.
 *
 * One partner, one rep (kch DECISIONS.md 1.3): white-label orders always credit
 * the label's registered ownerRep. Any `?rep=` in the URL is deliberately
 * ignored here.
 */
export function buyUrl(variantId: string, attribution: Attribution, options: BuyOptions = {}): string {
  const { qty = 1, sellingPlanId = null } = options;
  const params = new URLSearchParams();
  if (sellingPlanId) params.set('selling_plan', sellingPlanId);
  params.set('attributes[partner]', attribution.partner);
  params.set('attributes[rep]', attribution.rep);
  return `${SHOP_DOMAIN}/cart/${variantId}:${qty}?${params.toString()}`;
}
