# Design Principles

This document defines the architectural principles, design patterns, and constraints that govern the FindMyStar system. All contributors must adhere to these principles when adding or modifying functionality.

> **Related Documents**: [Architecture Overview](./architecture-overview.md) | [ADR-0001: Layered Architecture](../11-adr/0001-layered-architecture.md) | [ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md) | [ADR-0003: Offline-First](../11-adr/0003-offline-first.md)

---

## 1. Core Principles

### 1.1 Layered Architecture

FindMyStar enforces a **strict 4-layer architecture** with clear boundaries:

```
Presentation  (React Native)   ─ How to display
Application   (TS Services)    ─ When to compute, what to orchestrate
Domain        (Rust Core)      ─ Why the math works, what results mean
Data          (SQLite)         ─ Where information lives
```

**Rules**:

- **Data flows downward**: Presentation calls Application, Application calls Domain, Domain reads Data.
- **Dependencies point upward**: Each layer depends only on the layer directly below it.
- **No layer bypassing**: The Presentation layer must never call the Rust core directly; it always goes through Application services.
- **No upward dependencies**: The Domain layer has zero knowledge of the Application or Presentation layers.

Violating layer boundaries introduces coupling and makes isolated testing impossible. See [ADR-0001](../11-adr/0001-layered-architecture.md) for the full rationale.

### 1.2 Domain-Driven Design

The Rust core engine is the **autonomous heart** of FindMyStar:

- **Self-contained**: Contains 100% of astronomical computation (ephemeris, coordinate transforms, rise/set solving, vector math, quaternion operations).
- **Deterministic**: Given the same inputs, always produces the same outputs. No randomness, no hidden state, no timing dependencies.
- **No I/O**: The domain layer performs zero file reads, network calls, or system interactions. All data enters via function parameters and exits via return values.
- **Independently testable**: `cargo test --lib` validates the entire domain without a mobile emulator, database, or sensor hardware.
- **Reusable**: The same compiled library serves Android (JNI), iOS (C ABI), and optionally Web (WASM) without modification.

This design enables scientific validation against reference ephemeris data (USNO, JPL Horizons) and potential publication as a standalone astronomical library.

### 1.3 Offline-First

FindMyStar operates with **zero backend dependencies**:

- No API calls, no cloud services, no account management.
- All celestial catalogs ship bundled within the application (~10-20 MB).
- Notifications are scheduled through OS-native services (WorkManager on Android, UNUserNotificationCenter on iOS).
- User data (tracked objects, preferences) persists in local SQLite.

Every proposed feature must pass the **offline test**: "Does this work in airplane mode, in a remote field, with zero connectivity?" If the answer is no, the feature is deferred to a future phase. See [ADR-0003](../11-adr/0003-offline-first.md) for the full decision record.

### 1.4 Deterministic Computation

The domain engine guarantees **reproducibility**:

- Same celestial object + same observer location + same timestamp = identical altitude/azimuth output.
- No reliance on random number generators, wall-clock timing, or mutable global state.
- Floating-point operations are performed in f64 (double precision) with explicit clamping to prevent NaN propagation.
- This determinism enables regression testing: a test that passes today must pass identically tomorrow, given the same inputs.

### 1.5 Separation of Concerns

Each layer has a **single, well-defined responsibility**:

| Layer | Responsibility | Must NOT Do |
|-------|---------------|-------------|
| **Presentation** | Render UI, handle gestures, display AR overlay | Compute astronomy, query database directly |
| **Application** | Orchestrate services, fuse sensors, schedule alarms | Render UI, perform raw math |
| **Domain** | Compute positions, transforms, rise/set times | Access files, sensors, or network |
| **Data** | Persist objects, read catalog, manage schema | Contain business logic or UI code |

This separation ensures that a bug in sensor fusion never corrupts the ephemeris engine, and a UI redesign never requires touching the astronomical algorithms.

---

## 2. SOLID Principles Applied

### 2.1 Single Responsibility Principle (SRP)

Every module, service, and struct has **one reason to change**:

