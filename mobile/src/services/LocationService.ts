/**
 * LocationService - GPS location access with fallback to last-known position.
 *
 * Uses React Native's Geolocation API (provided by @react-native-community/geolocation
 * or equivalent). Wraps platform differences for Android/iOS.
 */

import { PermissionsAndroid, Platform } from 'react-native';

export interface Location {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

// React Native geolocation types (not available in DOM lib)
interface GeoPosition {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}

interface GeoError {
  code: number;
  message: string;
}

interface GeoOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  distanceFilter?: number;
  interval?: number;
}

// Declared globally by @react-native-community/geolocation at runtime
declare const navigator: {
  geolocation: {
    getCurrentPosition(
      success: (pos: GeoPosition) => void,
      error: (err: GeoError) => void,
      options?: GeoOptions,
    ): void;
    watchPosition(
      success: (pos: GeoPosition) => void,
      error: (err: GeoError) => void,
      options?: GeoOptions,
    ): number;
    clearWatch(id: number): void;
  };
};

let watchId: number | null = null;
let lastKnown: Location | null = null;
let onUpdate: ((loc: Location) => void) | null = null;

function toLocation(pos: GeoPosition): Location {
  return {
    lat: pos.coords.latitude,
    lon: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    timestamp: pos.timestamp,
  };
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  // iOS: permission requested automatically on first use
  return true;
}

export function getCurrentLocation(): Promise<Location> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = toLocation(pos);
        lastKnown = loc;
        resolve(loc);
      },
      (err) => {
        if (lastKnown) {
          resolve(lastKnown);
        } else {
          reject(new Error(`Location unavailable: ${err.message}`));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

export function startWatching(
  intervalMs: number,
  callback: (loc: Location) => void,
): void {
  stopWatching();
  onUpdate = callback;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const loc = toLocation(pos);
      lastKnown = loc;
      onUpdate?.(loc);
    },
    () => { /* silently use last known */ },
    {
      enableHighAccuracy: true,
      distanceFilter: 100, // meters
      interval: Math.max(intervalMs, 60000),
    },
  );
}

export function stopWatching(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  onUpdate = null;
}

export function getLastKnown(): Location | null {
  return lastKnown;
}

export function isStale(): boolean {
  if (!lastKnown) {return true;}
  return Date.now() - lastKnown.timestamp > 3600000; // 1 hour
}
