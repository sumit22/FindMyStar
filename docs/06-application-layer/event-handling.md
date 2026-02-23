# Event Handling

This document describes the event-driven communication patterns within the Application
Layer, including sensor data flow, lifecycle transitions, alarm triggers, and error
propagation. For service interfaces, see [services.md](./services.md).

---

## 1. Event Architecture Overview

The Application Layer uses an **observer pattern** for intra-service communication.
Services emit events through typed callback registrations rather than a global event bus.
This keeps dependencies explicit and avoids hidden coupling.

```
┌─────────────────────────────────────────────────────────────┐
│  Event Sources                                              │
│                                                             │
│  Device Sensors ──→ SensorFusionService ──→ Orientation     │
│  Device GPS ─────→ LocationService ──────→ Location         │
│  System Clock ───→ AlarmScheduler ───────→ Alarm Triggers   │
│  OS Lifecycle ───→ AppLifecycleManager ──→ State Transitions│
│                                                             │
│  Event Consumers                                            │
│                                                             │
│  ObjectTrackingService ←── Orientation, Location            │
│  VisibilityService ←────── Location                         │
│  AlarmScheduler ←────────── Midnight Tick, Location         │
│  Redux Store ←──────────── All services (via thunks)        │
│  Presentation Layer ←────── Redux selectors (re-render)     │
└─────────────────────────────────────────────────────────────┘
```

**Design principle**: Events flow in one direction (source to consumer). A consumer
never sends events back to its source. If bidirectional communication is needed, it
goes through the Redux store or a shared service.

---

## 2. Sensor Event Flow

### 2.1 IMU to AR Screen

This is the highest-frequency event path in the application, running at 30+ Hz during
active tracking.

```
┌──────────────┐     30+ Hz      ┌─────────────────────┐
│ Device IMU   │ ──────────────→ │ SensorFusionService  │
│ (Accel+Gyro+ │                 │                      │
│  Magnetometer)│                 │ Complementary filter │
└──────────────┘                 │ Drift correction     │
                                 └──────────┬──────────┘
                                            │
                                  onOrientationUpdate(q)
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ ObjectTrackingService │
                                 │                      │
                                 │ computeDirection(     │
                                 │   q, timestamp)      │
                                 │                      │
                                 │ Calls Rust FFI:      │
                                 │ compute_tracking_    │
                                 │   direction(...)     │
                                 └──────────┬───────────┘
                                            │
                                  TrackingResult
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ Redux dispatch:      │
                                 │ TRACKING_FRAME_UPDATE│
                                 └──────────┬───────────┘
                                            │
                                  useSelector(tracking)
                                            │
                                            ▼
                                 ┌──────────────────────┐
                                 │ ARScreen              │
                                 │ Renders arrow overlay │
                                 │ Updates angle display │
                                 │ Shows lock indicator  │
                                 └──────────────────────┘
```

**Timing budget per frame (33ms total at 30 FPS)**:

| Stage                         | Budget  | Typical  |
|-------------------------------|---------|----------|
| Sensor event delivery         | 2ms     | 1ms      |
| Complementary filter          | 1ms     | 0.5ms    |
| Callback dispatch             | 0.5ms   | 0.2ms    |
| Rust FFI call                 | 2ms     | 0.8ms    |
| Redux dispatch + reduce       | 1ms     | 0.5ms    |
| React re-render               | 20ms    | 10ms     |
| **Total**                     | **26.5ms** | **13ms** |

### 2.2 Magnetometer Calibration Event

When the SensorFusionService detects magnetic interference, it emits a calibration
event that the Presentation Layer handles with a user prompt.

```
SensorFusionService detects |magnetic_field| outside [25, 65] microtesla
    │
    ▼
needsCalibration() returns true
    │
    ▼
Redux dispatch: CALIBRATION_NEEDED
    │
    ▼
CalibrationModal displayed: "Move your phone in a figure-8 pattern"
    │
    ▼
User calibrates → magnetic readings stabilize
    │
    ▼
needsCalibration() returns false
    │
    ▼
Redux dispatch: CALIBRATION_COMPLETE
    │
    ▼
CalibrationModal dismissed
```

---

## 3. Location Event Flow

### 3.1 GPS to Services

