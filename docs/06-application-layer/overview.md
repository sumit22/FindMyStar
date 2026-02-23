# Application Layer Overview

## 1. Purpose and Responsibilities

The Application Layer is the orchestration tier of the FindMyStar architecture. It sits
between the Presentation Layer (React Native UI) and the Domain Layer (Rust core engine)
plus the Data Layer (SQLite). Its primary responsibilities are:

- **Orchestrate domain computations**: Translate UI intents into sequences of domain engine
  calls, combining results from multiple sources (ephemeris, sensors, time) into coherent
  outputs for the Presentation Layer.
- **Manage application state**: Maintain the Redux store structure, ensuring state
  transitions are predictable and observable by the UI.
- **Coordinate services**: Ensure services start, stop, and communicate in the correct
  order based on application lifecycle and user actions.
- **Abstract platform differences**: Shield the Presentation Layer from Android/iOS
  differences in sensor APIs, notification scheduling, and background task management.
- **Enforce offline-first constraints**: All service operations execute locally with no
  network dependencies, per [ADR-0003](../11-adr/0003-offline-first.md).

The Application Layer contains **zero UI code** and **zero astronomical math**. It is
purely procedural glue that answers *when* and *what* to compute, delegating *how* to the
Domain Layer and *where* to persist to the Data Layer.

---

## 2. Dependency Direction

Dependencies follow the strict layered architecture defined in
[ADR-0001](../11-adr/0001-layered-architecture.md):

```
┌─────────────────────────────────────┐
│  Presentation Layer                 │  Depends on Application Layer
│  (React Native screens, components) │  via hooks and dispatchers
├─────────────────────────────────────┤
│  Application Layer                  │  Depends on Domain + Data
│  (TypeScript services)              │  NEVER depends on Presentation
├─────────────────────────────────────┤
│  Domain Layer (Rust core engine)    │  Depends on nothing
│  Data Layer (SQLite repositories)   │  Depends on nothing
└─────────────────────────────────────┘
```

**Rules**:

1. The Application Layer imports from the Domain Layer (via FFI bridge) and the Data Layer
   (via repository interfaces). It never imports from the Presentation Layer.
2. The Presentation Layer accesses the Application Layer through Redux actions, selectors,
   and service hooks. It never calls the Domain Layer or Data Layer directly.
3. Services within the Application Layer may depend on each other, but circular
   dependencies are prohibited.
4. All inter-layer data is passed as plain immutable objects (no class instances across
   boundaries).

---

## 3. Service Architecture

### 3.1 Service Dependency Graph

```
ObjectTrackingService ────→ EphemerisEngine (Rust FFI)
                      ────→ SensorFusionService
                      ────→ LocationService
                      ────→ CatalogRepository

VisibilityService ────────→ EphemerisEngine (Rust FFI)
                  ────────→ CatalogRepository
                  ────────→ LocationService

AlarmScheduler ───────────→ VisibilityService
              ───────────→ CatalogRepository
              ───────────→ OS Notification APIs (Android/iOS)

SensorFusionService ──────→ Device IMU Sensors (platform-specific)
                    ──────→ Magnetometer APIs

CatalogRepository ────────→ SQLite Database

LocationService ──────────→ Device GPS APIs (platform-specific)
```

### 3.2 Service Summary

| Service                | Role                              | Update Rate  | Stateful |
|------------------------|-----------------------------------|-------------|----------|
| ObjectTrackingService  | Real-time AR tracking loop        | 30+ Hz      | Yes      |
| VisibilityService      | Rise/set and visibility checks    | On demand   | No       |
| AlarmScheduler         | OS notification management        | Daily + ad hoc | Yes   |
| SensorFusionService    | Device orientation from IMU       | 30+ Hz      | Yes      |
| CatalogRepository      | SQLite catalog and alarm queries  | On demand   | Cached   |
| LocationService        | GPS location management           | 1/min or ad hoc | Yes  |

Full interface definitions and method signatures are documented in
[services.md](./services.md).

---

## 4. Service Registry and Dependency Injection

Services are instantiated at application boot and registered in a lightweight service
container. FindMyStar uses **constructor injection** for testability:

```typescript
// ServiceContainer: instantiated once at app startup
export class ServiceContainer {
  private static instance: ServiceContainer;

  readonly locationService: ILocationService;
  readonly sensorFusionService: ISensorFusionService;
  readonly catalogRepository: ICatalogRepository;
  readonly visibilityService: IVisibilityService;
  readonly objectTrackingService: IObjectTrackingService;
  readonly alarmScheduler: IAlarmScheduler;

  private constructor() {
    // Instantiation order respects dependency graph (leaf services first)
    this.locationService = new LocationService();
    this.sensorFusionService = new SensorFusionService();
    this.catalogRepository = new CatalogRepository(db);

    this.visibilityService = new VisibilityService(
      this.catalogRepository,
      this.locationService
    );

    this.objectTrackingService = new ObjectTrackingService(
      this.sensorFusionService,
      this.locationService,
      this.catalogRepository
    );

    this.alarmScheduler = new AlarmScheduler(
      this.visibilityService,
      this.catalogRepository
    );
  }

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }
}
```

For unit testing, each service accepts its dependencies as constructor parameters
(interfaces, not concrete classes), enabling mock injection:

