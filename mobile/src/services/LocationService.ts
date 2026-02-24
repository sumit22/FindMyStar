/**
 * LocationService - GPS location access with fallback to last-known position.
 *
 * Uses @react-native-community/geolocation for platform GPS access.
 * Wraps platform differences for Android/iOS.
 */

import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface Location {
  lat: number;
  lon: number;
  accuracy: number;
  timestamp: number;
}

let watchId: number | null = null;
let lastKnown: Location | null = null;
let onUpdate: ((loc: Location) => void) | null = null;

function toLocation(pos: {
  coords: { latitude: number; longitude: number; accuracy: number };
  timestamp: number;
}): Location {
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
    // Try high accuracy (GPS) first, fall back to network (cell/WiFi)
    Geolocation.getCurrentPosition(
      pos => {
        const loc = toLocation(pos);
        lastKnown = loc;
        resolve(loc);
      },
      () => {
        // GPS timed out — retry with network location (works indoors)
        Geolocation.getCurrentPosition(
          pos => {
            const loc = toLocation(pos);
            lastKnown = loc;
            resolve(loc);
          },
          err => {
            if (lastKnown) {
              resolve(lastKnown);
            } else {
              reject(new Error(`Location unavailable: ${err.message}`));
            }
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  });
}

export function startWatching(intervalMs: number, callback: (loc: Location) => void): void {
  stopWatching();
  onUpdate = callback;
  watchId = Geolocation.watchPosition(
    pos => {
      const loc = toLocation(pos);
      lastKnown = loc;
      onUpdate?.(loc);
    },
    () => {
      /* silently use last known */
    },
    {
      enableHighAccuracy: true,
      distanceFilter: 100, // meters
      interval: Math.max(intervalMs, 60000),
    },
  );
}

export function stopWatching(): void {
  if (watchId !== null) {
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
  onUpdate = null;
}

export function getLastKnown(): Location | null {
  return lastKnown;
}

export function isStale(): boolean {
  if (!lastKnown) {
    return true;
  }
  return Date.now() - lastKnown.timestamp > 3600000; // 1 hour
}
