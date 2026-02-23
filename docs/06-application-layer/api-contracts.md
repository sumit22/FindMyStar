# API Contracts: Rust <-> TypeScript Bridge

This document specifies the Foreign Function Interface (FFI) contract between the Rust
domain engine and the TypeScript application layer. All mobile development depends on
these contracts being stable. For service-level usage, see [services.md](./services.md).

---

## 1. Architectural Overview

The Rust domain engine compiles to a platform-native shared library:

```
┌───────────────────────────────────────────────┐
│  TypeScript Application Layer                 │
│  (React Native)                               │
│                                               │
│   ObjectTrackingService                       │
│   VisibilityService                           │
│           │                                   │
│           ▼                                   │
│   ┌───────────────────┐                       │
│   │ TypeScript Wrapper │  Type-safe API       │
│   │ (AstronomyBridge)  │  Handles marshaling  │
│   └────────┬──────────┘                       │
├────────────┼──────────────────────────────────┤
│            │  FFI Boundary                    │
│            ▼                                  │
│   ┌────────────────────┐                      │
│   │  C ABI Functions   │  #[no_mangle]        │
│   │  (extern "C")      │  #[repr(C)] structs  │
│   └────────┬───────────┘                      │
│            │                                  │
│            ▼                                  │
│   ┌────────────────────┐                      │
│   │  Rust Domain Engine │  Pure math, no I/O  │
│   │  (astronomy_engine) │                     │
│   └─────────────────────┘                     │
└───────────────────────────────────────────────┘
```

**Platform-specific bridges**:

| Platform | Bridge Mechanism    | Library Format          | Loaded Via                    |
|----------|---------------------|-------------------------|-------------------------------|
| Android  | JNI (C ABI)         | `libastronomy_engine.so`| `System.loadLibrary()`        |
| iOS      | C ABI + Obj-C bridge| `libastronomy_engine.a` | Static link via Xcode project |

React Native accesses the native library through a **Native Module** that wraps the
C-ABI calls in platform-specific code (Kotlin on Android, Swift/Obj-C on iOS) and
exposes them to JavaScript via the React Native bridge.

---

## 2. Primitive Type Mapping

All values crossing the FFI boundary use C-compatible primitive types.

| Rust Type     | C ABI Type       | TypeScript Type | Notes                          |
|---------------|------------------|-----------------|--------------------------------|
| `f64`         | `double`         | `number`        | 64-bit IEEE 754 float          |
| `f32`         | `float`          | `number`        | 32-bit float (not used)        |
| `i64`         | `int64_t`        | `number`        | Unix timestamps in milliseconds|
| `i32`         | `int32_t`        | `number`        | Error codes, object IDs        |
| `u32`         | `uint32_t`       | `number`        | Catalog IDs                    |
| `bool`        | `int32_t`        | `boolean`       | 0 = false, nonzero = true      |
| `*const c_char`| `const char *`  | `string`        | UTF-8 null-terminated          |
| `*mut T`      | `T *`           | opaque handle   | Heap-allocated, caller must free|

**Important**: JavaScript `number` is IEEE 754 double (53-bit integer precision).
Timestamps as `i64` are safe because Unix milliseconds through year 2100 fit within
53 bits.

---

## 3. Shared C-Compatible Structs

All structs passed across the FFI boundary use `#[repr(C)]` for deterministic layout.

### 3.1 AltAz

```rust
/// Horizontal coordinate result
#[repr(C)]
pub struct AltAz {
    pub altitude: f64,    // Degrees, -90 to +90
    pub azimuth: f64,     // Degrees, 0 to 360 (N=0, E=90, S=180, W=270)
    pub visible: i32,     // 1 if altitude > 0, 0 otherwise
}
```

### 3.2 Vector3

```rust
/// 3D unit vector in Earth-local frame (X=East, Y=Up, Z=North)
#[repr(C)]
pub struct Vector3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}
```

### 3.3 Quaternion

```rust
/// Unit quaternion representing 3D rotation
#[repr(C)]
pub struct Quaternion {
    pub w: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}
```

### 3.4 RiseSetResult

```rust
/// Rise/set computation result
#[repr(C)]
pub struct RiseSetResult {
    pub rise_time_ms: i64,     // Unix ms, or -1 if N/A
    pub set_time_ms: i64,      // Unix ms, or -1 if N/A
    pub transit_time_ms: i64,  // Unix ms (time of max altitude)
    pub max_altitude: f64,     // Degrees at transit
    pub status: i32,           // 0 = normal, 1 = circumpolar, 2 = never_visible
}
```

