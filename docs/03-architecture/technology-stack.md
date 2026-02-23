# Technology Stack

This document details every technology used in FindMyStar, the rationale behind each choice, the alternatives that were considered, and the constraints that govern dependency management and binary size.

> **Related Documents**: [Architecture Overview](./architecture-overview.md) | [Design Principles](./design-principles.md) | [ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md) | [ADR-0003: Offline-First](../11-adr/0003-offline-first.md)

---

## 1. Stack Overview

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Presentation** | React Native | 0.73+ | Cross-platform mobile UI |
| **Presentation** | ARCore | 1.40+ | Android augmented reality |
| **Presentation** | ARKit | 6.0+ | iOS augmented reality |
| **Presentation** | Redux | 5.0+ | Predictable state management |
| **Application** | TypeScript | 5.3+ | Type-safe service orchestration |
| **Domain** | Rust | 1.75+ (stable) | Astronomical computation engine |
| **Domain** | nalgebra | 0.32+ | Linear algebra, vectors, quaternions |
| **Data** | SQLite3 | 3.40+ | Local relational database |
| **Platform** | JNI | Android NDK | Rust-to-Android bridge |
| **Platform** | C ABI / Obj-C Bridge | Xcode 15+ | Rust-to-iOS bridge |
| **Platform** | WorkManager | 2.9+ | Android background task scheduling |
| **Platform** | UNUserNotificationCenter | iOS 14+ | iOS local notification scheduling |

---

## 2. Frontend: React Native

### 2.1 Framework Choice

React Native provides a single codebase for both iOS and Android with native performance characteristics. The JavaScript bridge enables calling native modules (including the Rust FFI layer) from TypeScript.

**Target Platforms**:

| Platform | Minimum Version | Rationale |
|----------|----------------|-----------|
| iOS | 14.0+ | ARKit 4+ support, 95%+ device coverage |
| Android | 10 (API 29)+ | ARCore support, 90%+ device coverage |

### 2.2 Augmented Reality

AR is the primary user-facing feature for real-time celestial tracking:

| Platform | Framework | Capabilities Used |
|----------|-----------|-------------------|
| Android | ARCore | Camera access, motion tracking, device pose |
| iOS | ARKit | Camera access, motion tracking, world tracking |

The AR layer renders a directional overlay (arrow, crosshair, distance indicator) on the camera feed. It consumes `TrackingResult` objects from the Application layer and translates them into visual guidance elements.

**AR does not perform astronomical computation**. It receives pre-computed direction vectors and simply renders them. This keeps the Presentation layer thin and testable.

### 2.3 State Management: Redux

Redux manages application state with a unidirectional data flow:

```
User Action --> Dispatch --> Reducer --> New State --> UI Re-render
```

**State Slices**:

| Slice | Contents |
|-------|----------|
| `catalog` | Search results, selected object |
| `tracking` | Active tracking session, direction, angle error, lock state |
| `alarms` | Tracked objects list, next visibility times |
| `sensors` | Device orientation quaternion, GPS location, calibration status |
| `preferences` | Notification settings, min altitude, dark mode |

Redux was chosen over alternatives (MobX, Zustand, Context API) for its predictable state transitions, middleware support (for async sensor data), and mature debugging tooling (Redux DevTools).

---

## 3. Domain Engine: Rust

### 3.1 Language Choice

Rust was selected as the sole language for the astronomical computation engine. See [ADR-0002](../11-adr/0002-rust-core-engine.md) for the complete decision record.

**Key Properties**:

- **Zero-cost abstractions**: No garbage collector, no runtime overhead.
- **Memory safety**: Ownership and borrowing prevent entire classes of bugs (use-after-free, data races, null dereferences).
- **Deterministic execution**: No GC pauses that could cause frame drops in the AR tracking loop.
- **Strong type system**: Distinct types for degrees, radians, hours prevent unit confusion at compile time.
- **Cross-compilation**: A single Rust codebase compiles to ARM64 (iOS), ARM/x86 (Android), and WASM (optional web target).

### 3.2 Crate Dependencies

The Rust core maintains a **minimal dependency footprint**:

| Crate | Version | Purpose | Justification |
|-------|---------|---------|---------------|
| `nalgebra` | 0.32+ | Vector3, Quaternion, Matrix operations | Industry-standard linear algebra; avoids reimplementing well-tested math |

