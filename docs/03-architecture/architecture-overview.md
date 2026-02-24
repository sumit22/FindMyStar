# System Architecture Overview

## 1. Architecture Principles

FindMyStar follows these core architectural principles:

### 1.1 Layered Architecture

The system is organized in **4 strict layers**:

```
┌─────────────────────────────────┐
│    Presentation Layer           │  UI Components
│    (React Native / Flutter)     │  State Management
├─────────────────────────────────┤
│    Application Layer            │  Business Logic Orchestration
│    (Services & Controllers)     │  Event Handling
├─────────────────────────────────┤
│    Domain Layer (Rust Core)     │  Pure Math & Astronomy
│    (Ephemeris, Transforms)      │  No I/O or Side Effects
├─────────────────────────────────┤
│    Data Layer                   │  SQLite, File I/O
│    (Repository Pattern)         │  Persistence
└─────────────────────────────────┘
```

**Key Principle**: Data flows DOWN, dependencies point UP. Never bypass layers.

### 1.2 Domain-Driven Design

The **Domain Layer** (Rust) is treated as an autonomous, independently testable module:

- Contains 100% of astronomical algorithms
- Zero knowledge of UI or persistence
- Deterministic (no randomness)
- Fully unit tested in isolation
- Compiled as native library or WASM

This enables:
- ✅ Testing algorithms without mobile emulator
- ✅ Reusing domain logic for future platforms
- ✅ Profiling and optimizing core engine
- ✅ Publishing as scientific library

### 1.3 Offline-First Design

All features must work without internet:

- ✅ No backend API calls
- ✅ All catalogs bundled locally
- ✅ Notifications via OS only
- ✅ Data stored in SQLite

### 1.4 Deterministic Computation

The domain engine produces **identical results** given identical inputs:

- Same input → same RA/Dec → reproducible
- No randomness or floating-point surprises
- Enables test-driven validation against known ephemeris

---

## 2. System Architecture Diagram

### C4 Model - Level 1 (Containers)

```
┌─────────────────────────────────────────────────────────────┐
│                      End User (Mobile)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Touches screen
                         │
        ┌────────────────┴─────────────────┐
        │                                  │
   ┌────▼─────────┐            ┌──────────▼────────┐
   │   Android    │            │       iOS         │
   │   Container  │            │    Container      │
   │              │            │                   │
   │ ┌──────────┐ │            │ ┌──────────────┐  │
   │ │ React    │ │            │ │ React Native │  │
   │ │ Native   │ │            │ │ / Flutter    │  │
   │ │ + ARCore │ │            │ │ + ARKit      │  │
   │ └────┬─────┘ │            │ └────┬─────────┘  │
   │      │       │            │      │            │
   │      │ Calls │            │      │ Calls      │
   │      ▼       │            │      ▼            │
   │ ┌──────────┐ │            │ ┌──────────────┐  │
   │ │Native    │ │            │ │ Native       │  │
   │ │Module    │ │            │ │ Module       │  │
   │ │(Rust)    │ │            │ │ (Rust)       │  │
   │ └──────────┘ │            │ └──────────────┘  │
   └──────────────┘            └───────────────────┘
        │                             │
        │      SQLite DB              │
        │      (Device Storage)       │
        │      Notifications          │
        │      (OS System)            │
        │
        Isolated, Offline, Deterministic
```

### Key Containers

1. **Mobile App** (React Native / Flutter)
   - Presentation: Search, AR, Info screens
   - State management: Redux/Provider/Riverpod
   - Sensor integration: GPS, IMU fusion

2. **Rust Domain Engine** (Compiled to native/WASM)
   - Ephemeris computation
   - Coordinate transformations
   - Rise/set calculation
   - Vector mathematics

3. **SQLite Database** (Local device storage)
   - Object catalog
   - Tracked alarms
   - User preferences

4. **OS Services** (System integration)
   - Notifications
   - Location services
   - Device orientation sensors
   - Background tasks

---

## 3. Module Organization

