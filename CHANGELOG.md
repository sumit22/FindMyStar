# Changelog

All notable changes to FindMyStar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

**Rust Core Engine**
- Vector3, Quaternion math with zero-vector safety guards
- Julian Date / Sidereal Time conversions (IAU polynomial)
- RA/Dec to Alt/Az coordinate transforms
- Sun position (simplified Meeus model, <5 arcmin accuracy)
- Moon position (6-term principal model, ~1-5 degree accuracy)
- Planet positions (Keplerian orbital elements, 7 planets)
- Star catalog (500+ stars from Hipparcos, mag < 5.0)
- Analytical rise/set for stars with atmospheric refraction (h0=-0.5667)
- Iterative rise/set for planets/Moon (48h scan + binary search to <60s)
- Circumpolar detection and twilight classification
- FFI exports (19 extern "C" functions with panic containment)
- Validation test suite (28 tests against USNO/JPL/SOFA/Hipparcos)
- Edge case test suite (polar latitudes, extreme dates, NaN safety)
- Performance benchmarks (core computations)

**SQLite Catalog Database (~620 objects)**
- Solar system: Sun, Moon, 8 planets
- Stars: ~500 brightest (Hipparcos mag < 5.0) with proper names
- Messier catalog: 110 deep-sky objects (nebulae, galaxies, clusters)
- Schema with indexes, foreign keys, CHECK constraints, WAL mode

**React Native Mobile App (iOS 14+ / Android 10+)**
- Search screen with debounced catalog search and type icons
- Object info screen with 1Hz alt/az position updates
- AR tracking screen with directional arrow and lock detection
- Alarms screen with toggle, long-press delete, pull-to-refresh
- Settings screen (theme, notifications, altitude threshold)
- Dark/Light/System theme support with status bar adaptation
- Zustand state management (catalog, tracking, preferences)
- AsyncStorage persistence for user preferences
- Deep link handling for notification taps (cold + warm start)
- Background midnight recalculation with foreground fallback

**Native Bridge Modules**
- Android: Kotlin AstronomyBridgeModule with JNI + System.loadLibrary
- iOS: Swift AstronomyBridge with C ABI + ObjC RCT_EXTERN macros

**TypeScript Service Layer**
- VisibilityService (rise/set, current alt/az, twilight state)
- ObjectTrackingService (30+ FPS loop, lock detection with hysteresis)
- AlarmScheduler (CRUD, OS notifications, recalculation)
- LocationService (GPS, timeout, fallback, permission handling)
- SensorFusionService (complementary filter, 30+ Hz)
- BackgroundTask (midnight recalculation, AppState listener)

**CI/CD Pipeline**
- Rust checks (fmt, clippy, test, security audit)
- TypeScript checks (ESLint, Prettier, tsc, Jest, npm audit)
- Mobile builds (Android debug APK, iOS simulator)
- Nightly validation at 03:00 UTC
- Weekly security audit (Mondays 06:00 UTC)
- Release workflow with Android AAB + iOS archive artifacts

**Testing Infrastructure**
- Detox E2E tests (search/track flow, alarm flow)
- Performance E2E benchmarks (search latency, navigation timing)
- Offline verification tests (airplane mode)
- Battery usage test framework
- Edge case test suite (polar latitudes, extreme dates, NaN safety)
- Release checklist script with automated verification

---

## Notes on Version Numbering

- **MAJOR**: Breaking architectural changes, incompatible data schemas
- **MINOR**: New features, new objects, new capabilities (backward compatible)
- **PATCH**: Bug fixes, performance improvements, documentation updates

## Compatibility

### Minimum Supported Versions
- **iOS**: 14.0+
- **Android**: 10.0+ (API 29)
- **React Native**: 0.78+
- **Rust**: 1.70.0+