**No other external crates** are permitted in the domain engine. The standard library provides everything else (trigonometry via `f64` methods, basic collections, result types).

This constraint exists because:

1. Every dependency is a potential supply-chain risk.
2. Each crate adds to binary size and compile time.
3. The domain logic must remain auditable and reproducible.

### 3.3 Compilation Targets

| Target | Triple | Output | Integration Method |
|--------|--------|--------|-------------------|
| Android ARM64 | `aarch64-linux-android` | `libastronomy_engine.so` | JNI via React Native Native Modules |
| Android x86_64 | `x86_64-linux-android` | `libastronomy_engine.so` | JNI (emulator support) |
| iOS ARM64 | `aarch64-apple-ios` | `libastronomy_engine.a` | C ABI via Objective-C bridging header |
| iOS Simulator | `aarch64-apple-ios-sim` | `libastronomy_engine.a` | C ABI (development) |
| WASM (optional) | `wasm32-unknown-unknown` | `astronomy_engine.wasm` | wasm-bindgen (future web target) |

### 3.4 FFI Bridge

The Rust library exposes a C-compatible ABI:

```rust
#[no_mangle]
pub extern "C" fn compute_ra_dec(object_id: u32, time_ms: i64, out_ra: *mut f64, out_dec: *mut f64) -> i32;

#[no_mangle]
pub extern "C" fn ra_dec_to_altaz(ra: f64, dec: f64, lat: f64, lon: f64, time_ms: i64, out_alt: *mut f64, out_az: *mut f64) -> i32;

#[no_mangle]
pub extern "C" fn compute_angular_error(target: *const f64, device_quat: *const f64, out_angle: *mut f64) -> i32;
```

Return codes: `0` = success, negative values = error codes. All output is written through mutable pointers. No heap allocation crosses the FFI boundary.

---

## 4. Data Layer: SQLite

### 4.1 Database Choice

SQLite is the only persistence mechanism. See [ADR-0003](../11-adr/0003-offline-first.md) for the offline-first rationale.

**Properties**:

- **Embedded**: No separate database process; the library runs in-process.
- **Zero configuration**: No server setup, no connection strings, no authentication.
- **Single-file storage**: The entire database is one file on the device filesystem.
- **ACID compliant**: Transactions protect against data corruption from app crashes or power loss.
- **Mature**: Billions of deployed instances; one of the most tested codebases in existence.

### 4.2 Database Contents

| Table | Row Count (MVP) | Size Estimate | Access Pattern |
|-------|-----------------|---------------|----------------|
| `objects` | ~620 | ~100 KB | Read-heavy (search, lookup) |
| `tracked_objects` | 0-50 | ~10 KB | Read-write (alarm management) |
| `user_preferences` | 1 | <1 KB | Read-heavy, rare writes |

Total database size: **~200 KB** (excluding bundled catalog data).

See [Database Schema](../05-data-model/schema.md) for the complete schema definition, indexes, and query patterns.

### 4.3 Bundled Catalog Data

| Dataset | Source | Record Count | Size (compressed) |
|---------|--------|-------------|-------------------|
| Bright Stars | Hipparcos | 100-500 (mag < 5) | ~50 KB |
| Planets | VSOP87 coefficients | 8 | ~1 MB |
| Messier Objects | Static catalog | ~110 | ~100 KB |
| Sun | Analytical formula | 1 | Embedded in code |
| Moon | Analytical formula | 1 | Embedded in code |
| **Total** | | **~620** | **~3-5 MB** |

The catalog is bundled as a pre-populated SQLite database shipped inside the application binary. It is read-only at runtime and can be replaced in future app updates without affecting user data.

---

## 5. Platform Integration

### 5.1 Android Integration

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Native bridge | JNI (Java Native Interface) | Call Rust functions from TypeScript via React Native Native Modules |
| Background tasks | WorkManager | Schedule daily alarm recalculation at midnight |
| Notifications | NotificationManager | Display local rise/set alerts |
| Sensors | SensorManager | Read accelerometer, gyroscope, magnetometer |
| Location | FusedLocationProviderClient | GPS with battery-efficient location updates |
| AR | ARCore | Camera overlay and device pose tracking |

