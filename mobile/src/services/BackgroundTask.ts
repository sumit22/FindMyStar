/**
 * BackgroundTask - Midnight recalculation of alarm rise/set times.
 *
 * Android: Uses react-native-background-fetch (wraps WorkManager).
 * iOS: Uses react-native-background-fetch (wraps BGTaskScheduler).
 *
 * Foreground fallback: AppState listener recalculates when app is foregrounded,
 * covering cases where the OS killed the background task.
 */

import { AppState, AppStateStatus } from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import * as AlarmScheduler from './AlarmScheduler';

let lastRecalcDate = '';
let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

/**
 * Get today's date string (YYYY-MM-DD) in local timezone.
 */
function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Run recalculation if it hasn't been done today.
 * Called from background task or app foreground.
 */
async function recalculateIfNeeded(): Promise<void> {
  const today = getTodayString();
  if (lastRecalcDate === today) {
    return;
  }

  try {
    await AlarmScheduler.recalculateAll();
    lastRecalcDate = today;
  } catch (e) {
    console.warn('[BackgroundTask] recalculation failed:', e);
  }
}

/**
 * Handle app coming to foreground - check if recalc is needed
 * (covers timezone changes, DST transitions, missed midnight tasks).
 */
function handleAppStateChange(nextState: AppStateStatus): void {
  if (nextState === 'active') {
    recalculateIfNeeded();
  }
}

/**
 * Initialize the background task system.
 * Call once at app startup.
 *
 * Registers a periodic background fetch (every ~15 minutes) that recalculates
 * alarm rise/set times once per day. Also sets up a foreground fallback via
 * AppState listener.
 */
export function initialize(): void {
  // Listen for app foregrounding as a fallback recalculation trigger.
  appStateListener = AppState.addEventListener('change', handleAppStateChange);

  // Register background fetch with the OS
  BackgroundFetch.configure(
    {
      minimumFetchInterval: 15, // minutes (OS may throttle further)
      stopOnTerminate: false,
      startOnBoot: true,
      enableHeadless: true,
    },
    async (taskId: string) => {
      try {
        await recalculateIfNeeded();
      } finally {
        BackgroundFetch.finish(taskId);
      }
    },
    (taskId: string) => {
      // OS demanded we stop — signal completion immediately
      BackgroundFetch.finish(taskId);
    },
  );

  // Run an initial check
  recalculateIfNeeded();
}

/**
 * Clean up listeners.
 */
export function teardown(): void {
  appStateListener?.remove();
  appStateListener = null;
}

/**
 * Force a recalculation (user-triggered pull-to-refresh).
 */
export async function forceRecalculate(): Promise<void> {
  lastRecalcDate = ''; // Reset so it runs
  await recalculateIfNeeded();
}
