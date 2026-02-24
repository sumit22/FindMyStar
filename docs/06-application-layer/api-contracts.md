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

| Platform | Bridge Mechanism    | Library Format              | Loaded Via                    |
|----------|---------------------|-----------------------------|-------------------------------|
| Android  | JNI (C ABI)         | `libfindmystar_core.so`     | `System.loadLibrary()`        |
| iOS      | C ABI + Obj-C bridge| `libfindmystar_core.a`      | Static link via Xcode project |

React Native accesses the native library through a **Native Module** (`FindMyStarCore`)
that wraps the C-ABI calls in platform-specific code (Kotlin on Android, Swift/Obj-C on
iOS) and exposes them to JavaScript via the React Native bridge.

**Two computation paths**:

| Path | Used For | Coordinates | FFI Functions |
|------|----------|-------------|---------------|
| Engine path | Sun, Moon, Planets | Computed at runtime by ephemeris | `computeTracking`, `computeRiseSet` (objectType/objectId) |
| RA/Dec path | Stars, Deep-sky | Fixed J2000 from database | `computeTrackingRaDec`, `computeRiseSetRaDec` (ra/dec) |

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
Defined in `core/src/ffi/exports.rs`.

### 3.1 FfiAltAz

```rust
/// Horizontal coordinate result
#[repr(C)]
pub struct FfiAltAz {
    pub altitude: f64,    // Degrees, -90 to +90
    pub azimuth: f64,     // Degrees, 0 to 360 (N=0, E=90, S=180, W=270)
    pub error_code: i32,  // 0 = success, -1 = invalid input
}
```

### 3.2 FfiTrackingResult

```rust
/// Device tracking direction result (quaternion-to-target)
#[repr(C)]
pub struct FfiTrackingResult {
    pub direction_deg: f64,   // Direction in degrees
    pub distance_deg: f64,    // Angular distance to target (degrees)
    pub error_code: i32,      // 0 = success
}
```

### 3.3 FfiObjectTrackingResult

```rust
/// Object tracking result: altitude, azimuth, and direction vector.
/// Used by both engine path (computeTracking) and RA/Dec path (computeTrackingRaDec).
#[repr(C)]
pub struct FfiObjectTrackingResult {
    pub altitude: f64,    // Degrees, -90 to +90
    pub azimuth: f64,     // Degrees, 0 to 360
    pub dir_x: f64,       // Direction vector X (East)
    pub dir_y: f64,       // Direction vector Y (Up)
    pub dir_z: f64,       // Direction vector Z (North)
    pub error_code: i32,  // 0 = success, -1 = invalid input, -2 = not found
}
```

### 3.4 FfiRiseSetResult

```rust
/// Rise/set computation result
#[repr(C)]
pub struct FfiRiseSetResult {
    pub rise_ms: f64,     // Rise time as Unix ms (0.0 if N/A)
    pub set_ms: f64,      // Set time as Unix ms (0.0 if N/A)
    pub status: i32,      // 0 = rises/sets, 1 = always visible, 2 = never visible, -1 = error
}
```

### 3.5 Error Codes

```rust
const OK: i32 = 0;
const ERR_INVALID_INPUT: i32 = -1;
const ERR_NOT_FOUND: i32 = -2;
```

### 3.6 Object Type Constants

```rust
// ObjectType enum used by engine-path functions
// 0 = Sun, 1 = Moon, 2 = Planet (object_id = planet_id 1-7), 3 = Star (object_id = hip_id)
```

---

## 4. Core Exported Functions

All exported functions use `extern "C"` linkage and `#[no_mangle]` for symbol stability.
Defined in `core/src/ffi/exports.rs`.

### 4.1 Coordinate Transformation