```
/core (Rust)
├── /math              - Vector operations, quaternions
├── /ephemeris         - RA/Dec computation (Sun, Moon, Planets, Stars)
├── /coordinates       - Coordinate system transformations
├── /visibility        - Rise/set, altitude, circumpolar logic
├── /validation        - Ephemeris validation helpers
└── lib.rs             - Public API

/mobile (TS/Dart)
├── /ui
│   ├── /screens       - SearchScreen, ARScreen, InfoScreen, AlarmScreen
│   ├── /components    - Reusable UI components
│   └── /state         - State management (Redux/Provider)
├── /services
│   ├── ObjectTrackingService    - Tracking orchestration
│   ├── VisibilityService         - Rise/set + alarm logic
│   ├── AlarmScheduler            - OS notifications
│   ├── SensorFusionService       - Device orientation
│   └── CatalogRepository         - SQL queries
├── /domain            - TypeScript domain models (mirrors Rust)
└── /config            - App configuration

/db
├── schema.sql         - SQLite schema
└── migrations/        - Schema versions

/tests
├── /unit              - Pure function tests
├── /integration       - End-to-end flows
└── /validation        - Ephemeris test data
```

---

## 4. Data Flow

### Object Tracking Flow (Real-Time)

The tracking service uses **two computation paths** based on the object type:

```
Device Sensors (30 FPS)
    │
    ├─ GPS → Current Location (lat, lon)
    ├─ Gyroscope → Device Orientation (quaternion)
    ├─ System Clock → Current Time (UTC)
    │
    ▼
SensorFusionService
    │ Fuses IMU data → Q_device
    │
    ▼
ObjectTrackingService.trackingLoop()
    │
    ├─ [Engine Path: Sun/Moon/Planets]
    │   Core.computeTracking(objectType, objectId, lat, lon, unixMs)
    │   └─ Rust ephemeris → RA/Dec → Alt/Az → direction vector
    │
    ├─ [RA/Dec Path: Stars/Deep-sky]
    │   Core.computeTrackingRaDec(ra, dec, lat, lon, unixMs)
    │   └─ Fixed J2000 coords from DB → Alt/Az → direction vector
    │
    └─ Returns: { altitude, azimuth, direction: {x, y, z} }
    │
    ▼
ARScreen.render()
    │ Displays arrow, distance, lock state
    │
    ▼
User sees guidance
```

### Visibility & Alarm Flow (Periodic)

```
User Sets Alarm for Object
    │
    ▼
AlarmScreen.setAlarm(object)
    │
    ▼
VisibilityService.getNextVisibleTime(object, location)
    │
    ├─ [Engine Path: Sun/Moon/Planets]
    │   Core.computeRiseSet(objectType, objectId, lat, lon, startMs)
    │
    ├─ [RA/Dec Path: Stars/Deep-sky]
    │   Core.computeRiseSetRaDec(ra, dec, lat, lon, startMs)
    │
    ├─ RiseSetSolver.computeRiseTime()
    │   └─ Analytical solution (H0 formula)
    │
    └─ Checks sun altitude at rise time
       (Only notify if twilight conditions met)
    │
    ▼
AlarmScheduler.schedule(object, nextRiseTime)
    │
    └─ Save to SQLite + Schedule OS notification
    │
    ▼
[Daily recalculation at midnight via WorkManager / background task]
    │
    ▼
User receives local notification
```

---

## 5. Technology Stack

## **Frontend**
- **Framework**: React Native (cross-platform) or Flutter (if Android/iOS specific)
- **AR**: ARCore (Android), ARKit (iOS)
- **State Management**: Redux (React Native) / Riverpod (Flutter)
- **Networking**: None (fully offline)
- **Database**: SQLite3
- **Notifications**: WorkManager (Android), UNUserNotificationCenter (iOS)

## **Backend (Domain Engine)**
- **Language**: Rust
- **Math Library**: `nalgebra` (linear algebra, quaternions, vectors)
- **Target**: Native library + optional WASM
- **No external dependencies**: Pure standard library + nalgebra

