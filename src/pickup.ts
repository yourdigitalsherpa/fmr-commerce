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

/** Great-circle distance in miles from the cafe. */
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
 * Non-finite input is never near. Callers pass Number(header), and a missing
 * header yields 0, which is a real coordinate off the coast of Africa. Guard
 * here so no caller has to remember.
 */
export function isNearPickup(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false; // missing headers, not Null Island
  return milesFromPickup(lat, lng) <= PICKUP.radiusMiles;
}