### 5.2 iOS Integration

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Native bridge | Objective-C bridging header + C ABI | Call Rust functions from TypeScript via React Native Native Modules |
| Background tasks | BGTaskScheduler | Schedule daily alarm recalculation |
| Notifications | UNUserNotificationCenter | Display local rise/set alerts |
| Sensors | CoreMotion | Read accelerometer, gyroscope, magnetometer |
| Location | CoreLocation | GPS with configurable accuracy |
| AR | ARKit | Camera overlay and world tracking |

### 5.3 Notification Flow

```
AlarmScheduler (TS)
    |
    +-- Android: WorkManager.enqueue(OneTimeWorkRequest)
    |       --> NotificationManager.notify()
    |
    +-- iOS: UNUserNotificationCenter.add(UNNotificationRequest)
            --> System delivers at scheduled time
```

Notifications are **entirely local**. No push notification service (FCM, APNs) is used. The OS handles delivery timing; the app computes when to schedule.

---

## 6. Development Tools

### 6.1 Build Tools

| Tool | Purpose | Configuration |
|------|---------|---------------|
| `cargo` | Rust compilation, testing, benchmarking | `Cargo.toml` |
| `npm` / `yarn` | JavaScript/TypeScript dependency management | `package.json` |
| Android Studio | Android builds, device emulation | `build.gradle` |
| Xcode | iOS builds, device emulation, code signing | `.xcodeproj` / `.xcworkspace` |
| VS Code | Primary IDE for TypeScript and Rust development | `.vscode/settings.json` |

### 6.2 Cross-Compilation

Building the Rust library for mobile targets requires platform-specific toolchains:

```bash
# Android (requires Android NDK)
cargo build --target aarch64-linux-android --release
cargo build --target x86_64-linux-android --release

# iOS
cargo build --target aarch64-apple-ios --release
cargo build --target aarch64-apple-ios-sim --release

# WASM (optional)
cargo build --target wasm32-unknown-unknown --release
```

Build scripts in `/scripts/` automate the full pipeline from Rust compilation through React Native bundling.

---

## 7. Testing Tools

### 7.1 Test Framework Matrix

| Layer | Framework | Command | Scope |
|-------|-----------|---------|-------|
| Domain (Rust) | `cargo test` | `cargo test --lib` | Unit tests for all algorithms |
| Domain (Rust) | `cargo bench` | `cargo bench` | Performance benchmarks |
| Domain (Rust) | `cargo tarpaulin` | `cargo tarpaulin` | Code coverage reporting |
| Application (TS) | Jest | `npm test` | Service logic unit tests |
| Presentation (TS) | Jest + React Testing Library | `npm test` | Component rendering tests |
| End-to-End | Detox | `detox test` | Full device integration tests |
| Validation | Custom harness | `cargo test --test validation` | Ephemeris accuracy vs. USNO/JPL |

### 7.2 Coverage Targets

| Layer | Target Coverage | Rationale |
|-------|----------------|-----------|
| Rust core | 90%+ | Safety-critical astronomical math |
| Application services | 80%+ | Orchestration logic with mocked dependencies |
| Presentation | 60%+ | UI rendering (visual correctness verified by E2E) |

See [Testing Overview](../08-testing/overview.md) for the complete testing strategy.

---

## 8. Technology Decision Rationale

### 8.1 Why React Native over Flutter?

| Criterion | React Native | Flutter |
|-----------|-------------|---------|
| Native module FFI | Mature JNI/Obj-C bridge | Requires dart:ffi (less mature for Rust) |
| AR framework integration | Well-documented ARCore/ARKit bindings | Fewer AR plugins |
| Developer ecosystem | Larger community, more libraries | Growing but smaller |
| TypeScript support | Native | Dart only |

React Native was chosen primarily for its mature native module system, which simplifies Rust FFI integration on both platforms.

### 8.2 Why Rust over C++?

| Criterion | Rust | C++ |
|-----------|------|-----|
| Memory safety | Compile-time guaranteed | Manual (error-prone) |
| Build system | Cargo (unified) | CMake/Make (fragmented) |
| Dependency management | Crates.io | No standard package manager |
| Learning curve | Steep (one-time) | Steep (ongoing footguns) |
| Binary size | Comparable | Comparable |

Rust provides equivalent performance with significantly stronger safety guarantees. See [ADR-0002](../11-adr/0002-rust-core-engine.md).

### 8.3 Why SQLite over Realm/Core Data?