Location updates are less frequent than sensor events (1/minute during tracking,
on-demand otherwise) but are consumed by multiple services.

```
┌───────────┐     1/min      ┌─────────────────┐
│ Device GPS│ ─────────────→ │ LocationService  │
│           │                │                  │
│ Platform: │                │ Caches location  │
│ FusedLoc  │                │ Validates fix    │
│ (Android) │                │ Checks accuracy  │
│ CLLocMgr  │                └────────┬─────────┘
│ (iOS)     │                         │
└───────────┘               onLocationUpdate(location)
                                      │
                          ┌───────────┼───────────┐
                          │           │           │
                          ▼           ▼           ▼
              ┌───────────────┐ ┌─────────┐ ┌──────────────┐
              │ ObjectTracking│ │Visibility│ │ AlarmScheduler│
              │ Service       │ │Service   │ │              │
              │               │ │          │ │ (recalculates│
              │ Updates cached│ │ Uses for │ │  if location │
              │ location for  │ │ rise/set │ │  changed     │
              │ tracking loop │ │ queries  │ │  significantly│
              └───────────────┘ └──────────┘ └──────────────┘
```

### 3.2 Location Change Significance

Not every GPS update triggers downstream recalculation. The LocationService applies
a significance filter:

| Condition                        | Action                              |
|----------------------------------|-------------------------------------|
| Distance moved < 1 km            | Cache update only, no event fired   |
| Distance moved 1-10 km           | Event fired, services update cached value |
| Distance moved > 10 km           | Event fired, AlarmScheduler.recalculateAll() triggered |
| Accuracy degraded > 500m         | Warning event, tracking paused      |

---

## 4. Alarm Event Flow

### 4.1 Midnight Recalculation

The AlarmScheduler performs daily recalculation to keep alarm trigger times accurate
as celestial objects shift their rise/set times.

```
┌───────────────────────────────────────────────────┐
│ OS Background Task Manager                        │
│ Android: WorkManager (periodic, ~24h)             │
│ iOS: BGTaskScheduler (BGProcessingTask)           │
└──────────────────────┬────────────────────────────┘
                       │
                 Midnight trigger
                       │
                       ▼
              ┌────────────────────┐
              │ AlarmScheduler     │
              │ .recalculateAll()  │
              └────────┬───────────┘
                       │
          ┌────────────┼────────────────┐
          │            │                │
          ▼            ▼                ▼
  Load alarms    For each alarm:    Update SQLite
  from SQLite    VisibilityService  Reschedule OS
                 .getNextVisible    notification
                 Time(object,
                      location)
                       │
                       ▼
              ┌────────────────────┐
              │ Results:           │
              │ - Updated rise/set │
              │ - New notification │
              │ - Status: active/  │
              │   expired/disabled │
              └────────────────────┘
```

### 4.2 Alarm Trigger (Notification Delivery)

When an OS notification fires and the user taps it:

```
OS Notification fires at scheduled time
    │
    ▼
User taps notification
    │
    ▼
App opens (cold start or foreground)
    │
    ▼
Deep link: navigate to ObjectInfoScreen(objectId)
    │
    ├─ CatalogRepository.getById(objectId)
    ├─ VisibilityService.isCurrentlyVisible(objectId, location)
    ├─ VisibilityService.computeRiseSet(objectId, location, today)
    │
    ▼
ObjectInfoScreen displayed with current data
    │
    ▼
If alarm is recurring:
    AlarmScheduler.recalculateAll()
    (schedules next occurrence)
```

### 4.3 Alarm State Machine

```
                    createAlarm()
                         │
                         ▼
                    ┌─────────┐    recalculateAll()     ┌──────────┐
                    │  ACTIVE  │ ──────────────────────→ │  ACTIVE  │
                    └────┬─────┘   (next time found)     └──────────┘
                         │
                         │ recalculateAll()
                         │ (no visible time in 48h)
                         ▼
                    ┌──────────┐
                    │ EXPIRED  │  User can manually re-enable
                    └────┬─────┘  or wait for next recalculation
                         │
                         │ updateAlarm() or recalculateAll()
                         │ (new visible time found)
                         ▼
                    ┌─────────┐
                    │  ACTIVE  │
                    └──────────┘

                    deleteAlarm()
                         │
                         ▼
                    ┌──────────┐
                    │ DELETED  │  Removed from SQLite
                    └──────────┘  OS notification cancelled
```