### 3.5 TrackingResult

```rust
/// Single frame of tracking computation
#[repr(C)]
pub struct TrackingResult {
    pub direction_x: f64,    // Relative direction vector (camera frame)
    pub direction_y: f64,
    pub direction_z: f64,
    pub angle_error: f64,    // Angular distance to target (degrees)
    pub locked: i32,         // 1 if angle_error < lock_threshold
    pub altitude: f64,       // Current target altitude (degrees)
    pub azimuth: f64,        // Current target azimuth (degrees)
}
```

### 3.6 SearchResults

```rust
/// Heap-allocated search result buffer
#[repr(C)]
pub struct SearchResults {
    pub count: i32,
    pub ids: *mut i32,       // Array of object IDs
    pub names: *mut *mut c_char, // Array of name strings
    pub magnitudes: *mut f64,    // Array of magnitudes
}
```

### 3.7 ErrorCode Enum

```rust
/// Error codes returned by FFI functions
#[repr(C)]
pub enum ErrorCode {
    Success = 0,
    InvalidCoordinates = 1,
    ObjectNotFound = 2,
    ComputationOverflow = 3,
    EphemerisOutOfRange = 4,
    InvalidQuaternion = 5,
    InternalError = 99,
}
```

---

## 4. Core Exported Functions

All exported functions use `extern "C"` linkage and `#[no_mangle]` for symbol stability.

### 4.1 Coordinate Transformation

```rust
/// Convert equatorial coordinates (RA/Dec) to horizontal coordinates (Alt/Az).
///
/// Parameters:
///   ra       - Right Ascension in hours (0.0 to 24.0)
///   dec      - Declination in degrees (-90.0 to +90.0)
///   lat      - Observer latitude in degrees (-90.0 to +90.0)
///   lon      - Observer longitude in degrees (-180.0 to +180.0)
///   time_ms  - Current time as Unix milliseconds
///
/// Returns: AltAz struct with altitude, azimuth, and visibility flag.
///
/// Thread safety: Safe to call from any thread (pure function, no global state).
#[no_mangle]
pub extern "C" fn ra_dec_to_altaz(
    ra: f64,
    dec: f64,
    lat: f64,
    lon: f64,
    time_ms: i64,
) -> AltAz
```

### 4.2 Tracking Direction

```rust
/// Compute the direction and angular error between the device pointing direction
/// and a celestial target. Used by the real-time tracking loop at 30+ Hz.
///
/// Parameters:
///   ra, dec       - Target equatorial coordinates
///   lat, lon      - Observer location
///   time_ms       - Current time as Unix milliseconds
///   q_w, q_x, q_y, q_z - Device orientation quaternion (Earth frame)
///
/// Returns: TrackingResult with direction vector, angle error, and lock status.
///
/// Performance: Must complete in < 2ms.
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn compute_tracking_direction(
    ra: f64,
    dec: f64,
    lat: f64,
    lon: f64,
    time_ms: i64,
    q_w: f64,
    q_x: f64,
    q_y: f64,
    q_z: f64,
) -> TrackingResult
```

### 4.3 Rise/Set Computation

```rust
/// Compute rise, set, and transit times for an object at a given location and date.
/// Uses analytical solution for fixed stars, iterative scan for planets.
///
/// Parameters:
///   object_id - Catalog ID (used for planet ephemeris lookup)
///   ra, dec   - Equatorial coordinates (ignored for planets, engine uses ephemeris)
///   lat, lon  - Observer location
///   time_ms   - Reference time (midnight of the target date)
///
/// Returns: RiseSetResult with times and status flag.
///
/// Performance: < 100ms for stars, < 500ms for planets (iterative scan).
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn compute_rise_set(
    object_id: i32,
    ra: f64,
    dec: f64,
    lat: f64,
    lon: f64,
    time_ms: i64,
) -> RiseSetResult
```

### 4.4 Catalog Search

