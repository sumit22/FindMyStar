import { NativeModules } from 'react-native';

/**
 * TypeScript FFI wrapper for the Rust core engine.
 * Maps to the extern "C" functions in core/src/ffi/exports.rs.
 */

interface NativeCoreModule {
  computePosition(
    objectType: number,
    objectId: number,
    jd: number,
  ): Promise<{ ra: number; dec: number }>;
  raDecToAltAz(
    ra: number,
    dec: number,
    lat: number,
    lon: number,
    unixMs: number,
  ): Promise<{ altitude: number; azimuth: number }>;
  computeTracking(
    objectType: number,
    objectId: number,
    lat: number,
    lon: number,
    unixMs: number,
  ): Promise<{ altitude: number; azimuth: number; dirX: number; dirY: number; dirZ: number }>;
  computeRiseSet(
    objectType: number,
    objectId: number,
    lat: number,
    lon: number,
    startUnixMs: number,
  ): Promise<{ status: number; riseMs: number; setMs: number }>;
  computeTrackingRaDec(
    ra: number,
    dec: number,
    lat: number,
    lon: number,
    unixMs: number,
  ): Promise<{ altitude: number; azimuth: number; dirX: number; dirY: number; dirZ: number }>;
  computeRiseSetRaDec(
    ra: number,
    dec: number,
    lat: number,
    lon: number,
    startUnixMs: number,
  ): Promise<{ status: number; riseMs: number; setMs: number }>;
  altAzToVector3(altitude: number, azimuth: number): Promise<{ x: number; y: number; z: number }>;
  angularDistance(
    x1: number,
    y1: number,
    z1: number,
    x2: number,
    y2: number,
    z2: number,
  ): Promise<number>;
  classifyTwilight(sunAltitude: number): Promise<number>;
  createEntitlement(planType: number, validUntilMs: number, deviceId: string): Promise<string>;
  checkEntitlement(payloadBase64: string, deviceId: string, nowMs: number): Promise<number>;
  coreVersion(): Promise<string>;
}

const NativeCore: NativeCoreModule = NativeModules.FindMyStarCore;

if (!NativeCore) {
  throw new Error(
    'FindMyStarCore native module is not available. ' +
      'Ensure libfindmystar_core.so is included in jniLibs and the app was rebuilt.',
  );
}

// Object type constants matching core ObjectType enum
export const ObjectType = {
  Sun: 0,
  Moon: 1,
  Planet: 2,
  Star: 3,
} as const;

// Twilight state constants
export const TwilightState = {
  Day: 0,
  Civil: 1,
  Nautical: 2,
  Astronomical: 3,
  Night: 4,
} as const;

// Rise/set result status
export const RiseSetStatus = {
  RisesAndSets: 0,
  AlwaysVisible: 1,
  NeverVisible: 2,
} as const;

// Entitlement plan types
export const PlanType = {
  Free: 0,
  Lifetime: 1,
  Subscription: 2,
} as const;

// Entitlement check result codes
export const EntitlementStatus = {
  ProActive: 1,
  NotPro: 0,
  InvalidSignature: -1,
  InvalidInput: -2,
} as const;

export interface Position {
  ra: number;
  dec: number;
}

export interface AltAz {
  altitude: number;
  azimuth: number;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface TrackingResult extends AltAz {
  direction: Vector3;
}

export interface RiseSetResult {
  status: number;
  riseMs: number | null;
  setMs: number | null;
}

export async function computePosition(
  objectType: number,
  objectId: number,
  jd: number,
): Promise<Position> {
  return NativeCore.computePosition(objectType, objectId, jd);
}

export async function raDecToAltAz(
  ra: number,
  dec: number,
  lat: number,
  lon: number,
  unixMs: number,
): Promise<AltAz> {
  return NativeCore.raDecToAltAz(ra, dec, lat, lon, unixMs);
}

export async function computeTracking(
  objectType: number,
  objectId: number,
  lat: number,
  lon: number,
  unixMs: number,
): Promise<TrackingResult> {
  const result = await NativeCore.computeTracking(objectType, objectId, lat, lon, unixMs);
  return {
    altitude: result.altitude,
    azimuth: result.azimuth,
    direction: { x: result.dirX, y: result.dirY, z: result.dirZ },
  };
}

export async function computeRiseSet(
  objectType: number,
  objectId: number,
  lat: number,
  lon: number,
  startUnixMs: number,
): Promise<RiseSetResult> {
  const result = await NativeCore.computeRiseSet(objectType, objectId, lat, lon, startUnixMs);
  return {
    status: result.status,
    riseMs: result.status === RiseSetStatus.RisesAndSets ? result.riseMs : null,
    setMs: result.status === RiseSetStatus.RisesAndSets ? result.setMs : null,
  };
}

export async function computeTrackingRaDec(
  ra: number,
  dec: number,
  lat: number,
  lon: number,
  unixMs: number,
): Promise<TrackingResult> {
  const result = await NativeCore.computeTrackingRaDec(ra, dec, lat, lon, unixMs);
  return {
    altitude: result.altitude,
    azimuth: result.azimuth,
    direction: { x: result.dirX, y: result.dirY, z: result.dirZ },
  };
}

export async function computeRiseSetRaDec(
  ra: number,
  dec: number,
  lat: number,
  lon: number,
  startUnixMs: number,
): Promise<RiseSetResult> {
  const result = await NativeCore.computeRiseSetRaDec(ra, dec, lat, lon, startUnixMs);
  return {
    status: result.status,
    riseMs: result.status === RiseSetStatus.RisesAndSets ? result.riseMs : null,
    setMs: result.status === RiseSetStatus.RisesAndSets ? result.setMs : null,
  };
}

export async function altAzToVector3(altitude: number, azimuth: number): Promise<Vector3> {
  return NativeCore.altAzToVector3(altitude, azimuth);
}

export async function angularDistance(v1: Vector3, v2: Vector3): Promise<number> {
  return NativeCore.angularDistance(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
}

export async function classifyTwilight(sunAltitude: number): Promise<number> {
  return NativeCore.classifyTwilight(sunAltitude);
}

export async function createEntitlement(
  planType: number,
  validUntilMs: number,
  deviceId: string,
): Promise<string> {
  return NativeCore.createEntitlement(planType, validUntilMs, deviceId);
}

export async function checkEntitlement(
  payloadBase64: string,
  deviceId: string,
  nowMs: number,
): Promise<number> {
  return NativeCore.checkEntitlement(payloadBase64, deviceId, nowMs);
}

export async function coreVersion(): Promise<string> {
  return NativeCore.coreVersion();
}