---

## 5. App Lifecycle Events

### 5.1 State Transitions

```
┌──────────┐   App Launch    ┌─────────────┐
│   COLD   │ ──────────────→ │ FOREGROUND  │
│  START   │                 │   (Active)  │
└──────────┘                 └──────┬──────┘
                                    │
                           Home button / Switch app
                                    │
                                    ▼
                             ┌─────────────┐
                             │ BACKGROUND  │
                             │  (Inactive) │
                             └──────┬──────┘
                                    │
                            User returns to app
                                    │
                                    ▼
                             ┌─────────────┐
                             │ FOREGROUND  │
                             │  (Resumed)  │
                             └──────┬──────┘
                                    │
                             OS kills app / User force-quits
                                    │
                                    ▼
                             ┌─────────────┐
                             │ TERMINATED  │
                             └─────────────┘
```

### 5.2 Service Actions per Lifecycle Event

| Lifecycle Event        | Service Actions                                           |
|------------------------|----------------------------------------------------------|
| **Cold Start**         | Initialize ServiceContainer in dependency order.          |
|                        | Open SQLite connection. Run integrity check.              |
|                        | Load alarms into memory. Request initial GPS fix.         |
|                        | Validate Rust engine version.                             |
| **Foreground (Resume)**| SensorFusionService.start() (if tracking was active).     |
|                        | LocationService resume active updates.                    |
|                        | AlarmScheduler check for missed triggers.                 |
|                        | Refresh tracking result if session was active.            |
| **Background**         | SensorFusionService.stop() (release sensor listeners).    |
|                        | ObjectTrackingService.stop() (pause tracking loop).       |
|                        | LocationService switch to passive mode.                   |
|                        | Persist current Redux state to AsyncStorage.              |
| **Terminated**         | Close SQLite connection gracefully.                       |
|                        | Unregister all sensor and location listeners.             |
|                        | Persist pending alarm changes to SQLite.                  |

### 5.3 Implementation

```typescript
import { AppState, AppStateStatus } from 'react-native';

class AppLifecycleManager {
  private previousState: AppStateStatus = 'active';
  private services: ServiceContainer;

  constructor(services: ServiceContainer) {
    this.services = services;
    AppState.addEventListener('change', this.handleStateChange);
  }

  private handleStateChange = (nextState: AppStateStatus) => {
    if (this.previousState === 'active' && nextState.match(/inactive|background/)) {
      this.onEnterBackground();
    }
    if (this.previousState.match(/inactive|background/) && nextState === 'active') {
      this.onEnterForeground();
    }
    this.previousState = nextState;
  };

  private onEnterBackground(): void {
    this.services.sensorFusionService.stop();
    this.services.objectTrackingService.stop();
  }

  private onEnterForeground(): void {
    if (this.services.objectTrackingService.getTargetObject() !== null) {
      this.services.sensorFusionService.start();
    }
    this.services.alarmScheduler.getNextAlarm(); // check for missed alarms
  }
}
```

---

## 6. Event Types Reference

| Event Name                | Source                  | Payload                    | Subscribers                          |
|---------------------------|-------------------------|----------------------------|--------------------------------------|
| `orientation_update`      | SensorFusionService     | `Quaternion`               | ObjectTrackingService, Redux         |
| `calibration_needed`      | SensorFusionService     | `{ accuracy: number }`     | Redux (CalibrationModal)             |
| `calibration_complete`    | SensorFusionService     | `void`                     | Redux (CalibrationModal)             |
| `location_update`         | LocationService         | `Location`                 | ObjectTrackingService, VisibilityService, AlarmScheduler |
| `location_unavailable`    | LocationService         | `{ reason: string }`       | Redux (error display)               |
| `tracking_frame`          | ObjectTrackingService   | `TrackingResult`           | Redux (ARScreen)                     |
| `tracking_started`        | ObjectTrackingService   | `{ objectId: string }`     | Redux (UI state)                     |
| `tracking_stopped`        | ObjectTrackingService   | `void`                     | Redux (UI state)                     |
| `alarm_created`           | AlarmScheduler          | `Alarm`                    | Redux (AlarmScreen)                  |
| `alarm_updated`           | AlarmScheduler          | `Alarm`                    | Redux (AlarmScreen)                  |
| `alarm_deleted`           | AlarmScheduler          | `{ alarmId: string }`      | Redux (AlarmScreen)                  |
| `alarm_triggered`         | OS Notification         | `{ objectId: string }`     | AlarmScheduler, Redux               |
| `recalculation_complete`  | AlarmScheduler          | `{ count: number }`        | Redux (status indicator)             |
| `app_foreground`          | AppLifecycleManager     | `void`                     | All services                         |
| `app_background`          | AppLifecycleManager     | `void`                     | All services                         |
| `engine_error`            | Rust FFI bridge         | `AppError`                 | Redux (error display)               |
| `database_error`          | CatalogRepository       | `AppError`                 | Redux (error display)               |