```rust
/// Convert equatorial coordinates (RA/Dec) to horizontal coordinates (Alt/Az).
///
/// Parameters:
///   ra_hours  - Right Ascension in hours (0.0 to 24.0)
///   dec_deg   - Declination in degrees (-90.0 to +90.0)
///   lat_deg   - Observer latitude in degrees
///   lon_deg   - Observer longitude in degrees
///   unix_ms   - Current time as Unix milliseconds (f64)
///
/// Returns: FfiAltAz struct with altitude, azimuth, and error_code.
/// Thread safety: Safe to call from any thread (pure function).
#[no_mangle]
pub extern "C" fn ffi_ra_dec_to_altaz(
    ra_hours: f64, dec_deg: f64, lat_deg: f64, lon_deg: f64, unix_ms: f64,
) -> FfiAltAz
```

### 4.2 Position Computation

```rust
/// Compute RA/Dec of a celestial object using the ephemeris engine.
/// object_type: 0=Sun, 1=Moon, 2=Planet, 3=Star
/// object_id: planet_id (1-7) or hip_id for stars
/// Returns 0 on success, -1 on invalid input, -2 on not found.
#[no_mangle]
pub extern "C" fn ffi_compute_position(
    object_type: i32, object_id: u32, unix_ms: f64,
    out_ra: *mut f64, out_dec: *mut f64,
) -> i32
```

### 4.3 Object Tracking — Engine Path

```rust
/// Compute alt/az/direction for an engine-path object (Sun/Moon/Planet/Star by ID).
/// Internally calls compute_position → ra_dec_to_altaz → altaz_to_vector3.
///
/// Returns: FfiObjectTrackingResult with altitude, azimuth, direction vector.
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn ffi_compute_tracking_object(
    object_type: i32, object_id: u32,
    lat_deg: f64, lon_deg: f64, unix_ms: f64,
) -> FfiObjectTrackingResult
```

### 4.4 Object Tracking — RA/Dec Path

```rust
/// Compute alt/az/direction from raw RA/Dec coordinates.
/// Used for stars and deep-sky objects whose coordinates come from the database.
/// Internally calls ra_dec_to_altaz → altaz_to_vector3.
///
/// Returns: FfiObjectTrackingResult (always succeeds, error_code = 0).
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn ffi_compute_tracking_radec(
    ra_hours: f64, dec_deg: f64,
    lat_deg: f64, lon_deg: f64, unix_ms: f64,
) -> FfiObjectTrackingResult
```

### 4.5 Rise/Set — RA/Dec Path

```rust
/// Compute rise/set times for fixed-coordinate objects (stars, deep-sky).
/// Uses analytical solution based on the hour-angle formula.
///
/// Returns: FfiRiseSetResult with status (0=rises/sets, 1=always, 2=never).
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn ffi_compute_rise_set(
    ra_hours: f64, dec_deg: f64,
    lat_deg: f64, lon_deg: f64, start_unix_ms: f64,
) -> FfiRiseSetResult
```

### 4.6 Rise/Set — Engine Path

```rust
/// Compute rise/set times for engine-path objects (Sun/Moon/Planet/Star by ID).
/// Internally calls compute_position to get RA/Dec, then compute_rise_set_analytical.
///
/// Returns: FfiRiseSetResult with status.
/// Thread safety: Safe to call from any thread.
#[no_mangle]
pub extern "C" fn ffi_compute_rise_set_object(
    object_type: i32, object_id: u32,
    lat_deg: f64, lon_deg: f64, start_unix_ms: f64,
) -> FfiRiseSetResult
```

### 4.7 Device Tracking Direction

```rust
/// Compute direction from device quaternion to a target vector.
/// Used by the AR tracking loop for arrow guidance.
#[no_mangle]
pub extern "C" fn ffi_compute_tracking(
    target_x: f64, target_y: f64, target_z: f64,
    qw: f64, qx: f64, qy: f64, qz: f64,
) -> FfiTrackingResult
```

### 4.8 Utility Functions

```rust
/// Convert altitude/azimuth to a unit vector in East-Up-North frame.
/// Results returned via out-pointers.
#[no_mangle]
pub extern "C" fn ffi_altaz_to_vector3(
    alt_deg: f64, az_deg: f64,
    out_x: *mut f64, out_y: *mut f64, out_z: *mut f64,
) -> i32

/// Angular distance in degrees between two unit vectors.
#[no_mangle]
pub extern "C" fn ffi_angular_distance(
    x1: f64, y1: f64, z1: f64, x2: f64, y2: f64, z2: f64,
) -> f64

/// Twilight classification: 0=Day, 1=Civil, 2=Nautical, 3=Astronomical, 4=Night
#[no_mangle]
pub extern "C" fn ffi_classify_twilight(sun_alt_deg: f64) -> i32
```