| Component | Single Responsibility |
|-----------|----------------------|
| `EphemerisModule` | Compute RA/Dec for a given object and time |
| `CoordinateTransforms` | Convert between equatorial, horizontal, and Cartesian systems |
| `RiseSetSolver` | Determine when an object crosses the horizon |
| `ObjectTrackingService` | Orchestrate the real-time tracking loop |
| `AlarmScheduler` | Interface with OS notification APIs |
| `CatalogRepository` | Execute SQLite queries against the objects table |

If a module needs to do two things, it should be split into two modules.

### 2.2 Open/Closed Principle (OCP)

The system is **open for extension** but **closed for modification**:

- Adding a new object type (e.g., satellites, comets) means adding a new ephemeris computation module, not modifying the existing star or planet engines.
- Adding telescope integration means adding a new `TelescopeControlService` in the Application layer, not modifying `ObjectTrackingService`.
- The Rust FFI bridge exposes a stable public API. New functions are added; existing functions are never changed in incompatible ways.

### 2.3 Liskov Substitution Principle (LSP)

Service interfaces allow **swapping implementations** without breaking callers:

- `CatalogRepository` can be backed by SQLite in production or an in-memory store in tests.
- `SensorFusionService` can consume real IMU data or synthetic test fixtures.
- The rise/set solver accepts any object that provides RA/Dec at a given time, whether that value is fixed (stars) or computed (planets).

Any implementation that satisfies the interface contract must produce correct behavior when substituted.

### 2.4 Interface Segregation Principle (ISP)

Each layer exposes a **minimal public API**:

- The Rust core exports only the functions needed by the Application layer (approximately 8-12 FFI functions), not the hundreds of internal helper functions.
- Application services expose only the methods needed by the Presentation layer.
- The `CatalogRepository` exposes `findByName()`, `findByType()`, and `getById()`, not raw SQL access.

Clients should never be forced to depend on methods they do not use.

### 2.5 Dependency Inversion Principle (DIP)

High-level modules depend on **abstractions, not concretions**:

- The `ObjectTrackingService` depends on an `AstronomyEngine` interface, not on the concrete Rust FFI bindings.
- The `AlarmScheduler` depends on a `NotificationProvider` interface, not directly on WorkManager or UNUserNotificationCenter.
- The `VisibilityService` depends on a `LocationProvider` interface, not on platform-specific GPS APIs.

This inversion enables platform-agnostic testing and future migration to alternative implementations.

---

## 3. Design Patterns Used

### 3.1 Repository Pattern

**Where**: `CatalogRepository`, `TrackedObjectRepository`

The Repository pattern abstracts data access behind a domain-oriented interface. The Application layer calls `repository.findByName("Sirius")` without knowing whether the underlying store is SQLite, an in-memory cache, or a test fixture.

```typescript
interface CatalogRepository {
  findByName(query: string): Promise<CelestialObject[]>;
  findByType(type: ObjectType): Promise<CelestialObject[]>;
  getById(id: number): Promise<CelestialObject | null>;
}
```

### 3.2 Service Layer Pattern

**Where**: `ObjectTrackingService`, `VisibilityService`, `AlarmScheduler`, `SensorFusionService`

Application services encapsulate use-case orchestration. Each service coordinates between the domain engine, repositories, and platform integrations without containing domain logic itself.

```typescript
class VisibilityService {
  computeNextVisible(object: CelestialObject, location: Location): RiseSetResult {
    const raDec = this.engine.computeRaDec(object.id, now());
    const altAz = this.engine.raDecToAltAz(raDec, location);
    return this.engine.computeRiseTime(object, location);
  }
}
```

### 3.3 Observer Pattern

**Where**: Sensor callbacks, state change notifications

Device sensors (GPS, IMU, magnetometer) deliver data asynchronously. The Application layer registers callbacks that fire when new sensor readings arrive, triggering position recomputation without polling.

```typescript
sensorManager.onOrientationUpdate((quaternion) => {
  trackingService.updateDeviceOrientation(quaternion);
});
```

### 3.4 Strategy Pattern

**Where**: Rise/set calculation algorithms