---

## 7. Debouncing and Throttling

Different event sources have different natural frequencies and downstream processing
costs. The Application Layer applies appropriate rate limiting:

| Event Source        | Raw Rate         | Throttled Rate   | Strategy        | Rationale                     |
|---------------------|------------------|------------------|-----------------|-------------------------------|
| IMU sensors         | 60-100 Hz        | 30 Hz            | Sample-and-hold | Match display refresh rate    |
| GPS location        | Varies (1-10s)   | 1/minute         | Minimum interval| Battery conservation          |
| Catalog search      | Per keystroke     | 200ms debounce   | Trailing edge   | Wait for typing pause         |
| Rise/set compute    | On demand        | No throttle      | N/A             | User-initiated, cached result |
| Alarm recalculation | Daily            | No throttle      | N/A             | Background task, bounded work |
| UI re-render        | Per state change | 60 FPS (16ms)    | React batching  | Native display refresh        |

### Implementation Examples

```typescript
// IMU throttling: SensorFusionService delivers at sensor rate,
// ObjectTrackingService samples at 30 Hz
class ObjectTrackingService {
  private lastFrameTime = 0;
  private readonly FRAME_INTERVAL = 33; // ms (30 FPS)

  private onSensorUpdate = (q: Quaternion) => {
    const now = performance.now();
    if (now - this.lastFrameTime < this.FRAME_INTERVAL) return;
    this.lastFrameTime = now;

    const result = this.computeDirection(q, Date.now());
    this.dispatch({ type: 'TRACKING_FRAME_UPDATE', payload: result });
  };
}

// Search debouncing: wait 200ms after last keystroke
function useSearchDebounce(query: string, delayMs = 200) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), delayMs);
    return () => clearTimeout(timer);
  }, [query, delayMs]);

  return debouncedQuery;
}
```

---

## 8. Error Event Propagation

Errors from any service are propagated to the Redux store as typed `AppError` objects.
The Presentation Layer subscribes to the errors slice and displays appropriate UI.

```
Service encounters error
    │
    ▼
Service creates AppError {
  id: uuid(),
  code: 'SENSOR_UNAVAILABLE',
  category: 'sensor',
  message: 'Gyroscope data unavailable',
  userMessage: 'Unable to detect device orientation. Please check sensor permissions.',
  recoverable: true,
  timestamp: Date.now()
}
    │
    ▼
Redux dispatch: ERROR_OCCURRED(appError)
    │
    ▼
Error reducer adds to activeErrors[]
    │
    ▼
ErrorBanner component renders top-of-screen notification
    │
    ▼
User taps dismiss → dispatch: ERROR_DISMISSED(errorId)
    OR
Auto-dismiss after 10 seconds for recoverable errors
```

Full error taxonomy and recovery strategies are documented in
[error-handling.md](./error-handling.md).

---

## 9. Cross-References

| Document                                                               | Relevance                      |
|------------------------------------------------------------------------|--------------------------------|
| [Application Layer Overview](./overview.md)                            | Service architecture           |
| [Application Services](./services.md)                                  | Interface definitions          |
| [API Contracts](./api-contracts.md)                                    | FFI bridge events              |
| [Error Handling](./error-handling.md)                                  | Error event details            |
| [Architecture Overview](../03-architecture/architecture-overview.md)   | System data flows              |
| [Sequence Diagrams](../03-architecture/sequences/)                     | Visual flow diagrams           |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
