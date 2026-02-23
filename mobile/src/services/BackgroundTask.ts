/**
 * BackgroundTask - Midnight recalculation of alarm rise/set times.
 *
 * Android: Uses react-native-background-fetch (wraps WorkManager).
 * iOS: Uses react-native-background-fetch (wraps BGTaskScheduler).
 *
 * This module provides a platform-agnostic interface. The actual background
 * task registration requires react-native-background-fetch to be installed.
 */

import { AppState, AppStateStatus } from 'react-native';
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
  } catch {
    // Will retry on next trigger
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
 * For full background scheduling, install react-native-background-fetch and
 * register the task in native code. This function sets up the JS-side handler
 * and foreground fallback.
 */
export function initialize(): void {
  // Listen for app foregrounding as a fallback recalculation trigger.
  // This handles cases where the background task didn't fire (device was off,
  // task was killed by OS, timezone changed, etc.)
  appStateListener = AppState.addEventListener('change', handleAppStateChange);

  // Run an initial check
  recalculateIfNeeded();
}

/**
 * Background fetch handler - called by the OS background task system.
 * Register this with react-native-background-fetch:
 *
 *   BackgroundFetch.configure({ minimumFetchInterval: 15 }, onBackgroundFetch, onTimeout);
 */
export async function onBackgroundFetch(_taskId: string): Promise<void> {
  await recalculateIfNeeded();
  // Caller should signal completion to the background fetch library
}

/**
 * Background fetch timeout handler.
 */
export function onBackgroundTimeout(_taskId: string): void {
  // OS demanded we stop - nothing to clean up since recalculateAll is async
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
