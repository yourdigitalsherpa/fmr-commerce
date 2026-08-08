import { describe, it, expect } from 'vitest';
import {
  CATALOG,
  GRINDS,
  ROAST_LEVELS,
  SELLING_PLANS,
  plansForWeight,
  WEIGHTS,
  WEIGHT_FORMATS,
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

describe('weight formats', () => {
  // Sites called the 20 lb a "case", which reads like one 20 lb container.
  // Andrew, 2026-08-06: "It exists but we ship them as four 5lb bags."
  it('describes the 20 lb as four 5 lb bags', () => {
    expect(WEIGHT_FORMATS['20 lb']).toBe('Four 5 lb bags');
  });

  it('covers every weight, so a new size cannot ship undescribed', () => {
    for (const w of WEIGHTS) {
      expect(WEIGHT_FORMATS[w], `no format for ${w}`).toBeTruthy();
    }
  });
});

describe('selling plan coverage', () => {
  // 2026-08-06: the Subscribe & Save group was narrowed to the 20 lb variants,
  // which left 1, 2 and 5 lb with NO subscribe control at all. The
  // product-level check still looked healthy, so nothing caught it. This is
  // the test that would have.
  it('offers a plan for every weight we sell', () => {
    for (const w of WEIGHTS) {
      expect(plansForWeight(w).length, `${w} has no selling plan`).toBeGreaterThan(0);
    }
  });

  // The 20 lb is the only size that carries a discount. It is ALSO attached to
  // the 0% group on Shopify, so the risk is offering a 20 lb buyer the plan
  // that saves them nothing.
  it('only ever offers the discounted plans on 20 lb', () => {
    for (const p of plansForWeight('20 lb')) expect(p.discountPercent).toBe(5);
  });

  it('offers no discount on the smaller sizes', () => {
    for (const w of ['1 lb', '2 lb', '5 lb'] as const) {
      for (const p of plansForWeight(w)) expect(p.discountPercent).toBe(0);
    }
  });

  it('gives every weight both cadences', () => {
    for (const w of WEIGHTS) {
      const labels = plansForWeight(w).map((p) => p.label).sort();
      expect(labels, `${w}`).toEqual(['Every 2 weeks', 'Every month']);
    }
  });

  it('prices a 20 lb subscription 5% down, with something to strike', () => {
    const plan = plansForWeight('20 lb')[0];
    const v = priceFor('359.00', plan.id);
    expect(v.display).toBe('341.05');
    expect(v.original).toBe('359.00');
    expect(v.discountPercent).toBe(5);
  });
});

describe('pricing', () => {
  // Andrew, 2026-08-06: subscriptions are no longer discounted. They keep the
  // cadence and lose the saving. The trap this guards is a struck-through
  // price sitting next to an identical number.
  it('keeps a subscription at full price with nothing to strike', () => {
    // Keyed by weight, not SELLING_PLANS[0]: the first entry is now a 20 lb
    // plan that DOES discount, and indexing into this array is exactly what
    // store.ts warns against.
    const v = priceFor('17.95', plansForWeight('1 lb')[0].id);
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

  it('rounds to cents', () => {
    const v = priceFor('359.00', plansForWeight('20 lb')[0].id);
    expect(v.display).toBe('341.05');
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


// ---------------------------------------------------------------- grind
describe('grind', () => {
  it('offers exactly whole and ground', () => {
    expect([...GRINDS]).toEqual(['Whole', 'Ground']);
  });

  it('defaults to whole, so three-argument callers are unaffected', () => {
    for (const o of CATALOG) {
      for (const v of o.variants) {
        for (const r of ROAST_LEVELS) {
          expect(variantId(o.slug, v.weight, r)).toBe(v.ids[r]);
          expect(variantId(o.slug, v.weight, r, 'Whole')).toBe(v.ids[r]);
        }
      }
    }
  });

  it('resolves ground to a different variant in every cell', () => {
    for (const o of CATALOG) {
      for (const v of o.variants) {
        for (const r of ROAST_LEVELS) {
          const ground = variantId(o.slug, v.weight, r, 'Ground');
          expect(ground).toBe(v.groundIds[r]);
          expect(ground).not.toBe(v.ids[r]);
        }
      }
    }
  });

  it('has 64 distinct variant ids across the catalogue', () => {
    const seen = new Set<string>();
    for (const o of CATALOG) {
      for (const v of o.variants) {
        for (const r of ROAST_LEVELS) {
          seen.add(v.ids[r]);
          seen.add(v.groundIds[r]);
        }
      }
    }
    expect(seen.size).toBe(64);
  });

  it('every id is a 14-digit Shopify variant id', () => {
    for (const o of CATALOG) {
      for (const v of o.variants) {
        for (const r of ROAST_LEVELS) {
          expect(v.ids[r]).toMatch(/^\d{14}$/);
          expect(v.groundIds[r]).toMatch(/^\d{14}$/);
        }
      }
    }
  });

  it('grind does not change the price', () => {
    // Shopify charges the same for both. Any site that prices off the weight
    // alone stays correct.
    for (const o of CATALOG) {
      for (const v of o.variants) expect(v.price).toMatch(/^\d+\.\d{2}$/);
    }
  });
});
