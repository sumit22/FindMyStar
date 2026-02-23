# Error Handling Strategy

This document defines the error taxonomy, recovery strategies, user-facing messages,
and logging approach for the FindMyStar Application Layer. For service-level error
details, see [services.md](./services.md). For FFI error protocol, see
[api-contracts.md](./api-contracts.md).

---

## 1. Design Principles

1. **No silent failures**: Every error is logged and either recovered from automatically
   or surfaced to the user with a clear, non-technical message.
2. **Graceful degradation**: When a subsystem fails, the app continues operating with
   reduced functionality rather than crashing.
3. **Local-only logging**: Per [ADR-0003](../11-adr/0003-offline-first.md), no error
   data is transmitted off-device. All logs are stored in a rotating local file.
4. **Deterministic recovery**: Each error type has a predefined recovery path. Recovery
   actions are documented and testable.
5. **User empowerment**: Error messages tell the user what happened and what they can do,
   not what went wrong internally.

---

## 2. Error Taxonomy

Errors are classified into four categories based on their source layer:

```
┌─────────────────────────────────────────────────────────────┐
│  Error Categories                                           │
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐ │
│  │   Domain     │  │ Infrastructure│  │     Data         │ │
│  │   Errors     │  │    Errors     │  │    Errors        │ │
│  │              │  │               │  │                  │ │
│  │ Computation  │  │ Sensors       │  │ Database         │ │
│  │ Coordinates  │  │ GPS           │  │ Catalog          │ │
│  │ Ephemeris    │  │ Permissions   │  │ Migration        │ │
│  └──────────────┘  └───────────────┘  └──────────────────┘ │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    FFI Errors                        │   │
│  │  Rust panics, null pointers, memory, version mismatch│   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Error Categories Table

### 3.1 Domain Errors

Errors originating from astronomical computations in the Rust domain engine.

| Error Code               | Example Trigger                  | Severity | Recovery Strategy                          | User Message                                    |
|--------------------------|----------------------------------|----------|--------------------------------------------|------------------------------------------------|
| `COMPUTATION_OVERFLOW`   | Intermediate value exceeds f64   | High     | Return last valid result, log error        | "Calculation error. Please try a different object." |
| `INVALID_COORDINATES`    | RA outside 0-24, Dec outside +/-90 | Medium | Clamp to valid range, warn in log         | "Position data may be inaccurate."              |
| `EPHEMERIS_OUT_OF_RANGE` | Date too far from J2000 epoch    | Medium   | Clamp date to valid range (1900-2100)      | "Date is outside supported range. Using closest valid date." |
| `OBJECT_NOT_FOUND`       | Invalid catalog ID               | Low      | Return null, show empty state              | "Object not found. Try searching again."        |
| `OBJECT_BELOW_HORIZON`   | Target altitude < 0 degrees      | Info     | Show altitude, suggest optimal time        | "[Object] is below the horizon. Rises at [time]." |
| `INVALID_QUATERNION`     | Non-unit quaternion from sensor  | Medium   | Normalize quaternion, continue             | (Internal recovery, no user message)            |

### 3.2 Infrastructure Errors (Sensors)

Errors from device hardware and platform APIs.

| Error Code                | Example Trigger                   | Severity | Recovery Strategy                          | User Message                                    |
|---------------------------|-----------------------------------|----------|--------------------------------------------|------------------------------------------------|
| `GPS_UNAVAILABLE`         | Location services disabled        | High     | Use last known location, show warning      | "GPS unavailable. Using your last known location." |
| `GPS_TIMEOUT`             | No fix within 10 seconds          | Medium   | Fall back to last known location           | "GPS signal weak. Using approximate location."  |
| `GPS_PERMISSION_DENIED`   | User denied location permission   | Critical | Show permission rationale screen           | "Location access is needed to find celestial objects. Enable in Settings." |
| `SENSOR_UNAVAILABLE`      | Device lacks gyroscope            | High     | Fall back to accel+magnetometer only       | "Some sensors unavailable. Tracking accuracy may be reduced." |
| `MAGNETIC_INTERFERENCE`   | Strong magnetic field detected    | Medium   | Increase gyro weight, prompt calibration   | "Magnetic interference detected. Move away from electronics and calibrate." |
| `SENSOR_PERMISSION_DENIED`| User denied motion permission (iOS)| Critical| Show permission rationale screen           | "Motion sensor access is needed for tracking. Enable in Settings." |
| `CALIBRATION_REQUIRED`    | Magnetometer uncalibrated         | Low      | Show calibration prompt                    | "For best accuracy, calibrate by moving your phone in a figure-8." |

### 3.3 Data Errors

Errors from SQLite database operations.

| Error Code              | Example Trigger                    | Severity | Recovery Strategy                            | User Message                                    |
|-------------------------|------------------------------------|----------|----------------------------------------------|-------------------------------------------------|
| `DATABASE_CORRUPT`      | `PRAGMA integrity_check` fails     | Critical | Restore from bundled backup, restart app     | "Data repair in progress. Your alarms will be restored shortly." |
| `CATALOG_MISSING`       | Objects table empty or absent      | Critical | Restore from bundled backup                  | "Catalog data is being restored. Please wait."  |
| `MIGRATION_FAILED`      | Schema upgrade SQL error           | Critical | Roll back migration, use previous schema     | "App update encountered an issue. Please restart." |
| `DUPLICATE_ALARM`       | Alarm already exists for object    | Low      | Return existing alarm, show info toast       | "You already have an alarm set for [object]."   |
| `WRITE_FAILED`          | Disk full or SQLite locked         | High     | Retry once, then report to user              | "Unable to save. Please free up storage space." |
| `QUERY_TIMEOUT`         | SQLite query exceeds 5 seconds     | Medium   | Cancel query, return cached or empty result  | "Search is taking longer than expected. Try a shorter query." |

### 3.4 FFI Errors

Errors at the Rust-TypeScript boundary. These are the most dangerous because they
can indicate memory corruption or engine failure.

| Error Code                | Example Trigger                     | Severity | Recovery Strategy                          | User Message                                    |
|---------------------------|-------------------------------------|----------|--------------------------------------------|------------------------------------------------|
| `FFI_PANIC`              | Rust panic caught by `catch_unwind` | Critical | Log stack trace, return sentinel value     | "A calculation error occurred. Please restart the app." |
| `FFI_NULL_POINTER`       | Rust returned null unexpectedly     | Critical | Log error, skip operation                  | "A calculation error occurred. Please try again." |
| `FFI_MEMORY_LEAK`        | Caller forgot to call `free_*()`    | High     | Detected by memory profiling (dev only)    | (Internal, not shown to user)                   |
| `FFI_VERSION_MISMATCH`   | Engine major version != expected    | Critical | Block app startup, require update          | "App update required. Please update from the app store." |
| `FFI_SENTINEL_RETURNED`  | Function returned error sentinel    | Medium   | Read `get_last_error()`, handle by code    | Depends on underlying cause                     |

---

## 4. Error Type Definition

All errors in the Application Layer are represented as `AppError` objects:

```typescript
interface AppError {
  /** Unique identifier for this error instance */
  id: string;