### 4.9 Diagnostics

```rust
/// Return the version string of the Rust core engine.
/// Returns a pointer to a static C string (do not free).
#[no_mangle]
pub extern "C" fn ffi_core_version() -> *const u8
```

---

## 5. Android JNI Integration

On Android, the Rust library is compiled as a shared object (`libfindmystar_core.so`)
and placed in `jniLibs/arm64-v8a/` (or other ABI directories).

### Kotlin Native Module

The module is defined in `AstronomyBridgeModule.kt` under `com.findmystar`:

```kotlin
package com.findmystar

class AstronomyBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        init { System.loadLibrary("findmystar_core") }
    }

    override fun getName() = "FindMyStarCore"

    // JNI declarations — engine path (objectType/objectId)
    private external fun nativeComputeTracking(objectType: Int, objectId: Int,
        lat: Double, lon: Double, unixMs: Double): DoubleArray  // [alt, az, dirX, dirY, dirZ]
    private external fun nativeComputeRiseSet(objectType: Int, objectId: Int,
        lat: Double, lon: Double, startMs: Double): DoubleArray  // [status, riseMs, setMs]

    // JNI declarations — RA/Dec path (raw coordinates from database)
    private external fun nativeComputeTrackingRaDec(ra: Double, dec: Double,
        lat: Double, lon: Double, unixMs: Double): DoubleArray  // [alt, az, dirX, dirY, dirZ]
    private external fun nativeComputeRiseSetRaDec(ra: Double, dec: Double,
        lat: Double, lon: Double, startMs: Double): DoubleArray  // [status, riseMs, setMs]

    // Utility JNI declarations
    private external fun nativeRaDecToAltAz(ra: Double, dec: Double,
        lat: Double, lon: Double, unixMs: Double): DoubleArray
    private external fun nativeComputePosition(objectType: Int, objectId: Int,
        jd: Double): DoubleArray
    private external fun nativeAltAzToVector3(alt: Double, az: Double): DoubleArray
    private external fun nativeAngularDistance(x1: Double, y1: Double, z1: Double,
        x2: Double, y2: Double, z2: Double): Double
    private external fun nativeClassifyTwilight(sunAlt: Double): Int
    private external fun nativeCoreVersion(): String

    // @ReactMethod wrappers expose each JNI function to React Native with Promise-based API
    @ReactMethod
    fun computeTracking(objectType: Int, objectId: Int, lat: Double, lon: Double,
                        unixMs: Double, promise: Promise) {
        val result = nativeComputeTracking(objectType, objectId, lat, lon, unixMs)
        val map = Arguments.createMap()
        map.putDouble("altitude", result[0])
        map.putDouble("azimuth", result[1])
        map.putDouble("dirX", result[2])
        map.putDouble("dirY", result[3])
        map.putDouble("dirZ", result[4])
        promise.resolve(map)
    }
    // ... (similar pattern for all other methods)
}
```

---

## 6. iOS Bridge Integration

On iOS, the Rust library is compiled as a static library (`libfindmystar_core.a`)
for arm64 (device) and arm64-sim (Apple Silicon simulator).

### Bridging Header

`FindMyStar-Bridging-Header.h` declares all C FFI structs and functions:

```c
#ifndef findmystar_bridging_header_h
#define findmystar_bridging_header_h

#include <stdint.h>

typedef struct { double altitude; double azimuth; int32_t error_code; } FfiAltAz;
typedef struct { double direction_deg; double distance_deg; int32_t error_code; } FfiTrackingResult;
typedef struct { double rise_ms; double set_ms; int32_t status; } FfiRiseSetResult;
typedef struct {
    double altitude; double azimuth;
    double dir_x; double dir_y; double dir_z;
    int32_t error_code;
} FfiObjectTrackingResult;

FfiAltAz ffi_ra_dec_to_altaz(double ra_hours, double dec_deg, double lat_deg, double lon_deg, double unix_ms);
int32_t ffi_compute_position(int32_t object_type, uint32_t object_id, double unix_ms, double *out_ra, double *out_dec);

// Engine path (objectType/objectId)
FfiObjectTrackingResult ffi_compute_tracking_object(int32_t object_type, uint32_t object_id,
    double lat_deg, double lon_deg, double unix_ms);
FfiRiseSetResult ffi_compute_rise_set_object(int32_t object_type, uint32_t object_id,
    double lat_deg, double lon_deg, double start_unix_ms);

// RA/Dec path (raw coordinates from database)
FfiObjectTrackingResult ffi_compute_tracking_radec(double ra_hours, double dec_deg,
    double lat_deg, double lon_deg, double unix_ms);
FfiRiseSetResult ffi_compute_rise_set(double ra_hours, double dec_deg,
    double lat_deg, double lon_deg, double start_unix_ms);

// Utilities
int32_t ffi_altaz_to_vector3(double alt_deg, double az_deg, double *out_x, double *out_y, double *out_z);
double ffi_angular_distance(double x1, double y1, double z1, double x2, double y2, double z2);
int32_t ffi_classify_twilight(double sun_alt_deg);
const char* ffi_core_version(void);

#endif
```

### Swift Wrapper (React Native Native Module)

The Swift wrapper (`AstronomyBridge.swift`) mirrors the Kotlin module:

```swift
@objc(FindMyStarCore)
class AstronomyBridge: NSObject {
    @objc static func requiresMainQueueSetup() -> Bool { false }

    // Engine path: objectType/objectId → alt/az/direction
    @objc func computeTracking(_ objectType: Int, objectId: Int,
                                lat: Double, lon: Double, unixMs: Double,
                                resolve: @escaping RCTPromiseResolveBlock,
                                reject: @escaping RCTPromiseRejectBlock) {
        let result = ffi_compute_tracking_object(Int32(objectType), UInt32(objectId), lat, lon, unixMs)
        if result.error_code == 0 {
            resolve(["altitude": result.altitude, "azimuth": result.azimuth,
                     "dirX": result.dir_x, "dirY": result.dir_y, "dirZ": result.dir_z])
        } else {
            reject("CORE_ERROR", "compute_tracking_object failed", nil)
        }
    }

    // RA/Dec path: raw coordinates → alt/az/direction
    @objc func computeTrackingRaDec(_ ra: Double, dec: Double,
                                     lat: Double, lon: Double, unixMs: Double,
                                     resolve: @escaping RCTPromiseResolveBlock,
                                     reject: @escaping RCTPromiseRejectBlock) {
        let result = ffi_compute_tracking_radec(ra, dec, lat, lon, unixMs)
        resolve(["altitude": result.altitude, "azimuth": result.azimuth,
                 "dirX": result.dir_x, "dirY": result.dir_y, "dirZ": result.dir_z])
    }
    // ... (similar pattern for computeRiseSet, computeRiseSetRaDec, etc.)
}
```

### Objective-C Module Registration

`AstronomyBridge.m` registers methods with the React Native bridge:

```objc
@interface RCT_EXTERN_MODULE(FindMyStarCore, NSObject)
RCT_EXTERN_METHOD(computeTracking:(NSInteger)objectType objectId:(NSInteger)objectId ...)
RCT_EXTERN_METHOD(computeTrackingRaDec:(double)ra dec:(double)dec ...)
RCT_EXTERN_METHOD(computeRiseSet:(NSInteger)objectType objectId:(NSInteger)objectId ...)
RCT_EXTERN_METHOD(computeRiseSetRaDec:(double)ra dec:(double)dec ...)
// ... (all methods registered)
@end
```

---

## 7. Error Handling Protocol

### Rust Side: Error Codes

