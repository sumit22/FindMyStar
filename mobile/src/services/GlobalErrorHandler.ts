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

interface ErrorContext {
  phase: string;
  fatal: boolean;
  build: 'dev' | 'prod';
}

/**
 * Hook for crash reporting integration.
 * Replace this body with Sentry.captureException() / Crashlytics.recordError()
 * when a reporting SDK is added. Until then, logs to console with structured context.
 */
function reportError(error: unknown, ctx: ErrorContext): void {
  if (__DEV__) {
    console.error(`[GlobalErrorHandler] ${ctx.phase}:`, error, ctx);
  } else {
    console.warn(`[GlobalErrorHandler] ${ctx.phase}:`, error, ctx);
  }
}

export function install(): void {
  // Unhandled promise rejections — log but don't crash
  // RN's globalThis doesn't declare onunhandledrejection, so use bracket access.
  const build = __DEV__ ? 'dev' : ('prod' as const);

  const g = globalThis as Record<string, unknown>;
  g.onunhandledrejection = (event: { reason?: unknown }) => {
    reportError(event?.reason, { phase: 'unhandledRejection', fatal: false, build });
  };

  // React Native's global JS error handler
  if (typeof ErrorUtils !== 'undefined') {
    const defaultHandler = ErrorUtils.getGlobalHandler();
    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      reportError(error, { phase: 'globalHandler', fatal: !!isFatal, build });
      if (isFatal) {
        // Forward fatal errors to the default handler (crash report / red screen)
        defaultHandler(error, isFatal);
      }
      // Non-fatal errors are logged but swallowed
    });
  }
}
