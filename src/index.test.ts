import { describe, it, expect } from 'vitest';
import {
  CATALOG,
  ROAST_LEVELS,
  SELLING_PLANS,
  SUBSCRIPTION_DISCOUNT_PERCENT,
  buyUrl,
  priceFor,
  variantId,
  findPlan,
} from './index';

/**
 * These guard the things that actually broke in production. Each test maps to a
 * real incident, not a hypothetical.
 */

describe('catalogue', () => {
  it('has 32 unique variant ids (2 origins x 4 weights x 4 roasts)', () => {
    const ids = CATALOG.flatMap((o) => o.variants.flatMap((v) => Object.values(v.ids)));
    expect(ids).toHaveLength(32);
    expect(new Set(ids).size).toBe(32);
  });

  it('uses 14-digit numeric Shopify ids', () => {
    const ids = CATALOG.flatMap((o) => o.variants.flatMap((v) => Object.values(v.ids)));
    for (const id of ids) expect(id).toMatch(/^\d{14}$/);
  });

  it('covers every roast at every weight', () => {
    for (const o of CATALOG) {
      for (const v of o.variants) {
        for (const r of ROAST_LEVELS) {
          expect(v.ids[r], `${o.slug} ${v.weight} ${r}`).toBeTruthy();
        }
      }
    }
  });

  it('resolves a variant id by origin/weight/roast', () => {
    expect(variantId('zambia', '1 lb', 'Light')).toBe('48509234938110');
    expect(variantId('uganda', '20 lb', 'Espresso')).toBe('48586938482942');
  });
});

describe('pricing', () => {
  // The bug: three live sites showed 17.95 while the button said "save 5%".
  it('discounts the price when a plan is selected', () => {
    const v = priceFor('17.95', SELLING_PLANS[0].id);
    expect(v.display).toBe('17.05');
    expect(v.original).toBe('17.95');
    expect(v.discountPercent).toBe(5);
    expect(v.cadence).toBe('every month');
  });

  it('leaves a one-time purchase undiscounted and with nothing to strike', () => {
    const v = priceFor('17.95', null);
    expect(v.display).toBe('17.95');
    expect(v.original).toBeNull();
    expect(v.discountPercent).toBe(0);
    expect(v.cadence).toBeNull();
  });

  it('never quotes more than the advertised saving', () => {
    for (const p of SELLING_PLANS) {
      expect(p.discountPercent).toBeGreaterThanOrEqual(SUBSCRIPTION_DISCOUNT_PERCENT);
    }
  });

  it('rounds to cents', () => {
    expect(priceFor('319.00', SELLING_PLANS[0].id).display).toBe('303.05');
  });
});

describe('attribution', () => {
  const attr = { partner: 'SHPRD Coffee Roasters', rep: 'cameron' };

  it('stamps partner and rep on the add-to-cart url', () => {
    const url = new URL(buyUrl('48509234938110', attr));
    expect(url.searchParams.get('attributes[partner]')).toBe('SHPRD Coffee Roasters');
    expect(url.searchParams.get('attributes[rep]')).toBe('cameron');
    expect(url.searchParams.get('id')).toBe('48509234938110');
    expect(url.searchParams.get('quantity')).toBe('1');
  });

  // The incident: this was `/cart/{id}:{qty}`, a permalink that redirects
  // straight to checkout. The second-pound nudge and the visible rep-credit
  // field both live on the cart page only, so every white-label shopper saw
  // neither. Landing on /cart is the whole point — do not "simplify" this back
  // to a permalink. `?return_to=/cart` does not work; Shopify ignores it.
  it('lands on the cart page, NOT checkout', () => {
    expect(new URL(buyUrl('48509234938110', attr)).pathname).toBe('/cart/add');
  });

  it('honours qty', () => {
    expect(new URL(buyUrl('48509234938110', attr, { qty: 2 })).searchParams.get('quantity')).toBe('2');
  });

  it('adds selling_plan only when subscribing', () => {
    expect(buyUrl('48509234938110', attr)).not.toContain('selling_plan');
    expect(buyUrl('48509234938110', attr, { sellingPlanId: '5663424766' })).toContain(
      'selling_plan=5663424766',
    );
  });
});

describe('selling plans', () => {
  // The incident: a shrinking upstream list left sites indexing out of bounds,
  // and two deleted ids stayed linked and sent buyers to a dead selling_plan.
  it('is looked up by id, and an unknown id resolves to one-time rather than throwing', () => {
    expect(findPlan('5663424766')?.label).toBe('Every month');
    expect(findPlan('does-not-exist')).toBeNull();
    expect(findPlan(null)).toBeNull();
  });

  it('does not contain the two ids that were deleted upstream', () => {
    const dead = ['5663391998', '5663457534'];
    for (const id of dead) expect(SELLING_PLANS.some((p) => p.id === id)).toBe(false);
  });
});