```rust
/// Search the bundled celestial object catalog by name substring.
/// Returns a heap-allocated SearchResults struct that MUST be freed
/// by calling free_search_results().
///
/// Parameters:
///   query_ptr - Pointer to UTF-8 query string
///   query_len - Length of query string in bytes (not null-terminated)
///   max_results - Maximum number of results to return
///
/// Returns: Pointer to heap-allocated SearchResults, or null on error.
///
/// Memory: Caller MUST call free_search_results() when done.
/// Thread safety: Safe to call from any thread (read-only catalog).
#[no_mangle]
pub extern "C" fn search_catalog(
    query_ptr: *const u8,
    query_len: i32,
    max_results: i32,
) -> *mut SearchResults
```

### 4.5 Angular Error

```rust
/// Compute the angular distance between a target vector and device orientation.
///
/// Parameters:
///   target_x, target_y, target_z - Target direction (Earth-local unit vector)
///   q_w, q_x, q_y, q_z          - Device orientation quaternion
///
/// Returns: Angular error in degrees (0.0 to 180.0), or -1.0 on error.
///
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn compute_angular_error(
    target_x: f64,
    target_y: f64,
    target_z: f64,
    q_w: f64,
    q_x: f64,
    q_y: f64,
    q_z: f64,
) -> f64
```

### 4.6 Memory Management

```rust
/// Free a SearchResults struct allocated by search_catalog().
/// Passing a null pointer is a safe no-op.
#[no_mangle]
pub extern "C" fn free_search_results(ptr: *mut SearchResults)

/// Free a string allocated by the Rust engine (e.g., from get_last_error).
/// Passing a null pointer is a safe no-op.
#[no_mangle]
pub extern "C" fn free_string(ptr: *mut c_char)
```

### 4.7 Diagnostics

```rust
/// Return the version string of the Rust core engine.
/// Caller MUST free the returned string with free_string().
///
/// Returns: Pointer to a null-terminated UTF-8 version string (e.g., "1.0.0").
#[no_mangle]
pub extern "C" fn core_version() -> *mut c_char

/// Return the last error message from the Rust engine.
/// Returns null if no error has occurred since the last call.
/// Caller MUST free the returned string with free_string().
///
/// Thread safety: Uses thread-local storage; each thread has its own error.
#[no_mangle]
pub extern "C" fn get_last_error() -> *mut c_char
```

---

## 5. Android JNI Integration

On Android, the Rust library is compiled as a shared object (`libastronomy_engine.so`)
for each ABI target (arm64-v8a, armeabi-v7a, x86_64).

### Kotlin JNI Declarations

```kotlin
package com.findmystar.engine

object AstronomyEngine {
    init {
        System.loadLibrary("astronomy_engine")
    }

    // Coordinate transformation
    external fun raDecToAltaz(
        ra: Double, dec: Double, lat: Double, lon: Double, timeMs: Long
    ): DoubleArray  // [altitude, azimuth, visible]

    // Tracking direction
    external fun computeTrackingDirection(
        ra: Double, dec: Double, lat: Double, lon: Double, timeMs: Long,
        qW: Double, qX: Double, qY: Double, qZ: Double
    ): DoubleArray  // [dirX, dirY, dirZ, angleError, locked, altitude, azimuth]

    // Rise/set times
    external fun computeRiseSet(
        objectId: Int, ra: Double, dec: Double,
        lat: Double, lon: Double, timeMs: Long
    ): LongArray  // [riseMs, setMs, transitMs, maxAlt*1000, status]

    // Version
    external fun coreVersion(): String

    // Error
    external fun getLastError(): String?
}
```

### React Native Native Module (Android)

```kotlin
@ReactModule(name = "AstronomyBridge")
class AstronomyBridgeModule(reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AstronomyBridge"

    @ReactMethod
    fun raDecToAltaz(ra: Double, dec: Double, lat: Double, lon: Double,
                     timeMs: Double, promise: Promise) {
        try {
            val result = AstronomyEngine.raDecToAltaz(ra, dec, lat, lon, timeMs.toLong())
            val map = Arguments.createMap()
            map.putDouble("altitude", result[0])
            map.putDouble("azimuth", result[1])
            map.putBoolean("visible", result[2] > 0.5)
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ENGINE_ERROR", e.message)
        }
    }
}
```

---

## 6. iOS Bridge Integration

On iOS, the Rust library is compiled as a static library (`libastronomy_engine.a`)
for arm64 (device) and x86_64 (simulator).

### Objective-C Bridging Header