FFI functions signal errors via `error_code` fields in return structs or integer
return values. The Rust crate is compiled with `panic = "abort"` so panics terminate
the process rather than unwinding across the FFI boundary.

### Error Code Convention

| Code | Constant | Meaning |
|------|----------|---------|
| `0` | `OK` | Success |
| `-1` | `ERR_INVALID_INPUT` | Invalid object type or parameters |
| `-2` | `ERR_NOT_FOUND` | Object not found in ephemeris engine |

### Error Indicators by Function

| Function | Error Indicator |
|----------|----------------|
| `ffi_compute_tracking_object` | `error_code != 0`, altitude/azimuth = NaN |
| `ffi_compute_tracking_radec` | Always succeeds (error_code = 0) |
| `ffi_compute_rise_set_object` | `status = -1` or `-2` |
| `ffi_compute_rise_set` | Always succeeds (status = 0, 1, or 2) |
| `ffi_compute_position` | Return value != 0 |

### TypeScript Side: Error Detection

```typescript
// The TypeScript wrapper checks error_code in the native module response.
// Engine-path functions may fail if the object is not found in the ephemeris;
// RA/Dec-path functions always succeed since coordinates come from the database.
const result = await NativeCore.computeTracking(objectType, objectId, lat, lon, unixMs);
// NaN altitude indicates an error from the engine path
if (isNaN(result.altitude)) { /* handle error */ }
```

---

## 8. Memory Ownership Rules

| Resource | Allocated By | Freed By | Notes |
|----------|-------------|----------|-------|
| `FfiAltAz` | Stack (return value) | Automatic | Value type, no heap allocation |
| `FfiObjectTrackingResult` | Stack (return value) | Automatic | Value type |
| `FfiRiseSetResult` | Stack (return value) | Automatic | Value type |
| `FfiTrackingResult` | Stack (return value) | Automatic | Value type |
| Version string | Static (`ffi_core_version`) | Do not free | Points to static C string |

All FFI functions return stack-allocated structs or write to caller-provided
out-pointers. No heap allocations cross the FFI boundary, so no `free_*` functions
are needed. Catalog search is handled at the TypeScript/SQLite level, not via FFI.

---

## 9. Threading Model

| Function | Thread Safety | Notes |
|----------|--------------|-------|
| `ffi_ra_dec_to_altaz` | Thread-safe | Pure function, no global state |
| `ffi_compute_tracking_object` | Thread-safe | Pure function |
| `ffi_compute_tracking_radec` | Thread-safe | Pure function |
| `ffi_compute_rise_set` | Thread-safe | Pure function |
| `ffi_compute_rise_set_object` | Thread-safe | Pure function |
| `ffi_compute_position` | Thread-safe | Pure function |
| `ffi_compute_tracking` | Thread-safe | Pure function |
| `ffi_angular_distance` | Thread-safe | Pure function |
| `ffi_classify_twilight` | Thread-safe | Pure function |
| `ffi_core_version` | Thread-safe | Returns static constant |

All FFI functions are pure computations with no global mutable state. They are safe
to call from any thread. In practice, React Native serializes calls through the
native module thread.

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

| Aspect | Target | Measured |
|--------|--------|----------|
| FFI call overhead (JNI) | < 0.1ms | ~0.05ms per call (Android) |
| FFI call overhead (C ABI) | < 0.05ms | ~0.02ms per call (iOS) |
| `ffi_ra_dec_to_altaz` | < 1ms | ~0.3ms |
| `ffi_compute_tracking_object` | < 2ms | ~1ms |
| `ffi_compute_tracking_radec` | < 1ms | ~0.5ms (no ephemeris lookup) |
| `ffi_compute_rise_set` (RA/Dec) | < 10ms | ~2ms (analytical) |
| `ffi_compute_rise_set_object` | < 10ms | ~3ms (ephemeris + analytical) |
| `ffi_angular_distance` | < 0.5ms | ~0.1ms |

**Note**: RA/Dec path functions are faster than engine-path equivalents since they
skip the ephemeris lookup step. Catalog search is handled at the SQLite level in
TypeScript, not via FFI.

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
