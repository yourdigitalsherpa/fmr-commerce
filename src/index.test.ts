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
  PICKUP,
  milesFromPickup,
  isNearPickup,
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
  // Andrew, 2026-08-06: subscriptions are no longer discounted. They keep the
  // cadence and lose the saving. The trap this guards is a struck-through
  // price sitting next to an identical number.
  it('keeps a subscription at full price with nothing to strike', () => {
    const v = priceFor('17.95', SELLING_PLANS[0].id);
    expect(v.display).toBe('17.95');
    expect(v.original).toBeNull();
    expect(v.discountPercent).toBe(0);
    expect(v.cadence).toBe('every month');
  });

  it('leaves a one-time purchase undiscounted and with nothing to strike', () => {
    const v = priceFor('17.95', null);
    expect(v.display).toBe('17.95');
    expect(v.original).toBeNull();
    expect(v.discountPercent).toBe(0);
    expect(v.cadence).toBeNull();
  });

  // The original bug: three live sites showed 17.95 while the button said
  // "save 5%". Whatever the headline number is, every plan must actually
  // deliver at least it, or copy over-promises what checkout charges.
  it('never quotes more than the advertised saving', () => {
    for (const p of SELLING_PLANS) {
      expect(p.discountPercent).toBeGreaterThanOrEqual(SUBSCRIPTION_DISCOUNT_PERCENT);
    }
  });

  // Still exercised so the rounding path does not rot while the rate is 0.
  it('rounds to cents when a discount is in force', () => {
    const v = priceFor('359.00', SELLING_PLANS[0].id);
    if (SUBSCRIPTION_DISCOUNT_PERCENT === 0) {
      expect(v.display).toBe('359.00');
      expect(v.original).toBeNull();
    } else {
      expect(v.display).toBe((359 * (1 - SUBSCRIPTION_DISCOUNT_PERCENT / 100)).toFixed(2));
      expect(v.original).toBe('359.00');
    }
  });

  // Daniel Crenshaw, 2026-08-03: "make the hard default NO MATTER WHAT VOLUME we
  // charge 17.95 always." Andrew confirmed and repriced on 2026-08-03.
  //
  // This is not cosmetic. scripts/shopify/registry.json in the kch repo turns the
  // $/lb ACTUALLY CHARGED into a commission rate, so a bag priced under $17.95/lb
  // silently pays its seller a lower rate. The 5 lb bag sat at $84.75 ($16.95/lb)
  // and the 20 lb at $319.00 ($15.95/lb), which is why order #1027 paid John B
  // 15.3% instead of 17% with nothing appearing to be wrong.
  //
  // If a size is ever meant to be cheaper per pound, that is a pricing decision
  // and it must change the commission ladder in the same breath. Do not simply
  // delete this test.
  it('prices EVERY bag size at exactly $17.95 per pound', () => {
    for (const origin of CATALOG) {
      for (const v of origin.variants) {
        const lbs = Number(/([\d.]+)\s*lb/i.exec(v.weight)![1]);
        expect(Number(v.price) / lbs).toBeCloseTo(17.95, 10);
      }
    }
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

describe('pickup', () => {
  it('is zero miles from the cafe itself', () => {
    expect(milesFromPickup(PICKUP.lat, PICKUP.lng)).toBeCloseTo(0, 5);
  });

  it('counts nearby Orange County as near', () => {
    expect(isNearPickup(33.6846, -117.8265)).toBe(true); // Irvine, ~6 mi
  });

  it('counts Los Angeles as near, since it is inside the 40 mile radius', () => {
    expect(isNearPickup(34.0522, -118.2437)).toBe(true); // ~34 mi
  });

  it('counts San Diego as too far', () => {
    expect(isNearPickup(32.7157, -117.1611)).toBe(false); // ~77.5 mi
  });

  // (0, 0) is what Number('') yields when Vercel omits a geo header: a real
  // coordinate (Null Island, Gulf of Guinea), not an obvious sentinel. This
  // asserts the documented contract (reject it explicitly), not a live save:
  // (0, 0) is ~7,800 miles from Costa Mesa, so the distance check alone would
  // already return false here even without the guard.
  it("a missing geo header, which arrives as Number('') === 0, is never near", () => {
    expect(isNearPickup(NaN, NaN)).toBe(false);
    expect(isNearPickup(Number(''), Number(''))).toBe(false);
  });

  // The boundary is `<=`, not `<` (see isNearPickup's `<= PICKUP.radiusMiles`).
  // Derive a coordinate almost exactly PICKUP.radiusMiles (40 mi) from the
  // cafe by moving due north only: with dLng = 0, the haversine formula
  // reduces to distance = R * dLat(radians) exactly (no lng cross-term to
  // account for), so 1 degree of latitude is ~69.0 mi and ~0.578-0.579
  // degrees north lands right on the 40 mi line. Measured with
  // milesFromPickup (not assumed) before picking which side of the line each
  // point actually falls on:
  //   +0.5780 deg -> 39.9364 mi (measured)  -> just inside
  //   +0.5790 deg -> 40.0055 mi (measured)  -> just outside
  const justInsideLat = PICKUP.lat + 0.578;
  const justOutsideLat = PICKUP.lat + 0.579;

  it('the boundary coordinates actually bracket the 40 mi radius', () => {
    expect(milesFromPickup(justInsideLat, PICKUP.lng)).toBeLessThanOrEqual(PICKUP.radiusMiles);
    expect(milesFromPickup(justOutsideLat, PICKUP.lng)).toBeGreaterThan(PICKUP.radiusMiles);
  });

  it('is near a point just inside the radius, and not near a point just outside it', () => {
    expect(isNearPickup(justInsideLat, PICKUP.lng)).toBe(true);
    expect(isNearPickup(justOutsideLat, PICKUP.lng)).toBe(false);
  });
});