```objc
// FindMyStar-Bridging-Header.h

#ifndef astronomy_engine_h
#define astronomy_engine_h

#include <stdint.h>

typedef struct {
    double altitude;
    double azimuth;
    int32_t visible;
} AltAz;

typedef struct {
    double direction_x, direction_y, direction_z;
    double angle_error;
    int32_t locked;
    double altitude, azimuth;
} TrackingResult;

typedef struct {
    int64_t rise_time_ms, set_time_ms, transit_time_ms;
    double max_altitude;
    int32_t status;
} RiseSetResult;

AltAz ra_dec_to_altaz(double ra, double dec, double lat, double lon, int64_t time_ms);
TrackingResult compute_tracking_direction(
    double ra, double dec, double lat, double lon, int64_t time_ms,
    double q_w, double q_x, double q_y, double q_z);
RiseSetResult compute_rise_set(
    int32_t object_id, double ra, double dec,
    double lat, double lon, int64_t time_ms);
double compute_angular_error(
    double target_x, double target_y, double target_z,
    double q_w, double q_x, double q_y, double q_z);
char* core_version(void);
char* get_last_error(void);
void free_string(char* ptr);

#endif
```

### Swift Wrapper (React Native Native Module)

```swift
@objc(AstronomyBridge)
class AstronomyBridge: NSObject {
    @objc func raDecToAltaz(_ ra: Double, dec: Double, lat: Double,
                            lon: Double, timeMs: Double,
                            resolve: @escaping RCTPromiseResolveBlock,
                            reject: @escaping RCTPromiseRejectBlock) {
        let result = ra_dec_to_altaz(ra, dec, lat, lon, Int64(timeMs))
        resolve([
            "altitude": result.altitude,
            "azimuth": result.azimuth,
            "visible": result.visible != 0
        ])
    }
}
```

---

## 7. Error Handling Protocol

### Rust Side: Panic Containment

All exported functions wrap their implementation in `catch_unwind` to prevent Rust
panics from unwinding across the FFI boundary (which is undefined behavior):

```rust
#[no_mangle]
pub extern "C" fn ra_dec_to_altaz(
    ra: f64, dec: f64, lat: f64, lon: f64, time_ms: i64
) -> AltAz {
    let result = std::panic::catch_unwind(|| {
        // Validate inputs
        if ra < 0.0 || ra > 24.0 { return Err(ErrorCode::InvalidCoordinates); }
        if dec < -90.0 || dec > 90.0 { return Err(ErrorCode::InvalidCoordinates); }

        // Compute
        let (alt, az) = internal::ra_dec_to_altaz_impl(ra, dec, lat, lon, time_ms);
        Ok(AltAz { altitude: alt, azimuth: az, visible: if alt > 0.0 { 1 } else { 0 } })
    });

    match result {
        Ok(Ok(altaz)) => altaz,
        Ok(Err(code)) => {
            set_last_error(format!("Invalid input: error code {}", code as i32));
            AltAz { altitude: 0.0, azimuth: 0.0, visible: 0 } // sentinel
        }
        Err(_) => {
            set_last_error("Internal panic in ra_dec_to_altaz".to_string());
            AltAz { altitude: 0.0, azimuth: 0.0, visible: 0 } // sentinel
        }
    }
}
```

### Sentinel Values

Functions that return structs use sentinel values on error:

| Function                      | Sentinel                               | Meaning          |
|-------------------------------|----------------------------------------|------------------|
| `ra_dec_to_altaz`             | `altitude=0, azimuth=0, visible=0`     | Computation failed|
| `compute_tracking_direction`  | `angle_error=-1.0`                     | Computation failed|
| `compute_rise_set`            | `status=-1`                            | Computation failed|
| `compute_angular_error`       | `-1.0`                                 | Computation failed|

### TypeScript Side: Error Detection

```typescript
// TypeScript wrapper checks for sentinel values
async function raDecToAltaz(ra: number, dec: number, lat: number,
                             lon: number, timeMs: number): Promise<AltAz> {
  const result = await NativeModules.AstronomyBridge.raDecToAltaz(
    ra, dec, lat, lon, timeMs
  );

  if (result.altitude === 0 && result.azimuth === 0 && !result.visible) {
    const error = await NativeModules.AstronomyBridge.getLastError();
    throw new FFIComputationError(error ?? 'Unknown FFI error');
  }

  return result;
}
```

---

## 8. Memory Ownership Rules