## **Offline Data**
- **Star Catalog**: Hipparcos (120k stars, ~3-5MB compressed)
- **Planets**: VSOP87 coefficients (~1MB)
- **Deep Sky**: Messier objects (~100KB)
- **Total**: ~10-20MB app size

---

## 6. Key Design Decisions

### 6.1 Why Layered Architecture?

✅ **Testability**: Domain logic independent of UI  
✅ **Reusability**: Rust core usable across platforms  
✅ **Scalability**: Easy to add telescope control layer later  
✅ **Maintainability**: Clear responsibility boundaries  

### 6.2 Why Rust for Domain?

✅ **Performance**: No GC, suitable for real-time  
✅ **Safety**: Eliminates entire classes of bugs  
✅ **Correctness**: Strong type system for astronomy logic  
✅ **Portability**: Compile to native + WASM  

### 6.3 Why Offline-First?

✅ **Privacy**: Zero data collection  
✅ **Reliability**: Works everywhere  
✅ **Simplicity**: No backend infrastructure  
✅ **Speed**: No network latency  

---

## 7. Integration Points

### Mobile UI ↔ Rust Core

The TypeScript wrapper (`FindMyStarCore.ts`) exposes two computation paths:

```typescript
// Engine path: objectType/objectId → alt/az/direction (Sun/Moon/Planets)
computeTracking(objectType, objectId, lat, lon, unixMs): TrackingResult
computeRiseSet(objectType, objectId, lat, lon, startMs): RiseSetResult

// RA/Dec path: raw coordinates → alt/az/direction (Stars/Deep-sky from DB)
computeTrackingRaDec(ra, dec, lat, lon, unixMs): TrackingResult
computeRiseSetRaDec(ra, dec, lat, lon, startMs): RiseSetResult

// Utilities
raDecToAltAz(ra, dec, lat, lon, unixMs): AltAz
altAzToVector3(altitude, azimuth): Vector3
angularDistance(v1, v2): number
classifyTwilight(sunAltitude): number
```

### Sensor Input ↔ Application Layer

```
IMU Data → SensorFusionService → Q_device (quaternion)
GPS Data → LocationService → {lat, lon}
Time → System clock → milliseconds since epoch
```

### OS Integration

```
OS Notification Service
  ← AlarmScheduler.schedule(nextVisibleTime)
  ← WorkManager backup trigger

OS Background Task
  ← Daily alarm recalculation at midnight
```

---

## 8. Error Handling Strategy

| Error | Handling |
|-------|----------|
| GPS unavailable | Use last known location, show warning |
| Poor device orientation | Magnetometer calibration prompt |
| System time skewed | Display time sync warning |
| Object not found | "No results" message, suggest close matches |
| Computation overflow | Display error, use fallback values |

---

## 9. Future Extension Points

The architecture supports future additions:

### Phase 2: Satellite Tracking
- New `SatelliteEphemerisEngine` module
- TLE data (requires periodic update mechanism)
- Real-time orbital propagation (SGP4)

### Phase 3: Telescope Integration
- New `TelescopeControlService`
- LX200 protocol handler
- Doesn't affect domain engine

### Phase 4: Astrophotography
- New `FramingService`
- Camera sensor databases
- Polar alignment assistant

**Key**: All extensions layer on top without modifying core.

---

## 10. Performance Targets

| Operation | Target | Current Estimate |
|-----------|--------|------------------|
| AR Frame Rate | 30 FPS | ✅ 60+ FPS |
| Position Computation | <20ms | ✅ <10ms (Rust) |
| Rise/Set Calculation | <500ms | ✅ <100ms |
| Touch Response | <200ms | ✅ <100ms |
| Memory Usage | <100MB | ✅ ~50-80MB |
| Battery (AR Mode) | <10%/hour | ✅ ~5-8%/hour |

---

**Architecture Status**: Approved  
**Last Updated**: February 2026  
**Version**: 1.0
