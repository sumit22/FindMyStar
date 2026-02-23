# Domain Engine Overview

## 1. Purpose

The FindMyStar Domain Engine is a **pure mathematical astronomy library** written in Rust. It encapsulates all celestial computation logic -- ephemeris calculation, coordinate transformations, rise/set solving, and vector mathematics -- in a single, deterministic, side-effect-free module.

The engine has three defining constraints:

1. **No I/O**: The engine never reads files, accesses the network, or writes to disk. All data (time, location, catalog entries) is passed in as function arguments.
2. **Deterministic**: Given identical inputs, every function produces bit-identical outputs across all platforms. There is no internal state, no randomness, and no dependency on execution timing.
3. **No allocations on the hot path**: The real-time AR tracking loop (30 FPS) uses only stack-allocated structs (`Vector3`, `Quaternion`, `AltAz`), avoiding heap pressure entirely.

These properties make the engine independently testable with `cargo test`, reproducibly validated against authoritative ephemeris sources, and safe to call from any thread without synchronization.

---

## 2. Architecture

The Domain Engine is compiled as a **static native library** for each mobile target and optionally as a **WebAssembly module** for browser-based tooling and automated testing.

```
                  ┌──────────────────────────┐
                  │   Mobile Application     │
                  │   (React Native / TS)    │
                  └────────────┬─────────────┘
                               │  FFI calls (extern "C")
                               ▼
                  ┌──────────────────────────┐
                  │   Domain Engine (Rust)   │
                  │   libfindmystar_core.a   │
                  │                          │
                  │  - Ephemeris             │
                  │  - Coordinate Transforms │
                  │  - Rise/Set Solver       │
                  │  - Vector Math           │
                  │  - Visibility Filtering  │
                  └──────────────────────────┘
                               │
                  Compiled to:
                  ├─ aarch64-apple-ios       (iOS arm64)
                  ├─ aarch64-linux-android   (Android arm64)
                  ├─ armv7-linux-androideabi (Android armv7)
                  └─ wasm32-unknown-unknown  (Browser / CI)
```

The TypeScript application layer calls into the engine through a thin FFI bridge. The bridge marshals primitive types (`f64`, `i64`, `u32`) across the boundary. No complex objects cross the FFI; results are returned as flat tuples or fixed-size arrays.

---

## 3. Module Map

```
/core/src/
├── lib.rs                  - Public API surface and FFI re-exports
├── math/
│   ├── mod.rs              - Module declarations
│   ├── vector3.rs          - 3D vector: dot, cross, normalize, magnitude
│   ├── quaternion.rs       - Quaternion: multiply, conjugate, rotate, to_forward
│   └── utils.rs            - clamp(), normalize_angle(), deg_to_rad(), rad_to_deg()
├── ephemeris/
│   ├── mod.rs              - Unified ephemeris dispatcher
│   ├── sun.rs              - Solar position (simplified + VSOP87)
│   ├── moon.rs             - Lunar position (low-precision model)
│   ├── planets.rs          - Planetary positions (VSOP87 truncated series)
│   └── stars.rs            - Fixed star catalog lookup + precession correction
├── coordinates/
│   ├── mod.rs              - Module declarations
│   ├── transforms.rs       - RA/Dec ↔ Alt/Az, Alt/Az ↔ Vector3
│   ├── sidereal.rs         - GMST and LST computation
│   └── time.rs             - Julian Date, J2000 century, Unix ↔ JD conversion
├── visibility/
│   ├── mod.rs              - Module declarations
│   ├── rise_set.rs         - Analytical (stars) and iterative (planets) solvers
│   ├── circumpolar.rs      - Circumpolar and never-visible detection
│   └── twilight.rs         - Sun altitude classification (civil, nautical, astronomical)
├── validation/
│   └── reference_data.rs   - Embedded USNO/JPL test vectors for CI validation
└── ffi/
    └── exports.rs          - #[no_mangle] extern "C" functions for mobile bridge
```

Each sub-module is a leaf with no cross-dependencies except through the parent module's public API. The `ephemeris` module depends on `coordinates` and `math`; the `visibility` module depends on `ephemeris` and `coordinates`; the `ffi` module depends on all others.

---

## 4. Public API Surface

The engine exposes the following functions through FFI. All angles are in degrees unless noted; all times are in milliseconds since Unix epoch.

### Ephemeris

| Function | Input | Output |
|----------|-------|--------|
| `compute_sun_position(time_ms)` | Unix time (ms) | `(ra_hours, dec_deg)` |
| `compute_moon_position(time_ms)` | Unix time (ms) | `(ra_hours, dec_deg)` |
| `compute_planet_position(planet_id, time_ms)` | Planet enum, Unix time | `(ra_hours, dec_deg)` |
| `lookup_star(hip_id)` | Hipparcos ID | `(ra_hours, dec_deg, mag)` |