| Resource         | Allocated By    | Freed By           | Function              |
|------------------|-----------------|--------------------|-----------------------|
| `SearchResults`  | Rust (`search_catalog`) | Caller via `free_search_results` | `free_search_results(ptr)` |
| Version string   | Rust (`core_version`)   | Caller via `free_string`         | `free_string(ptr)`         |
| Error string     | Rust (`get_last_error`) | Caller via `free_string`         | `free_string(ptr)`         |
| `AltAz`          | Stack (return value)    | Automatic          | N/A (value type)      |
| `TrackingResult`  | Stack (return value)   | Automatic          | N/A (value type)      |
| `RiseSetResult`   | Stack (return value)   | Automatic          | N/A (value type)      |

**Rule**: Any pointer returned by a Rust function must be freed by calling the
corresponding `free_*` function. Passing a pointer to any other deallocation function
(e.g., C `free()`) is undefined behavior.

---

## 9. Threading Model

| Function                      | Thread Safety       | Notes                          |
|-------------------------------|---------------------|--------------------------------|
| `ra_dec_to_altaz`             | Thread-safe         | Pure function, no global state |
| `compute_tracking_direction`  | Thread-safe         | Pure function, no global state |
| `compute_rise_set`            | Thread-safe         | Pure function, no global state |
| `search_catalog`              | Thread-safe         | Read-only catalog access       |
| `compute_angular_error`       | Thread-safe         | Pure function, no global state |
| `core_version`                | Thread-safe         | Returns constant               |
| `get_last_error`              | Thread-local        | Each thread has its own error  |
| `free_search_results`         | NOT thread-safe     | Must free on same thread       |
| `free_string`                 | NOT thread-safe     | Must free on same thread       |

**Recommendation**: Call computation functions from any thread. Call free functions
from the same thread that received the allocation. In practice, the React Native
bridge serializes calls to the native module thread, so this is handled automatically.

---

## 10. Version Compatibility

### Protocol

On app startup, the TypeScript layer validates the Rust engine version:

```typescript
async function validateEngineVersion(): Promise<void> {
  const engineVersion = await NativeModules.AstronomyBridge.coreVersion();
  const expectedMajor = 1;
  const [major] = engineVersion.split('.').map(Number);

  if (major !== expectedMajor) {
    throw new EngineVersionMismatchError(
      `Expected engine v${expectedMajor}.x, got v${engineVersion}`
    );
  }
}
```

### Versioning Rules

- **Major version**: Breaking changes to FFI signatures or struct layouts.
  Mobile app must be rebuilt.
- **Minor version**: New functions added, existing signatures unchanged.
  Mobile app continues to work.
- **Patch version**: Bug fixes, no API changes.

The Rust crate version (`Cargo.toml`) and the mobile app's expected engine version
must agree on the major version number.

---

## 11. Performance Constraints

| Aspect                    | Target              | Measured                        |
|---------------------------|---------------------|---------------------------------|
| FFI call overhead (JNI)   | < 0.1ms             | ~0.05ms per call (Android)      |
| FFI call overhead (C ABI) | < 0.05ms            | ~0.02ms per call (iOS)          |
| `ra_dec_to_altaz`         | < 1ms               | ~0.3ms                          |
| `compute_tracking_direction` | < 2ms            | ~0.8ms                          |
| `compute_rise_set` (star) | < 10ms              | ~2ms                            |
| `compute_rise_set` (planet)| < 100ms            | ~50ms (iterative)               |
| `search_catalog`          | < 20ms              | ~5ms for typical query          |
| `compute_angular_error`   | < 0.5ms             | ~0.1ms                          |

**Batch optimization**: For bulk operations (e.g., recalculating 50 alarms), consider
a batch FFI function that processes multiple objects in a single native call to reduce
JNI/bridge overhead.

---

## 12. Cross-References

| Document                                                             | Relevance                    |
|----------------------------------------------------------------------|------------------------------|
| [Application Layer Overview](./overview.md)                          | Service architecture context |
| [Application Services](./services.md)                                | TypeScript service interfaces|
| [Algorithms](../04-domain-engine/algorithms.md)                      | Math behind FFI functions    |
| [ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md)     | Why Rust for domain          |
| [Architecture Overview](../03-architecture/architecture-overview.md) | System-level integration     |
| [Error Handling](./error-handling.md)                                | Error taxonomy               |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
