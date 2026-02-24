/**
 * ObjectTrackingService - Real-time celestial object tracking at 30+ FPS.
 *
 * Orchestrates sensor fusion + location + Rust FFI to produce a direction vector
 * from the device toward the target object. Detects target lock when angular
 * distance < 0.5 degrees for 2 seconds (hysteresis: unlock at > 1.0 degree).
 */

import * as Core from '../native/FindMyStarCore';
import * as SensorFusion from './SensorFusionService';
import * as LocationService from './LocationService';
import { CelestialObject } from '../data/CatalogRepository';

export interface TrackingFrame {
  altitude: number; // Target altitude (degrees)
  azimuth: number; // Target azimuth (degrees)
  direction: Core.Vector3; // Direction vector toward target
  angularDistance: number; // Degrees from device pointing to target
  isLocked: boolean; // True if locked on target
}

type TrackingCallback = (frame: TrackingFrame) => void;

const LOCK_THRESHOLD = 0.5; // degrees to enter lock
const UNLOCK_THRESHOLD = 1.0; // degrees to exit lock (hysteresis)
const LOCK_DURATION_MS = 2000; // sustained time to confirm lock

let active = false;
let targetObject: CelestialObject | null = null;
// Engine path (Sun/Moon/Planets): positions computed at runtime
let targetEngineParams: { objectType: number; objectId: number } | null = null;
// RA/Dec path (Stars/Deep-sky): fixed coordinates from database
let targetRaDec: { ra: number; dec: number } | null = null;
let cachedLat = 0;
let cachedLon = 0;
let locationUpdateTimer: ReturnType<typeof setInterval> | null = null;
let trackingFrameId: number | null = null;
let listeners: TrackingCallback[] = [];

// Lock state
let isLocked = false;
let belowThresholdSince = 0;

function setupTarget(obj: CelestialObject): void {
  if (obj.type === 'sun' || obj.type === 'moon' || obj.planetId != null) {
    // Engine path
    if (obj.type === 'sun') {
      targetEngineParams = { objectType: Core.ObjectType.Sun, objectId: 0 };
    } else if (obj.type === 'moon') {
      targetEngineParams = { objectType: Core.ObjectType.Moon, objectId: 0 };
    } else {
      targetEngineParams = { objectType: Core.ObjectType.Planet, objectId: obj.planetId! };
    }
    targetRaDec = null;
  } else {
    // RA/Dec path — coordinates from database
    targetEngineParams = null;
    targetRaDec = { ra: obj.ra!, dec: obj.dec! };
  }
}

async function updateLocation(): Promise<void> {
  try {
    const loc = await LocationService.getCurrentLocation();
    cachedLat = loc.lat;
    cachedLon = loc.lon;
  } catch {
    // Keep using cached location
  }
}

function updateLockState(angularDist: number, now: number): boolean {
  if (isLocked) {
    // Hysteresis: unlock only when above UNLOCK_THRESHOLD
    if (angularDist > UNLOCK_THRESHOLD) {
      isLocked = false;
      belowThresholdSince = 0;
    }
  } else {
    // Enter lock after sustained proximity
    if (angularDist < LOCK_THRESHOLD) {
      if (belowThresholdSince === 0) {
        belowThresholdSince = now;
      } else if (now - belowThresholdSince >= LOCK_DURATION_MS) {
        isLocked = true;
      }
    } else {
      belowThresholdSince = 0;
    }
  }
  return isLocked;
}

async function trackingLoop(): Promise<void> {
  if (!active || (!targetEngineParams && !targetRaDec)) {
    return;
  }

  const now = Date.now();

  try {
    const tracking = targetEngineParams
      ? await Core.computeTracking(
          targetEngineParams.objectType,
          targetEngineParams.objectId,
          cachedLat,
          cachedLon,
          now,
        )
      : await Core.computeTrackingRaDec(
          targetRaDec!.ra,
          targetRaDec!.dec,
          cachedLat,
          cachedLon,
          now,
        );

    // Get device orientation as a direction vector from the quaternion
    const q = SensorFusion.getOrientation();
    // Extract forward direction (0,0,1) rotated by quaternion: Q * [0,0,1] * Q*
    const deviceDir: Core.Vector3 = {
      x: 2 * (q.x * q.z + q.w * q.y),
      y: 2 * (q.y * q.z - q.w * q.x),
      z: 1 - 2 * (q.x * q.x + q.y * q.y),
    };

    // Compute angular distance between device pointing direction and target
    const angularDist = await Core.angularDistance(deviceDir, tracking.direction);

    const locked = updateLockState(angularDist, now);

    const frame: TrackingFrame = {
      altitude: tracking.altitude,
      azimuth: tracking.azimuth,
      direction: tracking.direction,
      angularDistance: angularDist,
      isLocked: locked,
    };

    for (const cb of listeners) {
      cb(frame);
    }
  } catch {
    // Skip frame on error, retry next frame
  }

  if (active) {
    trackingFrameId = requestAnimationFrame(() => {
      trackingLoop();
    });
  }
}

/**
 * Start tracking a celestial object. Gets initial location and begins the tracking loop.
 */
export async function initialize(obj: CelestialObject): Promise<void> {
  stop();

  targetObject = obj;
  setupTarget(obj);

  // Get initial location
  await updateLocation();

  // Start periodic location updates (every 60s)
  locationUpdateTimer = setInterval(updateLocation, 60000);

  // Start sensor fusion
  SensorFusion.start();

  // Reset lock state
  isLocked = false;
  belowThresholdSince = 0;

  active = true;
  trackingFrameId = requestAnimationFrame(() => {
    trackingLoop();
  });
}

/**
 * Stop the active tracking session.
 */
export function stop(): void {
  active = false;

  if (trackingFrameId !== null) {
    cancelAnimationFrame(trackingFrameId);
    trackingFrameId = null;
  }

  if (locationUpdateTimer !== null) {
    clearInterval(locationUpdateTimer);
    locationUpdateTimer = null;
  }

  SensorFusion.stop();
  targetObject = null;
  targetEngineParams = null;
  targetRaDec = null;
  isLocked = false;
  belowThresholdSince = 0;
}

/**
 * Register a callback for tracking frame updates (~30 FPS).
 * Returns an unsubscribe function.
 */
export function onTrackingUpdate(callback: TrackingCallback): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

export function isActive(): boolean {
  return active;
}

export function getTargetObject(): CelestialObject | null {
  return targetObject;
}

export function isTargetLocked(): boolean {
  return isLocked;
}