### Coordinate Transforms

| Function | Input | Output |
|----------|-------|--------|
| `ra_dec_to_altaz(ra, dec, lat, lon, time_ms)` | Equatorial + observer | `(alt_deg, az_deg)` |
| `altaz_to_vector3(alt, az)` | Horizontal coords | `(x, y, z)` unit vector |
| `compute_lst(lon, time_ms)` | Longitude, Unix time | LST in hours |

### Guidance

| Function | Input | Output |
|----------|-------|--------|
| `angular_distance(v1, v2)` | Two unit vectors (6 f64) | Angle in degrees |
| `compute_direction(target_vec, device_quat)` | Target vector, quaternion | `(direction_angle, distance)` |
| `quaternion_to_forward(q)` | Device quaternion (4 f64) | `(x, y, z)` forward vector |

### Visibility

| Function | Input | Output |
|----------|-------|--------|
| `compute_rise_set(ra, dec, lat, lon, time_ms)` | Object + observer | `(rise_ms, set_ms)` or status code |
| `compute_rise_set_iterative(planet_id, lat, lon, time_ms)` | Planet + observer | `(rise_ms, set_ms)` or status code |
| `sun_altitude(lat, lon, time_ms)` | Observer + time | Sun altitude in degrees |
| `is_observable(alt, sun_alt)` | Object altitude, sun altitude | Boolean |

### Time

| Function | Input | Output |
|----------|-------|--------|
| `unix_to_jd(time_ms)` | Unix time (ms) | Julian Date (f64) |
| `compute_gmst(jd)` | Julian Date | GMST in hours |

---

## 5. Design Principles

1. **Pure functions only**: Every exported function is a pure mathematical mapping from inputs to outputs. No global state, no caching, no mutation.

2. **f64 throughout**: All intermediate and output values use IEEE 754 double-precision floating point, providing approximately 15 significant decimal digits. This exceeds the required accuracy for all FindMyStar computations.

3. **Fail explicitly**: Functions that can encounter domain errors (e.g., `acos` of a value outside [-1, 1] due to floating-point drift) clamp inputs and document the clamping. No panics cross the FFI boundary; errors are returned as sentinel values or status codes.

4. **Unit-tested in isolation**: The engine's test suite runs with `cargo test` in under 5 seconds, with no emulator, no device, and no network. Validation tests compare outputs against USNO and JPL Horizons reference data.

5. **Minimal dependencies**: The only external crate is `nalgebra` for optimized linear algebra primitives. No I/O crates, no async runtimes, no serialization libraries.

---

## 6. Dependencies

| Crate | Version | Purpose | Size Impact |
|-------|---------|---------|-------------|
| `nalgebra` | 0.32+ | Vectors, matrices, quaternions | ~200KB compiled |
| `libm` | 0.2+ | Portable math functions (no_std) | ~20KB compiled |

No other dependencies. The engine builds with `#![no_std]` support for embedded or WASM targets when the `std` feature is disabled.

---

## 7. Build Targets

### Native Libraries

```bash
# iOS (arm64)
cargo build --release --target aarch64-apple-ios

# Android (arm64)
cargo build --release --target aarch64-linux-android

# Android (armv7, legacy devices)
cargo build --release --target armv7-linux-androideabi
```

### WebAssembly

```bash
# Browser / CI testing
cargo build --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/findmystar_core.wasm --out-dir pkg/
```

### Binary Size

| Target | Unstripped | Stripped | Compressed |
|--------|-----------|---------|------------|
| aarch64-apple-ios | ~4.2 MB | ~1.8 MB | ~600 KB |
| aarch64-linux-android | ~3.8 MB | ~1.6 MB | ~550 KB |
| wasm32-unknown-unknown | ~1.2 MB | N/A | ~400 KB |

---

## 8. Cross-References

- **[Core Astronomical Algorithms](./algorithms.md)** -- Complete pseudocode and mathematical formulations for every computation
- **[Ephemeris Computation](./ephemeris.md)** -- Sun, Moon, planet, and star position algorithms
- **[Coordinate Transforms](./coordinate-transforms.md)** -- RA/Dec, Alt/Az, and device frame conversions
- **[Rise/Set Calculations](./rise-set-calculations.md)** -- Analytical and iterative rise/set solvers
- **[Vector Mathematics](./vector-math.md)** -- 3D vectors, quaternions, angular distance
- **[Validation Strategy](./validation.md)** -- Reference data sources and acceptance criteria
- **[Error Bounds](./error-bounds.md)** -- Accuracy analysis and error propagation
- **[ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md)** -- Decision rationale for Rust
- **[Architecture Overview](../03-architecture/architecture-overview.md)** -- System-level architecture context

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
