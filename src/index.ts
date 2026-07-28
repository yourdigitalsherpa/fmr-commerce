/**
 * @fmr/commerce
 *
 * The shared commerce layer for every Fourth Man Roasters white-label site.
 *
 * WHAT BELONGS HERE: anything that is true of the Fourth Man store rather than
 * of one partner. Store domain, selling plans, the 32-variant catalogue,
 * prices, attribution mechanics, pricing math.
 *
 * WHAT DOES NOT: partner name, rep, palette, copy, photography, page layout.
 * Those are each label's own brand and must stay in its repo.
 *
 * WHY IT EXISTS: the sites were built by forking each other. Improvements only
 * ever travelled forward to the next fork, so by 2026-07-27 three live sites
 * were quoting full price on a discounted subscription and the newest site had
 * shipped a buy box three generations old. Fix it here, once.
 */

export {
  SHOP_DOMAIN,
  SELLING_PLANS,
  SUBSCRIPTION_DISCOUNT_PERCENT,
  findPlan,
  type SellingPlan,
} from './store';

export {
  CATALOG,
  ROAST_LEVELS,
  ROAST_NOTES,
  WEIGHTS,
  getOrigin,
  variantId,
  type CatalogOrigin,
  type CatalogVariant,
  type OriginSlug,
  type Roast,
  type Weight,
} from './catalog';

export { buyUrl, type Attribution, type BuyOptions } from './attribution';

export { priceFor, formatPrice, type PriceView } from './pricing';