```typescript
// Test example
const mockSensor = createMock<ISensorFusionService>();
const mockLocation = createMock<ILocationService>();
const service = new ObjectTrackingService(mockSensor, mockLocation, mockCatalog);
```

---

## 5. Lifecycle Management

### 5.1 Application Startup

On cold start, services are initialized in dependency order:

```
1. SQLite database connection opened
2. CatalogRepository initialized, integrity check executed
3. LocationService started (request last known location)
4. SensorFusionService initialized (registers IMU listeners)
5. VisibilityService ready (stateless, no initialization needed)
6. ObjectTrackingService ready (inactive until user selects object)
7. AlarmScheduler loaded (reads pending alarms from SQLite)
8. Redux store hydrated from persisted state
```

**Startup budget**: < 2 seconds total. Database integrity check is the bottleneck
(~200ms). If integrity check fails, the bundled backup catalog is restored.

### 5.2 Foreground / Background Transitions

| Event              | Actions                                                     |
|--------------------|-------------------------------------------------------------|
| App → Background   | SensorFusionService.stop(), ObjectTrackingService.stop(),   |
|                    | LocationService reduces to passive mode                     |
| App → Foreground   | SensorFusionService.start(), LocationService resumes active |
|                    | mode, AlarmScheduler checks for missed triggers             |
| App → Terminated   | All sensor listeners unregistered, database connection       |
|                    | closed gracefully, pending state persisted to Redux store   |

### 5.3 Background Tasks

The AlarmScheduler registers a daily background task via:
- **Android**: WorkManager (periodic, ~24h interval, flex window)
- **iOS**: BGTaskScheduler (BGAppRefreshTask + BGProcessingTask)

The background task calls `AlarmScheduler.recalculateAll()` to update rise/set times
for all tracked objects and reschedule OS notifications.

---

## 6. State Management

### 6.1 Redux Store Structure

The Application Layer owns the following Redux slices:

```typescript
interface AppState {
  tracking: {
    isActive: boolean;
    targetObjectId: string | null;
    currentResult: TrackingResult | null;
    accuracy: number;         // 0.0 - 1.0, sensor confidence
    needsCalibration: boolean;
  };
  location: {
    current: Location | null;
    lastUpdated: number;      // timestamp
    accuracy: number;         // meters
    isAvailable: boolean;
  };
  alarms: {
    items: Alarm[];
    nextAlarm: Alarm | null;
    lastRecalculated: number; // timestamp
    isRecalculating: boolean;
  };
  catalog: {
    recentSearches: string[];
    trackedObjects: TrackedObject[];
  };
  errors: {
    activeErrors: AppError[];
    dismissedErrors: string[]; // error IDs
  };
}
```

### 6.2 Data Flow

```
User Action (Presentation)
    │
    ▼
Redux Action dispatched
    │
    ▼
Thunk middleware calls Application Service method
    │
    ▼
Service orchestrates Domain Engine + Data Layer
    │
    ▼
Service returns result
    │
    ▼
Redux reducer updates store
    │
    ▼
React component re-renders via selector
```

Services themselves do not read or write Redux state directly. The Presentation Layer
dispatches thunks that call service methods and then dispatch result actions. This keeps
services framework-agnostic and testable without a Redux dependency.

---

## 7. Error Handling Approach

The Application Layer uses a **layered error strategy**:

1. **Domain errors** (from Rust FFI): Caught at the bridge boundary, converted to typed
   TypeScript errors. See [api-contracts.md](./api-contracts.md) for the error protocol.
2. **Service errors**: Each service method declares its error cases. Callers receive typed
   error results, never raw exceptions.
3. **Infrastructure errors** (sensor unavailable, DB failure): Caught within the service,
   fallback behavior applied, error event dispatched.

Full error taxonomy and recovery strategies are documented in
[error-handling.md](./error-handling.md).

---

## 8. Performance Constraints

| Constraint                        | Target        | Rationale                        |
|-----------------------------------|---------------|----------------------------------|
| Tracking loop latency             | < 5ms/cycle   | 30+ FPS AR experience            |
| Rise/set computation              | < 100ms       | Responsive info screen           |
| Catalog search                    | < 50ms        | Real-time search-as-you-type     |
| Alarm recalculation (all alarms)  | < 2s          | Background task time budget      |
| Service initialization            | < 500ms each  | Cold start under 2s total        |
| Memory overhead (all services)    | < 20MB        | Leave headroom for UI + Rust     |

Performance is achieved by delegating heavy computation to the Rust engine (native code,
no GC) and caching frequently accessed data in the CatalogRepository.

---

## 9. Cross-References

| Document                                                        | Relevance                              |
|-----------------------------------------------------------------|----------------------------------------|
| [Architecture Overview](../03-architecture/architecture-overview.md) | System-level design and data flows |
| [ADR-0001: Layered Architecture](../11-adr/0001-layered-architecture.md) | Why 4 layers              |
| [ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md) | Why Rust for domain                  |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md)     | No backend constraint                  |
| [Application Services](./services.md)                          | Full interface definitions             |
| [API Contracts](./api-contracts.md)                             | Rust-TypeScript FFI bridge             |
| [Event Handling](./event-handling.md)                           | Event flows and lifecycle              |
| [Error Handling](./error-handling.md)                           | Error taxonomy and recovery            |
| [Database Schema](../05-data-model/schema.md)                  | SQLite tables and queries              |
| [Algorithms](../04-domain-engine/algorithms.md)                | Domain math reference                  |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
