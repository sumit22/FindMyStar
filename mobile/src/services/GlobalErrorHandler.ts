/**
 * GlobalErrorHandler - Catches unhandled promise rejections and JS errors
 * that escape React's error boundary (e.g. async code, event handlers).
 *
 * Call install() once at module scope in App.tsx.
 *
 * Integration point for crash reporting: replace reportError() with
 * your Sentry/Crashlytics/Bugsnag call when a reporting SDK is added.
 */

declare const ErrorUtils: {
  getGlobalHandler: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
};

/**
 * Hook for crash reporting integration.
 * Replace this body with Sentry.captureException() / Crashlytics.recordError()
 * when a reporting SDK is added. Until then, logs to console.
 */
function reportError(error: unknown, context: string): void {
  if (__DEV__) {
    console.error(`[GlobalErrorHandler] ${context}:`, error);
  } else {
    console.warn(`[GlobalErrorHandler] ${context}:`, error);
  }
}

export function install(): void {
  // Unhandled promise rejections — log but don't crash
  // RN's globalThis doesn't declare onunhandledrejection, so use bracket access.
  const g = globalThis as Record<string, unknown>;
  g.onunhandledrejection = (event: { reason?: unknown }) => {
    reportError(event?.reason, 'Unhandled rejection');
  };

  // React Native's global JS error handler
  if (typeof ErrorUtils !== 'undefined') {
    const defaultHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      reportError(error, isFatal ? 'FATAL' : 'non-fatal');
      if (isFatal) {
        // Forward fatal errors to the default handler (crash report / red screen)
        defaultHandler(error, isFatal);
      }
      // Non-fatal errors are logged but swallowed
    });
  }
}
