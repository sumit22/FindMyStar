/**
 * VisibilityCacheService - Pre-computes rise/set windows for bright objects.
 *
 * Runs once or twice a day (background task + foreground fallback) and stores
 * results in SQLite. The cached windows let the UI instantly partition objects
 * into "Visible Now" vs "Coming Up" without any Rust FFI calls at display time.
 */

import * as CatalogRepo from '../data/CatalogRepository';
import * as VisibilityService from './VisibilityService';
import * as LocationService from './LocationService';

const BRIGHT_MAGNITUDE = 4.0;
const MAX_BRIGHT_OBJECTS = 30;
const STALE_THRESHOLD_MS = 12 * 3600 * 1000; // 12 hours
const LOCATION_DRIFT_KM = 10;

/** Haversine distance in km between two lat/lon pairs. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check whether the cached visibility data is stale.
 * Stale if >12 hours old or observer moved >10 km.
 */
export async function isCacheStale(): Promise<boolean> {
  const meta = await CatalogRepo.getVisibilityCacheMeta();
  if (!meta) {
    return true;
  }
  if (Date.now() - meta.computedAtMs > STALE_THRESHOLD_MS) {
    return true;
  }
  const loc = LocationService.getLastKnown();
  if (loc && haversineKm(meta.lat, meta.lon, loc.lat, loc.lon) > LOCATION_DRIFT_KM) {
    return true;
  }
  return false;
}

/**
 * Recompute rise/set windows for all bright objects and persist to SQLite.
 * Uses Promise.all for concurrent Rust FFI calls (~200-300 ms for 30 objects).
 */
export async function refreshCache(): Promise<void> {
  const loc = LocationService.getLastKnown();
  if (!loc) {
    console.warn('[VisibilityCache] no cached location — skipping refresh');
    return;
  }

  const all = await CatalogRepo.getAllObjects();
  const bright = all.filter(o => o.magnitude <= BRIGHT_MAGNITUDE).slice(0, MAX_BRIGHT_OBJECTS);

  const now = Date.now();

  const results = await Promise.all(
    bright.map(async obj => {
      try {
        const rs = await VisibilityService.computeRiseSet(obj, loc.lat, loc.lon);
        return {
          objectId: obj.id,
          riseMs: rs.riseTime,
          setMs: rs.setTime,
          isCircumpolar: rs.isCircumpolar,
          isNeverVisible: rs.isNeverVisible,
          computedAtMs: now,
          lat: loc.lat,
          lon: loc.lon,
        } satisfies CatalogRepo.VisibilityWindow;
      } catch {
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is CatalogRepo.VisibilityWindow => r !== null);
  await CatalogRepo.upsertVisibilityWindows(valid);
}

/**
 * Ensure cache is fresh — refresh only if stale, otherwise no-op.
 * Safe to call on every screen focus.
 */
export async function ensureFresh(): Promise<void> {
  if (await isCacheStale()) {
    await refreshCache();
  }
}