  /** Machine-readable error code from the tables above */
  code: string;

  /** Error category for routing to the correct handler */
  category: 'domain' | 'sensor' | 'data' | 'ffi';

  /** Technical message for logging (not shown to users) */
  message: string;

  /** Human-friendly message safe to display in UI */
  userMessage: string;

  /** Whether the app can continue operating */
  recoverable: boolean;

  /** Unix milliseconds when the error occurred */
  timestamp: number;

  /** Optional: suggested user action */
  action?: ErrorAction;
}

type ErrorAction =
  | { type: 'retry'; label: string }
  | { type: 'navigate'; screen: string; label: string }
  | { type: 'settings'; label: string }
  | { type: 'dismiss'; label: string };
```

---

## 5. Recovery Strategies

### 5.1 Automatic Recovery (No User Intervention)

These recoveries happen transparently within the Application Layer:

| Scenario                         | Automatic Action                                  |
|----------------------------------|---------------------------------------------------|
| GPS timeout                      | Use `LocationService.getLastKnownLocation()`      |
| Invalid quaternion from sensor   | Normalize to unit quaternion, continue tracking    |
| Ephemeris date out of range      | Clamp to nearest valid date                        |
| Duplicate alarm creation         | Return existing alarm record                       |
| Cache miss                       | Fall through to SQLite query                       |
| Computation overflow in Rust     | Return last valid cached result                    |
| SQLite query timeout             | Return cached or empty result set                  |

### 5.2 User-Prompted Recovery

These errors require the user to take action:

| Scenario                     | UI Element                        | User Action                    |
|------------------------------|-----------------------------------|--------------------------------|
| GPS permission denied        | Full-screen permission rationale  | Tap "Open Settings"            |
| Motion permission denied     | Full-screen permission rationale  | Tap "Open Settings"            |
| Magnetometer interference    | Calibration modal with animation  | Perform figure-8 motion        |
| Database corruption          | Progress indicator                | Wait for restoration           |
| Engine version mismatch      | Blocking dialog                   | Update app from store          |
| Disk full                    | Toast notification                | Free storage space             |

### 5.3 Graceful Degradation Patterns

When a subsystem is unavailable, the app degrades gracefully rather than blocking
the user entirely:

| Failed Subsystem          | Degraded Behavior                                       |
|---------------------------|---------------------------------------------------------|
| GPS                       | Tracking works with last known location. Rise/set times |
|                           | use last known location. Warning badge on location icon.|
| Magnetometer              | Orientation derived from gyro+accel only. Accuracy      |
|                           | indicator shows reduced confidence. Compass heading     |
|                           | unavailable.                                            |
| Gyroscope                 | Orientation from accel+mag only (noisy, lower quality). |
|                           | Frame rate reduced to 15 FPS. User warned about reduced |
|                           | tracking quality.                                       |
| SQLite (read failure)     | Catalog search returns empty. Object info shows cached  |
|                           | data if available. Alarms use in-memory state.          |
| Rust FFI (panic)          | Tracking session stopped. Info screen shows "temporarily|
|                           | unavailable". Other features (alarms, search) continue. |

---

## 6. Error Propagation Flow

### 6.1 Service to Redux to UI

```
Service method throws or returns error
    │
    ▼
