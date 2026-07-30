/**
 * The cafe behind the whole family.
 *
 * Online buyers who choose free local pickup collect at the counter and get a
 * free shot of espresso, one per pickup order. The goal is walk-ins.
 *
 * These are facts about the Fourth Man store, not about any one partner, so they
 * belong here. The banner MARKUP does not: each label styles its own, because a
 * white label is the partner's own brand.
 *
 * Verified against the live store 2026-07-30: one location, local pickup
 * enabled, 24-hour ready time.
 *
 * radiusMiles and both helpers are consumed by the white-label sites, which get
 * real coordinates from Vercel. The Shopify theme has no lat/lng available on a
 * Basic plan and gates on browser timezone instead.
 */
export const PICKUP = {
  cafe: 'Kingdom Coffee Houses',
  address: '1941 Newport Blvd, Costa Mesa, CA 92627',
  lat: 33.6411,
  lng: -117.9187,
  radiusMiles: 40,
  ready: 'usually ready within 24 hours',
} as const;

/**
 * Great-circle distance in miles from the cafe.
 *
 * No non-finite guard here: NaN in, NaN out, by ordinary arithmetic
 * propagation. `isNearPickup` is the guarded entry point; call this directly
 * only with input you already trust.
 */
export function milesFromPickup(lat: number, lng: number): number {
  const R = 3958.8; // mean earth radius, miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat - PICKUP.lat);
  const dLng = toRad(lng - PICKUP.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(PICKUP.lat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Inside the promo radius.
 *
 * Non-finite input is never near. Beyond that, `(0, 0)` is rejected on
 * purpose: callers pass `Number(header)`, and a missing header yields exactly
 * `0`, which is a real coordinate (Null Island, in the Gulf of Guinea) rather
 * than an obvious sentinel. Today that guard is purely defensive (Null Island
 * is ~7,800 miles from Costa Mesa, so the distance check below would already
 * return false without it), but rejecting it explicitly states the intent
 * instead of relying on the accident of how far away it happens to be.
 * Without this line, moving the cafe or widening the radius could someday
 * make a missing header read as "near" by coincidence.
 */
export function isNearPickup(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false; // missing header, not Null Island
  return milesFromPickup(lat, lng) <= PICKUP.radiusMiles;
}
