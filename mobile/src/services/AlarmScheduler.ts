/**
 * AlarmScheduler - Manages visibility alarms for tracked celestial objects.
 *
 * Persists alarm data in SQLite via CatalogRepository, schedules OS-level
 * notifications, and performs daily recalculation of rise/set times.
 *
 * Note: react-native-push-notification is required for OS notifications.
 * This module defines the scheduling logic; notification bindings are
 * expected to be available at runtime.
 */

import * as CatalogRepo from '../data/CatalogRepository';
import * as VisibilityService from './VisibilityService';
import * as LocationService from './LocationService';

// Notification API - will be bound at initialization
let scheduleNotification: ((id: number, title: string, message: string, fireDate: Date) => void) | null = null;
let cancelNotification: ((id: number) => void) | null = null;

/**
 * Inject notification platform bindings.
 * Call this once at app startup with the push notification library functions.
 */
export function bindNotifications(
  schedule: (id: number, title: string, message: string, fireDate: Date) => void,
  cancel: (id: number) => void,
): void {
  scheduleNotification = schedule;
  cancelNotification = cancel;
}

/**
 * Create a visibility alarm for a celestial object.
 * Computes the next visible time and schedules an OS notification.
 */
export async function createAlarm(
  objectId: number,
  config?: Partial<CatalogRepo.AlarmConfig>,
): Promise<number> {
  const loc = await LocationService.getCurrentLocation();

  const fullConfig: CatalogRepo.AlarmConfig = {
    lat: loc.lat,
    lon: loc.lon,
    minAltitude: config?.minAltitude ?? 10,
    notifyBeforeMinutes: config?.notifyBeforeMinutes ?? 15,
    isRecurring: config?.isRecurring !== false,
  };

  const alarmId = await CatalogRepo.createTrackedObject(objectId, fullConfig);

  // Compute next visible time and update the alarm
  const obj = await CatalogRepo.getById(objectId);
  if (obj) {
    const riseSet = await VisibilityService.computeRiseSet(obj, loc.lat, loc.lon);
    await CatalogRepo.updateTrackedObject(alarmId, {
      nextRiseMs: riseSet.riseTime,
      nextSetMs: riseSet.setTime,
    });

    // Schedule OS notification
    if (riseSet.riseTime && scheduleNotification) {
      const notifyMs = riseSet.riseTime - (fullConfig.notifyBeforeMinutes ?? 15) * 60 * 1000;
      if (notifyMs > Date.now()) {
        scheduleNotification(
          alarmId,
          `${obj.commonName ?? obj.name} is rising soon`,
          `${obj.commonName ?? obj.name} will be visible in ${fullConfig.notifyBeforeMinutes ?? 15} minutes`,
          new Date(notifyMs),
        );
      }
    }
  }

  return alarmId;
}

/**
 * Delete an alarm and cancel its pending OS notification.
 */
export async function deleteAlarm(alarmId: number): Promise<void> {
  cancelNotification?.(alarmId);
  await CatalogRepo.deleteTrackedObject(alarmId);
}

/**
 * Toggle an alarm's enabled state.
 */
export async function toggleAlarm(alarmId: number, enabled: boolean): Promise<void> {
  await CatalogRepo.updateTrackedObject(alarmId, { enabled });
  if (!enabled) {
    cancelNotification?.(alarmId);
  }
}

/**
 * Get all tracked objects (alarms), sorted by next rise time.
 */
export async function listAlarms(): Promise<CatalogRepo.TrackedObject[]> {
  const alarms = await CatalogRepo.getTrackedObjects();
  return alarms.sort((a, b) => {
    if (a.nextRiseMs === null && b.nextRiseMs === null) {return 0;}
    if (a.nextRiseMs === null) {return 1;}
    if (b.nextRiseMs === null) {return -1;}
    return a.nextRiseMs - b.nextRiseMs;
  });
}

/**
 * Recalculate rise/set times for ALL active alarms.
 * Called daily at midnight by the background task.
 * Must complete within 2 seconds for background task budget.
 */
export async function recalculateAll(): Promise<void> {
  const alarms = await CatalogRepo.getTrackedObjects();

  for (const alarm of alarms) {
    if (!alarm.enabled) {continue;}

    try {
      const obj = await CatalogRepo.getById(alarm.objectId);
      if (!obj) {continue;}

      const riseSet = await VisibilityService.computeRiseSet(
        obj, alarm.lat, alarm.lon,
      );

      await CatalogRepo.updateTrackedObject(alarm.id, {
        nextRiseMs: riseSet.riseTime,
        nextSetMs: riseSet.setTime,
      });

      // Cancel old notification and schedule new one
      cancelNotification?.(alarm.id);

      if (riseSet.riseTime && scheduleNotification) {
        const notifyMs = riseSet.riseTime - alarm.notifyBeforeMinutes * 60 * 1000;
        if (notifyMs > Date.now()) {
          scheduleNotification(
            alarm.id,
            `${obj.commonName ?? obj.name} is rising soon`,
            `${obj.commonName ?? obj.name} will be visible in ${alarm.notifyBeforeMinutes} minutes`,
            new Date(notifyMs),
          );
        }
      }
    } catch {
      // Skip failed alarms, retry at next recalculation cycle
    }
  }
}

/**
 * Get the alarm that will trigger next, or null if none.
 */
export async function getNextAlarm(): Promise<CatalogRepo.TrackedObject | null> {
  const alarms = await listAlarms();
  const now = Date.now();
  return alarms.find(a => a.enabled && a.nextRiseMs !== null && a.nextRiseMs > now) ?? null;
}
