/**
 * PermissionService - Checks and requests all app permissions upfront.
 *
 * When any single permission is needed, checks ALL required permissions
 * and prompts for any that are missing to avoid repeated permission dialogs.
 */

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

export interface PermissionStatus {
  location: boolean;
  notifications: boolean;
}

/**
 * Check all required permissions without requesting them.
 */
export async function checkAll(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return { location: true, notifications: true };
  }

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

/**
 * Request all missing permissions at once.
 * Returns the updated status after requesting.
 */
export async function requestAll(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return { location: true, notifications: true };
  }

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