The rise/set solver selects between two strategies based on object type:

- **Analytical strategy** (stars): Uses the closed-form Hour Angle formula `cos(H0) = -tan(lat) * tan(dec)` for instant results.
- **Iterative strategy** (planets, Sun, Moon): Scans a 48-hour window in 5-minute increments with binary search refinement, accounting for changing RA/Dec.

The caller does not need to know which strategy is used; the solver selects automatically based on the object's type.

### 3.5 Factory Pattern

**Where**: Ephemeris engine per object type

Different celestial object types require different ephemeris computation methods:

| Object Type | Ephemeris Method |
|-------------|-----------------|
| Stars | Fixed RA/Dec from catalog (with optional precession) |
| Sun | Simplified solar position formula or VSOP87 |
| Moon | Lunar position algorithm (Brown's theory simplified) |
| Planets | VSOP87 truncated series |

A factory function selects the appropriate computation path based on `ObjectType`, ensuring each engine handles only the objects it understands.

---

## 4. Anti-Patterns Avoided

### 4.1 God Object

No single class or module is permitted to accumulate responsibilities from multiple layers. If a service begins handling both sensor fusion and database queries, it must be split.

**Enforcement**: Code review checklist requires that every module maps to exactly one box in the [architecture diagram](./architecture-overview.md).

### 4.2 Circular Dependencies

Layer dependencies are strictly unidirectional:

```
Presentation --> Application --> Domain
                             --> Data
```

The Domain layer never imports from Application or Presentation. The Data layer never imports from Presentation. Circular dependencies between modules within the same layer are also prohibited.

**Enforcement**: The Rust compiler enforces module visibility. TypeScript linting rules prevent import cycles.

### 4.3 Leaky Abstractions

Internal implementation details must not bleed across layer boundaries:

- The Application layer does not expose SQLite row IDs to the Presentation layer; it returns domain objects.
- The Rust core does not return raw pointer types through FFI; it returns plain numeric arrays and status codes.
- Error messages from the Domain layer are translated into user-facing text by the Presentation layer, never displayed verbatim.

### 4.4 Premature Optimization

Performance optimizations are applied only when profiling data justifies them:

- The tracking loop targets 30 FPS. Rust achieves <10ms per frame, well within budget.
- Rise/set calculations target <500ms. The iterative solver completes in <100ms.
- Optimizations that sacrifice code clarity are deferred until benchmarks prove necessity.

### 4.5 Feature Creep Beyond Offline Scope

Any feature that requires network connectivity, cloud storage, or user accounts is categorically excluded from the MVP. This prevents architectural drift toward a client-server model that contradicts the offline-first principle.

---

## 5. Cross-Cutting Concerns

### 5.1 Error Handling

- **Rust core**: Returns `Result<T, E>` types. Every error path is explicit. No panics in library code.
- **Application layer**: Catches Rust errors at the FFI boundary and maps them to domain-specific error types.
- **Presentation layer**: Displays user-friendly messages with actionable guidance (e.g., "Magnetometer needs calibration -- wave your phone in a figure-8 pattern").

### 5.2 Logging and Diagnostics

- **Rust core**: Zero logging in release builds. Debug builds may emit trace-level output.
- **Application layer**: Structured logging for service lifecycle events (tracking started, alarm scheduled, sensor calibration).
- **Presentation layer**: Error boundary components catch and report rendering failures.

### 5.3 Performance Budgets

All components must meet the performance targets defined in the [Architecture Overview](./architecture-overview.md):

| Operation | Budget |
|-----------|--------|
| AR frame computation | < 20 ms |
| Rise/set calculation | < 500 ms |
| Touch response | < 200 ms |
| App memory usage | < 100 MB |

---

## 6. Summary

These principles are not aspirational guidelines; they are **architectural constraints** that every contributor must follow. When in doubt:

1. Does this change respect layer boundaries?
2. Does this feature work offline?
3. Is the domain logic deterministic and free of I/O?
4. Does each module have exactly one responsibility?

If all four answers are yes, the change is architecturally sound.

---

**Last Updated**: February 2026
