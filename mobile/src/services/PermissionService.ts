/**
 * PermissionService - Checks and requests all app permissions upfront.
 *
 * When any single permission is needed, checks ALL required permissions
 * and prompts for any that are missing to avoid repeated permission dialogs.
 *
 * Handles both Android (PermissionsAndroid) and iOS (Geolocation.requestAuthorization).
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

export interface PermissionStatus {
  location: boolean;
  notifications: boolean;
}

/**
 * Check all required permissions without requesting them.
 */
export async function checkAll(): Promise<PermissionStatus> {
  if (Platform.OS === 'android') {
    const location = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );

    let notifications = true;
    if (Platform.Version >= 33) {
      notifications = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
    }

    return { location, notifications };
  }

  // iOS: We can't synchronously check location authorization status without
  // a dedicated native module, so we verify by attempting a fast position read.
  const locationGranted = await new Promise<boolean>(resolve => {
    Geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: false, timeout: 3000, maximumAge: Infinity },
    );
  });

  return { location: locationGranted, notifications: true };
}

/**
 * Request all missing permissions at once.
 * Returns the updated status after requesting.
 */
export async function requestAll(): Promise<PermissionStatus> {
  if (Platform.OS === 'android') {
    const current = await checkAll();
    const toRequest: string[] = [];

    if (!current.location) {
      toRequest.push(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    }
    if (!current.notifications && Platform.Version >= 33) {
      toRequest.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    if (toRequest.length === 0) {
      return current;
    }

    const results = await PermissionsAndroid.requestMultiple(
      toRequest as Array<
        (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS]
      >,
    );

    return {
      location:
        current.location ||
        results[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
          PermissionsAndroid.RESULTS.GRANTED,
      notifications:
        current.notifications ||
        Platform.Version < 33 ||
        results[PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS] ===
          PermissionsAndroid.RESULTS.GRANTED,
    };
  }

  // iOS: Request "When In Use" location authorization.
  // This triggers the native permission dialog the first time; subsequent
  // calls are a no-op if permission was already granted or denied.
  const locationGranted = await new Promise<boolean>(resolve => {
    Geolocation.requestAuthorization(
      () => {
        // Authorization succeeded — verify by attempting a position read.
        Geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity },
        );
      },
      () => {
        console.warn('[PermissionService] iOS location authorization denied');
        resolve(false);
      },
    );
  });

  return { location: locationGranted, notifications: true };
}

/**
 * Ensure required permissions are granted.
 * Shows a dialog listing all missing permissions and directs user to settings if denied.
 * Returns true if all critical permissions (location) were granted.
 */
export async function ensurePermissions(): Promise<boolean> {
  const status = await requestAll();

  if (!status.location) {
    Alert.alert(
      'Permission Required',
      'Location access is needed to calculate when celestial objects are visible from your position. Please enable it in Settings.',
      [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
    return false;
  }

  if (!status.notifications) {
    // Non-blocking: location was granted, notifications are optional
    Alert.alert(
      'Notifications Disabled',
      'Enable notifications to receive alerts when celestial objects become visible.',
      [
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
        { text: 'Skip', style: 'cancel' },
      ],
    );
  }

  return true;
}