| Criterion | SQLite | Realm | Core Data |
|-----------|--------|-------|-----------|
| Cross-platform | Yes | Yes | iOS only |
| Simplicity | Raw SQL, full control | ORM-like API | Complex stack |
| Bundle size impact | ~1 MB | ~5-10 MB | Built into iOS |
| Query flexibility | Full SQL | Limited query language | NSPredicate |
| Long-term stability | Decades of proven reliability | Vendor-dependent | Apple-dependent |

SQLite provides maximum control, minimal overhead, and cross-platform consistency. See [ADR-0003](../11-adr/0003-offline-first.md).

### 8.4 Why Redux over MobX/Zustand?

| Criterion | Redux | MobX | Zustand |
|-----------|-------|------|---------|
| Predictability | Strict unidirectional flow | Observable mutations | Flexible |
| Debugging | Redux DevTools, time-travel | Less tooling | Minimal tooling |
| Middleware | Mature (thunk, saga) | Built-in reactions | Basic |
| Community | Largest | Medium | Growing |

Redux's strict unidirectional data flow matches FindMyStar's architectural principle of predictable state transitions, especially important for real-time sensor data flowing through the tracking loop.

---

## 9. Dependency Management

### 9.1 Rust Dependencies

Managed via `Cargo.toml` with **exact version pinning**:

```toml
[dependencies]
nalgebra = "=0.32.3"

[dev-dependencies]
approx = "=0.5.1"
criterion = "=0.5.1"
```

**Rules**:

- Use exact versions (`=0.32.3`), not semver ranges, to ensure reproducible builds.
- `Cargo.lock` is committed to version control.
- New crate additions require architectural review (justification documented in PR description).
- No crates with `unsafe` blocks unless thoroughly audited.

### 9.2 JavaScript/TypeScript Dependencies

Managed via `package.json` with **pinned versions**:

```json
{
  "dependencies": {
    "react-native": "0.73.4",
    "redux": "5.0.1",
    "@reduxjs/toolkit": "2.0.1"
  }
}
```

**Rules**:

- `package-lock.json` (or `yarn.lock`) is committed to version control.
- No wildcard versions (`*`) or loose ranges (`^`, `~`).
- Dependencies are audited quarterly with `npm audit`.
- Transitive dependency count is monitored to prevent bloat.

### 9.3 Update Policy

| Cadence | Action |
|---------|--------|
| Weekly | Review security advisories (`cargo audit`, `npm audit`) |
| Monthly | Evaluate minor version updates for critical dependencies |
| Quarterly | Full dependency audit and upgrade cycle |
| As needed | Immediate patching for CVEs rated High or Critical |

---

## 10. Binary Size Budget

Keeping the application small is critical for mobile distribution and user adoption:

| Component | Budget | Estimated Actual |
|-----------|--------|-----------------|
| Rust library (compressed, stripped) | 500 KB | ~300-500 KB |
| Celestial catalog (SQLite) | 5 MB | ~3-5 MB |
| VSOP87 coefficients | 1 MB | ~1 MB |
| React Native runtime | 5 MB | ~4-5 MB |
| AR framework overhead | 10 MB | ~8-10 MB |
| UI assets (icons, images) | 2 MB | ~1-2 MB |
| **Total application** | **< 100 MB** | **~30-50 MB** |

**Size Reduction Strategies**:

- Rust: Compile with `opt-level = "z"` (size optimization), strip debug symbols, enable LTO (link-time optimization).
- Catalog: Store only essential fields; defer full Hipparcos (120k stars) to a downloadable expansion pack.
- Assets: Use vector graphics (SVG) where possible; compress raster images.
- React Native: Enable Hermes engine for smaller JavaScript bundles.

---

## 11. Compatibility Matrix

### 11.1 Device Requirements

| Requirement | Android | iOS |
|-------------|---------|-----|
| OS Version | 10+ (API 29) | 14.0+ |
| AR Support | ARCore-compatible device | A9 chip or later |
| GPS | Required | Required |
| Gyroscope | Required | Required |
| Magnetometer | Required (for compass heading) | Required |
| Storage | 100 MB free | 100 MB free |
| RAM | 2 GB minimum | 2 GB minimum |

### 11.2 Development Environment

| Tool | Minimum Version |
|------|----------------|
| Node.js | 18 LTS |
| Rust | 1.75 stable |
| Android Studio | Hedgehog (2023.1.1) |
| Xcode | 15.0 |
| Android NDK | r25c |
| CocoaPods | 1.14 |

---

**Last Updated**: February 2026