Thunk middleware catches error
    │
    ├─ Is it recoverable automatically?
    │   YES → Apply recovery, log warning, continue
    │   NO  → Continue to dispatch
    │
    ▼
dispatch(errorOccurred(appError))
    │
    ▼
Error reducer
    │
    ├─ Add to state.errors.activeErrors[]
    ├─ Check for duplicate (same code within last 30s) → deduplicate
    └─ Set auto-dismiss timer if recoverable
    │
    ▼
ErrorBanner / ErrorModal component re-renders
    │
    ├─ recoverable: true  → ErrorBanner (top-of-screen, auto-dismiss 10s)
    ├─ recoverable: false → ErrorModal (blocking, requires user action)
    └─ action provided    → Show action button (Retry / Settings / Dismiss)
```

### 6.2 Error Deduplication

To avoid flooding the user with repeated errors (e.g., GPS unavailable firing every
minute), the error reducer deduplicates:

```typescript
function errorReducer(state: ErrorState, action: ErrorAction): ErrorState {
  if (action.type === 'ERROR_OCCURRED') {
    const error = action.payload;
    const isDuplicate = state.activeErrors.some(
      e => e.code === error.code &&
           error.timestamp - e.timestamp < 30_000 // 30 seconds
    );
    if (isDuplicate) return state; // suppress duplicate

    return {
      ...state,
      activeErrors: [...state.activeErrors, error].slice(-10), // max 10 active
    };
  }
  // ... other cases
}
```

---

## 7. Logging Strategy

### 7.1 Log Levels

| Level   | Usage                                              | Persisted | Example                              |
|---------|----------------------------------------------------|-----------|--------------------------------------|
| `ERROR` | Unrecoverable or unexpected failures               | Yes       | "FFI panic in compute_tracking"      |
| `WARN`  | Recoverable issues, degraded functionality         | Yes       | "GPS timeout, using cached location" |
| `INFO`  | Significant state transitions                      | Yes       | "Tracking started for Polaris"       |
| `DEBUG` | Detailed operational data (dev builds only)        | No        | "Quaternion: w=0.98 x=0.01 ..."     |

### 7.2 Log Storage

- **Format**: JSON lines, one entry per line
- **Location**: App-private directory (`{appData}/logs/findmystar.log`)
- **Rotation**: Max 5MB per file, max 3 files (oldest deleted)
- **Retention**: 7 days, auto-pruned on app startup
- **Privacy**: No GPS coordinates in logs. No user identifiers. Object names only.

### 7.3 Log Entry Structure

```typescript
interface LogEntry {
  timestamp: string;   // ISO 8601
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  service: string;     // Service name (e.g., "ObjectTrackingService")
  code: string;        // Error code if applicable
  message: string;     // Human-readable description
  context?: Record<string, unknown>; // Additional structured data
}
```

### 7.4 What Is Never Logged

Per the privacy-first design:

- GPS coordinates (latitude, longitude)
- Device identifiers (IMEI, serial number, advertising ID)
- User preferences or settings
- Notification content
- Any data that could identify the user or their location

---

## 8. FFI Error Handling Deep Dive

The Rust-TypeScript boundary is the most fragile error surface. The protocol is:

### 8.1 Rust Side

Every exported function follows this pattern:

```rust
#[no_mangle]
pub extern "C" fn some_function(/* params */) -> ResultType {
    // 1. catch_unwind to prevent panic from crossing FFI boundary
    let result = std::panic::catch_unwind(|| {
        // 2. Validate all inputs
        validate_inputs(/* params */)?;

        // 3. Perform computation
        let value = compute(/* params */)?;

        Ok(value)
    });

    // 4. Convert Result to C-compatible return
    match result {
        Ok(Ok(value)) => value,
        Ok(Err(e)) => {
            // Domain error: set thread-local error message
            set_last_error(e.to_string());
            ResultType::sentinel()
        }
        Err(_) => {
            // Panic caught: set thread-local error message
            set_last_error("Internal panic".to_string());
            ResultType::sentinel()
        }
    }
}
```

### 8.2 TypeScript Side

The TypeScript wrapper detects sentinel values and retrieves the error:

```typescript
class AstronomyBridge {
  async raDecToAltaz(ra: number, dec: number, lat: number,
                      lon: number, timeMs: number): Promise<AltAz> {
    // 1. Call native module
    const raw = await NativeModules.AstronomyBridge.raDecToAltaz(
      ra, dec, lat, lon, timeMs
    );

    // 2. Check for sentinel
    if (this.isSentinel(raw)) {
      const errorMsg = await NativeModules.AstronomyBridge.getLastError();
      throw new FFIComputationError(
        errorMsg ?? 'Unknown computation error',
        'FFI_SENTINEL_RETURNED'
      );
    }

    // 3. Return typed result
    return raw as AltAz;
  }

