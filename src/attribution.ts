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
 * Build the add-to-cart URL that creates a cart with attribution stamped on and
 * lands the buyer on the Shopify CART PAGE.
 *
 * It must land on /cart, not checkout. Two things the shopper needs live on the
 * cart page and nowhere else, both injected by the kch theme:
 *   - the second-pound nudge (assets/fmr-free-ship-nudge.js), and
 *   - the visible "✓ <Name> will be credited" rep field
 *     (snippets/fmr-referral-field.liquid).
 * Both mount onto `[data-fmr-referral]`, which only /cart and the cart drawer
 * render, and both load from theme.liquid, which checkout never loads. The store
 * is Shopify Basic, so the checkout page cannot be customised at all.
 *
 * This used to be `/cart/{id}:{qty}`, a cart permalink that redirects straight
 * to checkout, so partner traffic saw neither. Verified against the live store
 * 2026-07-29: `/cart/add` lands on /cart and carries both the attributes and
 * selling_plan; `?return_to=/cart` on the old permalink does NOT work, Shopify
 * forwards the param and ignores it.
 *
 * One partner, one rep (kch DECISIONS.md 1.3): white-label orders always credit
 * the label's registered ownerRep. Any `?rep=` in the URL is deliberately
 * ignored here.
 */
export function buyUrl(variantId: string, attribution: Attribution, options: BuyOptions = {}): string {
  const { qty = 1, sellingPlanId = null } = options;
  const params = new URLSearchParams();
  params.set('id', variantId);
  params.set('quantity', String(qty));
  if (sellingPlanId) params.set('selling_plan', sellingPlanId);
  params.set('attributes[partner]', attribution.partner);
  params.set('attributes[rep]', attribution.rep);
  return `${SHOP_DOMAIN}/cart/add?${params.toString()}`;
}
