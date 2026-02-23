/**
 * VisibilityService - Computes rise/set times, visibility, and optimal viewing windows.
 *
 * Delegates astronomical math to the Rust core engine via FFI bridge.
 * Handles circumpolar, never-visible, and regular rise/set cases.
 */

import * as Core from '../native/FindMyStarCore';
import { CelestialObject } from '../data/CatalogRepository';

export interface RiseSetInfo {
  riseTime: number | null; // Unix ms, null if circumpolar/never-visible
  setTime: number | null;
  isCircumpolar: boolean;
  isNeverVisible: boolean;
}

export interface OptimalViewingResult {
  windowStart: number; // Unix ms
  windowEnd: number;
  peakTime: number;
  peakAltitude: number;
  sunAltitudeAtPeak: number;
}

/** Map CelestialObject type/fields to FFI objectType + objectId */
function resolveObjectParams(obj: CelestialObject): { objectType: number; objectId: number } {
  if (obj.type === 'sun') {
    return { objectType: Core.ObjectType.Sun, objectId: 0 };
  }
  if (obj.type === 'moon') {
    return { objectType: Core.ObjectType.Moon, objectId: 0 };
  }
  if (obj.planetId != null) {
    return { objectType: Core.ObjectType.Planet, objectId: obj.planetId };
  }
  if (obj.hipId != null) {
    return { objectType: Core.ObjectType.Star, objectId: obj.hipId };
  }
  // Deep-sky objects with fixed RA/Dec: treat as star with id 0 (will use RA/Dec directly)
  return { objectType: Core.ObjectType.Star, objectId: 0 };
}

/**
 * Compute rise and set times for a celestial object from the given location.
 */
export async function computeRiseSet(
  obj: CelestialObject,
  lat: number,
  lon: number,
  startMs?: number,
): Promise<RiseSetInfo> {
  const { objectType, objectId } = resolveObjectParams(obj);
  const now = startMs ?? Date.now();

  const result = await Core.computeRiseSet(objectType, objectId, lat, lon, now);

  if (result.status === Core.RiseSetStatus.AlwaysVisible) {
    return { riseTime: null, setTime: null, isCircumpolar: true, isNeverVisible: false };
  }
  if (result.status === Core.RiseSetStatus.NeverVisible) {
    return { riseTime: null, setTime: null, isCircumpolar: false, isNeverVisible: true };
  }
  return {
    riseTime: result.riseMs,
    setTime: result.setMs,
    isCircumpolar: false,
    isNeverVisible: false,
  };
}

/**
 * Check if an object is currently above the horizon.
 */
export async function isCurrentlyVisible(
  obj: CelestialObject,
  lat: number,
  lon: number,
): Promise<boolean> {
  const { objectType, objectId } = resolveObjectParams(obj);
  const now = Date.now();

  const tracking = await Core.computeTracking(objectType, objectId, lat, lon, now);
  return tracking.altitude > 0;
}

/**
 * Get the current altitude and azimuth of an object.
 */
export async function getCurrentAltAz(
  obj: CelestialObject,
  lat: number,
  lon: number,
): Promise<Core.AltAz> {
  const { objectType, objectId } = resolveObjectParams(obj);
  return Core.computeTracking(objectType, objectId, lat, lon, Date.now());
}

/**
 * Get the current twilight state based on the sun's altitude.
 */
export async function getTwilightState(lat: number, lon: number): Promise<number> {
  const sunTracking = await Core.computeTracking(Core.ObjectType.Sun, 0, lat, lon, Date.now());
  return Core.classifyTwilight(sunTracking.altitude);
}

/**
 * Find the next time an object becomes visible (above minAltitude and sun below -6 deg),
 * scanning up to 48 hours ahead at 5-minute intervals.
 * Returns Unix ms or null if not found.
 */
export async function getNextVisibleTime(
  obj: CelestialObject,
  lat: number,
  lon: number,
  minAltitude = 10,
): Promise<number | null> {
  const { objectType, objectId } = resolveObjectParams(obj);
  const now = Date.now();
  const scanEnd = now + 48 * 3600 * 1000;
  const step = 5 * 60 * 1000; // 5 minutes

  for (let t = now; t < scanEnd; t += step) {
    const [objTracking, sunTracking] = await Promise.all([
      Core.computeTracking(objectType, objectId, lat, lon, t),
      Core.computeTracking(Core.ObjectType.Sun, 0, lat, lon, t),
    ]);

    if (objTracking.altitude >= minAltitude && sunTracking.altitude < -6) {
      return t;
    }
  }

  return null;
}

/**
 * Compute the optimal viewing window for an object within the next 48 hours.
 * Finds the time when the object is highest while the sun is below -6 degrees.
 */
export async function computeOptimalViewing(
  obj: CelestialObject,
  lat: number,
  lon: number,
  minAltitude = 10,
): Promise<OptimalViewingResult | null> {
  const { objectType, objectId } = resolveObjectParams(obj);
  const now = Date.now();
  const scanEnd = now + 48 * 3600 * 1000;
  const step = 5 * 60 * 1000;

  let bestTime = -1;
  let bestAlt = -90;
  let bestSunAlt = 0;
  let windowStart = -1;
  let windowEnd = -1;

  for (let t = now; t < scanEnd; t += step) {
    const [objTracking, sunTracking] = await Promise.all([
      Core.computeTracking(objectType, objectId, lat, lon, t),
      Core.computeTracking(Core.ObjectType.Sun, 0, lat, lon, t),
    ]);

    const visible = objTracking.altitude >= minAltitude && sunTracking.altitude < -6;

    if (visible) {
      if (windowStart < 0) {
        windowStart = t;
      }
      windowEnd = t;
      if (objTracking.altitude > bestAlt) {
        bestAlt = objTracking.altitude;
        bestTime = t;
        bestSunAlt = sunTracking.altitude;
      }
    }
  }

  if (bestTime < 0) {
    return null;
  }

  return {
    windowStart,
    windowEnd,
    peakTime: bestTime,
    peakAltitude: bestAlt,
    sunAltitudeAtPeak: bestSunAlt,
  };
}
