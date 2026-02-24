/**
 * ObjectTrackingService - Real-time celestial object tracking at 30+ FPS.
 *
 * Orchestrates sensor fusion + location + Rust FFI to produce a direction vector
 * from the device toward the target object. Detects target lock when angular
 * distance < 0.5 degrees for 2 seconds (hysteresis: unlock at > 1.0 degree).
 */

import * as Core from '../native/FindMyStarCore';
import * as SensorFusion from './SensorFusionService';
import * as SensorBindings from './SensorBindings';
import * as LocationService from './LocationService';
import { CelestialObject } from '../data/CatalogRepository';

export interface TrackingFrame {
  altitude: number; // Target altitude (degrees)
  azimuth: number; // Target azimuth (degrees)
  direction: Core.Vector3; // Direction vector toward target
  angularDistance: number; // Degrees from device pointing to target
  isLocked: boolean; // True if locked on target
  deviceHeading: number; // Device compass heading (degrees, 0=N, 90=E)
  deviceElevation: number; // Device tilt above horizon (degrees, 0=level, 90=straight up)
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

// Debug frame counter (exposed via debug overlay)
let debugFrameCount = 0;

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

    // Get device orientation from sensor fusion quaternion.
    const q = SensorFusion.getOrientation();

    // Extract device heading from quaternion.
    // The ZYX yaw gives the heading of the phone's X axis (right side).
    // When held upright, the forward direction (-Z) is 90° CCW from X,
    // so we convert: heading = 270 - yawDeg (mod 360).
    const yawRad = Math.atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y * q.y + q.z * q.z));
    const deviceHeading = (270 - (yawRad * 180) / Math.PI + 360) % 360;

    // Device elevation: how high above the horizon the back camera points.
    // The -Z body axis vertical component (Up in sensor ENU frame) gives elevation.
    const upComponent = 2 * (q.x * q.x + q.y * q.y) - 1;
    const clampedUp = Math.max(-1, Math.min(1, upComponent));
    const deviceElevation = Math.asin(clampedUp) * (180 / Math.PI);

    // Build device direction in EUN frame (East-Up-North) to match the Rust core.
    // Uses the same alt/az → vector3 conversion as the core engine, ensuring
    // both deviceDir and tracking.direction are in the same coordinate frame.
    const headRad = (deviceHeading * Math.PI) / 180;
    const elevRad = (deviceElevation * Math.PI) / 180;
    const deviceDir: Core.Vector3 = {
      x: Math.cos(elevRad) * Math.sin(headRad), // East
      y: Math.sin(elevRad), // Up
      z: Math.cos(elevRad) * Math.cos(headRad), // North
    };

    // Compute angular distance — both vectors now in EUN frame
    const angularDist = await Core.angularDistance(deviceDir, tracking.direction);

    const locked = updateLockState(angularDist, now);

    const frame: TrackingFrame = {
      altitude: tracking.altitude,
      azimuth: tracking.azimuth,
      direction: tracking.direction,
      angularDistance: angularDist,
      isLocked: locked,
      deviceHeading,
      deviceElevation,
    };

    debugFrameCount++;

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

  // Start hardware sensor subscriptions then fusion filter
  SensorBindings.start();
  SensorFusion.start();

  // Reset lock state
  isLocked = false;
  belowThresholdSince = 0;
  debugFrameCount = 0;

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
  SensorBindings.stop();
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

export function getDebugInfo(): {
  frameCount: number;
  cachedLat: number;
  cachedLon: number;
  engineParams: typeof targetEngineParams;
  raDec: typeof targetRaDec;
} {
  return {
    frameCount: debugFrameCount,
    cachedLat,
    cachedLon,
    engineParams: targetEngineParams,
    raDec: targetRaDec,
  };
}