  private isSentinel(result: any): boolean {
    return result.altitude === 0 && result.azimuth === 0 && !result.visible;
  }
}
```

---

## 9. Error Testing Requirements

Each error scenario must have a corresponding test:

| Test Category                | Approach                                        |
|------------------------------|-------------------------------------------------|
| Domain errors                | Unit test with invalid inputs to Rust functions  |
| Sensor errors                | Mock sensor APIs returning error states          |
| GPS errors                   | Mock LocationService with timeout/denial         |
| Database errors              | Test with corrupted SQLite file                  |
| FFI errors                   | Test with Rust function returning sentinel values|
| Recovery verification        | Assert app continues after each error type       |
| User message verification    | Snapshot test for all user-facing error messages |
| Deduplication                | Fire same error twice within 30s, assert one shown|

---

## 10. Cross-References

| Document                                                               | Relevance                         |
|------------------------------------------------------------------------|-----------------------------------|
| [Application Layer Overview](./overview.md)                            | Architecture context              |
| [Application Services](./services.md)                                  | Per-service error tables          |
| [API Contracts](./api-contracts.md)                                    | FFI error protocol and sentinels  |
| [Event Handling](./event-handling.md)                                  | Error event propagation flow      |
| [Architecture Overview](../03-architecture/architecture-overview.md)   | System error handling strategy    |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md)            | Privacy constraints on logging    |
| [Testing Strategy](../08-testing/overview.md)                          | Error scenario testing            |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
