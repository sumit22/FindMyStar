# Application Services

This document defines every service in the Application Layer with full TypeScript
interfaces, method signatures, dependency lists, error handling, and performance targets.
For architectural context, see [overview.md](./overview.md).

---

## 1. Shared Types

The following types are referenced across multiple service interfaces:

```typescript
/** Geographic coordinates of the observer */
interface Location {
  latitude: number;   // degrees, -90 to +90
  longitude: number;  // degrees, -180 to +180
  altitude: number;   // meters above sea level
  accuracy: number;   // meters, horizontal accuracy
  timestamp: number;  // Unix milliseconds when fix was obtained
}

/** Unit quaternion representing 3D orientation */
interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

/** 3D unit vector in Earth-local coordinate frame (X=East, Y=Up, Z=North) */
interface Vector3 {
  x: number;
  y: number;
  z: number;
}

/** Catalog entry for a celestial object */
interface CelestialObject {
  id: string;
  name: string;
  type: ObjectType;
  ra: number | null;       // hours (0-24), null for planets
  dec: number | null;      // degrees (-90 to +90), null for planets
  magnitude: number;
  distanceLightYears: number | null;
  description: string;
}

type ObjectType = 'star' | 'planet' | 'nebula' | 'galaxy' | 'moon' | 'sun';

/** User-tracked object with alarm configuration */
interface TrackedObject {
  objectId: string;
  objectName: string;
  objectType: ObjectType;
  latitude: number;
  longitude: number;
  minAltitude: number;
  nextVisibleAt: Date | null;
  isRecurring: boolean;
  createdAt: Date;
  lastNotifiedAt: Date | null;
}

/** Application-level error */
interface AppError {
  id: string;
  code: string;
  category: 'domain' | 'sensor' | 'data' | 'ffi';
  message: string;
  userMessage: string;
  recoverable: boolean;
  timestamp: number;
}
```

---

## 2. ObjectTrackingService

### Responsibility

Orchestrates real-time celestial object tracking. Each tracking cycle:
1. Reads the current device orientation from SensorFusionService.
2. Reads the current location from LocationService.
3. Calls the Rust FFI bridge to compute the target's Alt/Az and the angular error
   between the device pointing direction and the target.
4. Returns a `TrackingResult` to the Presentation Layer for AR rendering.

### Interface

```typescript
export interface IObjectTrackingService {
  /**
   * Initialize tracking for a celestial object.
   * Loads object data from catalog, validates visibility, starts the tracking loop.
   * @param objectId - Catalog ID of the target object.
   * @throws ObjectNotFoundError if objectId is invalid.
   * @throws ObjectBelowHorizonError if the object is currently below 0 degrees altitude.
   */
  initialize(objectId: string): Promise<void>;

  /**
   * Compute a single tracking frame. Called by the render loop at 30+ Hz.
   * Must complete within 5ms to maintain frame rate.
   * @param q - Current device orientation quaternion from SensorFusionService.
   * @param timestamp - Current time in Unix milliseconds.
   * @returns TrackingResult with direction vector, angle error, and lock state.
   */
  computeDirection(q: Quaternion, timestamp: number): TrackingResult;

  /**
   * Stop the active tracking session. Releases sensor subscriptions and
   * clears the target object. Safe to call when already stopped.
   */
  stop(): void;

  /**
   * Returns true if a tracking session is currently active.
   */
  isActive(): boolean;

  /**
   * Returns the currently tracked object, or null if no session is active.
   */
  getTargetObject(): CelestialObject | null;
}
```

### Result Type

```typescript
interface TrackingResult {
  directionVector: Vector3;  // Relative direction to target in camera frame
  angleError: number;        // Angular distance to target (degrees, 0-180)
  locked: boolean;           // True if angleError < lockThreshold (default 2 degrees)
  altitude: number;          // Current altitude of target (degrees, -90 to +90)
  azimuth: number;           // Current azimuth of target (degrees, 0-360)
}
```

### Dependencies

- `ISensorFusionService` - Device orientation quaternion
- `ILocationService` - Observer GPS coordinates
- `ICatalogRepository` - Object lookup by ID
- Rust FFI bridge (`compute_tracking_direction`) - Core math

### State

- `targetObject: CelestialObject | null` - Currently tracked object
- `isTracking: boolean` - Whether the loop is active
- `lastLocation: Location` - Cached location (updated every 60s during tracking)

### Error Handling

| Error                     | Cause                         | Recovery                           |
|---------------------------|-------------------------------|------------------------------------|
| ObjectNotFoundError       | Invalid objectId              | Show "object not found" message    |
| ObjectBelowHorizonError   | Object currently not visible  | Show altitude, suggest later time  |
| SensorUnavailableError    | IMU not responding            | Prompt calibration, degrade to compass |
| FFIComputationError       | Rust engine returned error    | Stop tracking, show generic error  |

### Performance

- **Target**: >= 30 FPS (33ms budget per frame)
- **computeDirection budget**: < 5ms (Rust FFI call ~1-2ms, overhead ~1-2ms)
- **Memory**: < 1MB (single object + cached location)

### Lifecycle

- **Created**: At app startup (singleton via ServiceContainer)
- **Active**: When user taps "Track" on an object info screen
- **Stopped**: When user exits AR screen, or app moves to background
- **Destroyed**: At app termination

---

## 3. VisibilityService

### Responsibility

Computes rise/set times, transit times, and visibility windows for celestial objects.
Delegates all astronomical math to the Rust engine. Handles edge cases such as
circumpolar objects and objects that never rise at a given latitude.

### Interface

```typescript
export interface IVisibilityService {
  /**
   * Compute rise, set, and transit times for an object on a given date.
   * Uses analytical solution for stars, iterative scan for planets.
   * @param objectId - Catalog ID.
   * @param location - Observer location.
   * @param date - Date for computation (midnight local time used as reference).
   * @returns RiseSetResult with times, max altitude, and special-case flags.
   * @throws ObjectNotFoundError if objectId is invalid.
   */
  computeRiseSet(objectId: string, location: Location, date: Date): Promise<RiseSetResult>;

  /**
   * Check if an object is currently above the horizon at the given location.
   * @param objectId - Catalog ID.
   * @param location - Observer location.
   * @returns True if altitude > 0 degrees now.
   */
  isCurrentlyVisible(objectId: string, location: Location): Promise<boolean>;

  /**
   * Compute the optimal viewing window: time when the object is highest in
   * the sky and the sun is below -6 degrees (civil twilight).
   * @param objectId - Catalog ID.
   * @param location - Observer location.
   * @returns OptimalViewingResult or null if no good window in next 48h.
   */
  computeOptimalViewing(objectId: string, location: Location): Promise<OptimalViewingResult>;

  /**
   * Find the next time the object will be visible (above minAltitude and
   * sun below twilight threshold), scanning up to 48 hours ahead.
   * @param objectId - Catalog ID.
   * @param location - Observer location.
   * @returns Next visible Date, or null if not visible within 48 hours.
   */
  getNextVisibleTime(objectId: string, location: Location): Promise<Date | null>;
}
```

### Result Types

```typescript
interface RiseSetResult {
  riseTime: Date | null;      // null if circumpolar or never-visible
  setTime: Date | null;
  transitTime: Date;          // Time of maximum altitude
  maxAltitude: number;        // Degrees at transit
  isCircumpolar: boolean;     // Object never sets (e.g., Polaris at high latitudes)
  isNeverVisible: boolean;    // Object never rises (e.g., southern star from north pole)
}

interface OptimalViewingResult {
  windowStart: Date;          // When conditions first met
  windowEnd: Date;            // When conditions end
  peakTime: Date;             // Best moment within window
  peakAltitude: number;       // Altitude at peak (degrees)
  sunAltitudeAtPeak: number;  // Sun altitude at peak (degrees, negative = below horizon)
}
```

### Dependencies

- `ICatalogRepository` - Object data lookup
- `ILocationService` - Current observer coordinates
- Rust FFI bridge (`compute_rise_set`, `ra_dec_to_altaz`) - Astronomical calculations

### Error Handling

| Error                    | Cause                            | Recovery                         |
|--------------------------|----------------------------------|----------------------------------|
| ObjectNotFoundError      | Invalid objectId                 | Return user-friendly message     |
| EphemerisOutOfRangeError | Date too far from J2000 epoch    | Clamp to valid range, warn user  |
| LocationUnavailableError | No GPS fix available             | Use last known location          |

### Performance

- **computeRiseSet**: < 100ms (single Rust FFI call for stars, iterative scan for planets)
- **isCurrentlyVisible**: < 10ms (single altitude computation)
- **getNextVisibleTime**: < 500ms (48-hour iterative scan at 5-minute intervals)

### Lifecycle

- **Created**: At app startup (singleton)
- **Stateless**: No persistent state; each call is independent
- **Destroyed**: At app termination

---

## 4. AlarmScheduler

### Responsibility

Manages visibility alarms for tracked celestial objects. Persists alarm data in SQLite,
schedules OS-level notifications, and performs daily recalculation of rise/set times
to keep notification triggers accurate.

### Interface

```typescript
export interface IAlarmScheduler {
  /**
   * Create a new visibility alarm for an object.
   * Computes the next visible time and schedules an OS notification.
   * @param objectId - Catalog ID of the target object.
   * @param options - Alarm configuration (altitude threshold, recurring, etc.).
   * @returns The created Alarm record.
   * @throws DuplicateAlarmError if an alarm already exists for this object.
   */
  createAlarm(objectId: string, options: AlarmOptions): Promise<Alarm>;

  /**
   * Update an existing alarm's configuration.
   * Recalculates the next trigger time if altitude threshold changed.
   * @param alarmId - ID of the alarm to update.
   * @param options - Partial options to merge with existing configuration.
   * @returns Updated Alarm record.
   * @throws AlarmNotFoundError if alarmId is invalid.
   */
  updateAlarm(alarmId: string, options: Partial<AlarmOptions>): Promise<Alarm>;

  /**
   * Delete an alarm and cancel its pending OS notification.
   * @param alarmId - ID of the alarm to delete.
   * @throws AlarmNotFoundError if alarmId is invalid.
   */
  deleteAlarm(alarmId: string): Promise<void>;

  /**
   * List all active alarms, sorted by next trigger time ascending.
   * @returns Array of Alarm records.
   */
  listAlarms(): Promise<Alarm[]>;

  /**
   * Recalculate rise/set times for ALL active alarms.
   * Called daily at midnight by the background task, or manually by the user.
   * Updates SQLite records and reschedules OS notifications.
   * Must complete within 2 seconds for background task budget.
   */
  recalculateAll(): Promise<void>;

  /**
   * Get the alarm that will trigger next, or null if no alarms exist.
   * @returns The nearest Alarm, or null.
   */
  getNextAlarm(): Promise<Alarm | null>;
}
```

### Configuration and Result Types

```typescript
interface AlarmOptions {
  minAltitude: number;            // Minimum altitude in degrees (default 10)
  recurring: boolean;             // Recalculate after each trigger (default true)
  sunAltitudeThreshold: number;   // Max sun altitude for notification (default -6)
  notifyMinutesBefore: number;    // Minutes before rise to notify (default 15)
}

interface Alarm {
  id: string;
  objectId: string;
  objectName: string;
  objectType: ObjectType;
  options: AlarmOptions;
  nextTriggerAt: Date | null;     // null if object is never visible
  lastTriggeredAt: Date | null;
  latitude: number;               // Location when alarm was created
  longitude: number;
  createdAt: Date;
  status: 'active' | 'expired' | 'disabled';
}
```

### Dependencies

- `IVisibilityService` - Rise/set time computation
- `ICatalogRepository` - Alarm persistence (tracked_objects table)
- OS Notification APIs:
  - Android: `react-native-push-notification` wrapping AlarmManager
  - iOS: `UNUserNotificationCenter` via React Native bridge

### State

- Alarm list is persisted in SQLite (`tracked_objects` table).
- In-memory cache of alarms loaded at startup, invalidated on create/update/delete.
- OS notification IDs stored alongside alarm records for cancellation.

### Reboot Survival

Alarms must survive device reboot:
- **Android**: AlarmManager alarms are lost on reboot. A `BOOT_COMPLETED` broadcast
  receiver triggers `recalculateAll()` to reschedule all notifications.
- **iOS**: `UNUserNotificationCenter` scheduled notifications survive reboot natively.

### Daily Recalculation

At midnight local time (via background task):
1. Load all active alarms from SQLite.
2. For each alarm, call `VisibilityService.getNextVisibleTime()`.
3. Update `nextTriggerAt` in SQLite.
4. Cancel old OS notification, schedule new one.
5. If recurring and already triggered today, compute next occurrence.

### Error Handling

| Error                   | Cause                             | Recovery                        |
|-------------------------|-----------------------------------|---------------------------------|
| DuplicateAlarmError     | Alarm already exists for object   | Show "alarm already set" toast  |
| AlarmNotFoundError      | Invalid alarmId                   | Ignore silently (already deleted)|
| NotificationDeniedError | User denied notification permission| Prompt to enable in Settings   |
| RecalculationError      | VisibilityService failure         | Retry at next background cycle  |

### Performance

- **createAlarm**: < 200ms (visibility computation + SQLite insert + notification schedule)
- **recalculateAll**: < 2s for up to 50 alarms (budget for background task)
- **listAlarms**: < 50ms (cached in memory, SQLite fallback)

### Lifecycle

- **Created**: At app startup (singleton)
- **Loaded**: Reads all alarms from SQLite into memory cache
- **Background**: `recalculateAll()` runs daily via WorkManager / BGTaskScheduler
- **Destroyed**: At app termination (in-memory cache discarded, SQLite is authoritative)

---

## 5. SensorFusionService

### Responsibility

Provides a stable, drift-corrected device orientation quaternion by fusing data from the
accelerometer, gyroscope, and magnetometer. Shields upstream services from raw sensor
noise and platform-specific sensor APIs.

### Interface

```typescript
export interface ISensorFusionService {
  /**
   * Start listening to device sensors and begin computing fused orientation.
   * Registers platform-specific sensor listeners (accelerometer, gyroscope,
   * magnetometer). Safe to call if already started.
   */
  start(): void;

  /**
   * Stop all sensor listeners and release resources.
   * After calling stop(), getQuaternion() returns the last known value.
   */
  stop(): void;

  /**
   * Get the current fused device orientation as a unit quaternion.
   * Returns the most recent computed quaternion. If sensors have not
   * started, returns identity quaternion (w=1, x=0, y=0, z=0).
   * @returns Quaternion representing device orientation in Earth frame.
   */
  getQuaternion(): Quaternion;

  /**
   * Get the estimated accuracy of the current orientation in degrees.
   * Lower values indicate higher confidence.
   * @returns Accuracy estimate in degrees (0 = perfect, 180 = unknown).
   */
  getAccuracy(): number;

  /**
   * Check if the magnetometer needs user calibration (figure-8 motion).
   * Triggered by high magnetic interference or low accuracy readings.
   * @returns True if calibration is recommended.
   */
  needsCalibration(): boolean;

  /**
   * Register a callback for orientation updates at sensor frequency.
   * Multiple callbacks can be registered. Callbacks execute on the JS thread.
   * @param callback - Called with the new quaternion on each sensor update.
   * @returns Unsubscribe function.
   */
  onOrientationUpdate(callback: (q: Quaternion) => void): () => void;
}
```

### Algorithm

The SensorFusionService implements a **complementary filter**:

1. **Gyroscope integration**: Integrate angular velocity for short-term orientation
   (low drift over 100ms, but accumulates over time).
2. **Accelerometer + Magnetometer reference**: Compute absolute orientation from
   gravity vector (accelerometer) and magnetic north (magnetometer). Noisy but
   drift-free.
3. **Complementary blend**: Combine gyroscope (high-frequency, 98% weight) with
   accel+mag reference (low-frequency, 2% weight) each frame.
4. **Magnetometer calibration**: Detect hard/soft iron interference. If uncalibrated,
   reduce magnetometer weight and set `needsCalibration() = true`.

### Dependencies

- Platform sensor APIs:
  - Android: `SensorManager` (TYPE_GYROSCOPE, TYPE_ACCELEROMETER, TYPE_MAGNETIC_FIELD)
  - iOS: `CMMotionManager` (deviceMotion with magnetometer reference)
- React Native bridge for sensor data delivery to JS thread

### State

- `currentQuaternion: Quaternion` - Latest fused orientation
- `accuracy: number` - Estimated accuracy in degrees
- `calibrationNeeded: boolean` - Magnetometer calibration flag
- `subscribers: Set<(q: Quaternion) => void>` - Active callbacks

### Error Handling

| Error                     | Cause                         | Recovery                            |
|---------------------------|-------------------------------|-------------------------------------|
| SensorUnavailableError    | Device lacks gyroscope        | Fall back to accel+mag only (lower quality) |
| MagneticInterferenceError | Strong magnetic field nearby  | Set needsCalibration, increase gyro weight  |
| SensorPermissionDenied    | User denied motion permission | Show permission rationale dialog    |

### Performance

- **Update rate**: 30+ Hz (matching display refresh)
- **Latency**: < 5ms from sensor event to quaternion delivery
- **CPU**: < 3% on mid-range device during active tracking
- **Memory**: < 500KB (circular buffer of recent readings for filtering)

### Lifecycle

- **Created**: At app startup (singleton)
- **Started**: When AR screen opens or tracking begins
- **Stopped**: When AR screen closes or app moves to background
- **Destroyed**: At app termination

---

## 6. CatalogRepository

### Responsibility

Provides read/write access to the SQLite database for celestial object catalog queries
and tracked object (alarm) management. Implements an in-memory LRU cache for repeated
queries. Schema details: [schema.md](../05-data-model/schema.md).

### Interface

```typescript
export interface ICatalogRepository {
  /**
   * Search celestial objects by name substring. Case-insensitive.
   * Results ordered by apparent magnitude (brightest first).
   * @param query - Search string (minimum 1 character).
   * @param limit - Maximum results to return (default 20, max 100).
   * @returns Array of matching CelestialObject records.
   */
  search(query: string, limit?: number): Promise<CelestialObject[]>;

  /**
   * Get a single celestial object by its catalog ID.
   * @param id - Object ID (primary key in objects table).
   * @returns CelestialObject, or null if not found.
   */
  getById(id: string): Promise<CelestialObject | null>;

  /**
   * Get all objects of a specific type.
   * @param type - ObjectType filter.
   * @returns Array of matching objects, ordered by magnitude.
   */
  getByType(type: ObjectType): Promise<CelestialObject[]>;

  /**
   * Get all user-tracked objects with their alarm configurations.
   * Joins objects and tracked_objects tables.
   * @returns Array of TrackedObject records.
   */
  getTrackedObjects(): Promise<TrackedObject[]>;

  /**
   * Add an object to the user's tracked list (create alarm record).
   * @param objectId - Catalog ID of the object.
   * @param options - Tracking configuration.
   * @throws DuplicateAlarmError if object is already tracked.
   */
  addTrackedObject(objectId: string, options: TrackingOptions): Promise<void>;

  /**
   * Remove an object from the tracked list and delete its alarm record.
   * @param objectId - Catalog ID of the object to untrack.
   */
  removeTrackedObject(objectId: string): Promise<void>;
}
```

### Supporting Types

```typescript
interface TrackingOptions {
  latitude: number;
  longitude: number;
  minAltitude: number;       // default 10 degrees
  isRecurring: boolean;      // default true
  nextVisibleAt: Date | null;
}
```

### Dependencies

- SQLite database connection (opened at app startup)
- Database schema: `objects` table, `tracked_objects` table
- Indices: `idx_objects_type`, `idx_objects_magnitude`, `idx_tracked_next_visible`

### Caching Strategy

- **LRU cache**: 100 entries, keyed by query string or object ID.
- **Cache invalidation**: On any write operation (`addTrackedObject`, `removeTrackedObject`),
  the tracked objects portion of the cache is invalidated.
- **Cache TTL**: None (catalog data is static within an app version).
- **Search cache**: Disabled for queries under 2 characters (too volatile as user types).

### Error Handling

| Error                 | Cause                       | Recovery                          |
|-----------------------|-----------------------------|-----------------------------------|
| DatabaseCorruptError  | SQLite integrity check failed| Restore from bundled backup       |
| DuplicateAlarmError   | Object already tracked       | Return existing tracked object    |
| ObjectNotFoundError   | Invalid ID                   | Return null                       |
| MigrationError        | Schema version mismatch      | Run migration, restart if needed  |

### Performance

- **search()**: < 50ms for LIKE queries with index on name
- **getById()**: < 5ms (primary key lookup, likely cached)
- **getTrackedObjects()**: < 30ms (JOIN query, cached after first call)
- **Cache hit ratio**: Expected 80%+ during typical search-then-track flow

### Lifecycle

- **Created**: At app startup after database connection is established
- **Cache warmed**: Tracked objects preloaded on first access
- **Destroyed**: At app termination (cache discarded, SQLite connection closed)

---

## 7. LocationService

### Responsibility

Manages device GPS location with configurable update intervals. Provides the current
observer coordinates to all services that need them. Implements privacy-safe location
handling: location data never leaves the device (per
[ADR-0003](../11-adr/0003-offline-first.md)).

### Interface

```typescript
export interface ILocationService {
  /**
   * Get the current device location. Requests a fresh GPS fix.
   * Times out after 10 seconds and falls back to last known location.
   * @returns Current Location with accuracy metadata.
   * @throws LocationUnavailableError if no location is available at all.
   */
  getCurrentLocation(): Promise<Location>;

  /**
   * Get the most recent cached location without requesting a new GPS fix.
   * Returns null if no location has ever been obtained this session.
   * @returns Last known Location, or null.
   */
  getLastKnownLocation(): Location | null;

  /**
   * Start periodic location updates at the specified interval.
   * Updates are delivered via onLocationUpdate callbacks.
   * @param intervalMs - Update interval in milliseconds (minimum 60000 = 1 minute).
   */
  startLocationUpdates(intervalMs: number): void;

  /**
   * Stop periodic location updates to conserve battery.
   */
  stopLocationUpdates(): void;

  /**
   * Register a callback for location updates.
   * @param callback - Called with the new Location on each update.
   * @returns Unsubscribe function.
   */
  onLocationUpdate(callback: (location: Location) => void): () => void;
}
```

### Dependencies

- Platform GPS APIs:
  - Android: `FusedLocationProviderClient` (Google Play Services)
  - iOS: `CLLocationManager`
- React Native bridge: `react-native-geolocation-service` or equivalent

### State

- `lastKnownLocation: Location | null` - Cached most recent fix
- `isUpdating: boolean` - Whether periodic updates are active
- `subscribers: Set<(location: Location) => void>` - Active callbacks

### Privacy

- Location is stored only in volatile memory (never persisted to disk except when
  embedded in an alarm record at the user's explicit request).
- No location data is transmitted off-device.
- Location permission is requested with a clear rationale explaining offline-only use.

### Error Handling

| Error                    | Cause                         | Recovery                         |
|--------------------------|-------------------------------|----------------------------------|
| LocationUnavailableError | GPS disabled or no fix        | Use lastKnownLocation if available |
| LocationPermissionDenied | User denied location access   | Show rationale, degrade gracefully |
| LocationTimeoutError     | GPS fix took > 10 seconds     | Fall back to last known location |

### Performance

- **getCurrentLocation()**: < 10s (GPS fix timeout), typically < 3s
- **Update interval**: Minimum 60 seconds to conserve battery
- **Battery impact**: < 2% per hour with 60s interval
- **Accuracy**: Target < 50m horizontal accuracy

### Lifecycle

- **Created**: At app startup (singleton)
- **Active**: Location updates start when tracking begins or alarm screen opens
- **Passive**: Reduces to last-known-only when app is in background
- **Destroyed**: At app termination (listeners unregistered)

---

## 8. Service Interaction Patterns

### Pattern: Search and Track

```
User types search query
  → CatalogRepository.search(query)
  → Results displayed in SearchScreen

User taps object
  → CatalogRepository.getById(objectId)
  → VisibilityService.computeRiseSet(objectId, location, today)
  → Results displayed in ObjectInfoScreen

User taps "Track"
  → ObjectTrackingService.initialize(objectId)
  → SensorFusionService.start()
  → LocationService.getCurrentLocation()
  → Tracking loop begins, results flow to ARScreen
```

### Pattern: Set Alarm

```
User taps "Set Alarm" on ObjectInfoScreen
  → AlarmScheduler.createAlarm(objectId, options)
    → VisibilityService.getNextVisibleTime(objectId, location)
    → CatalogRepository.addTrackedObject(objectId, trackingOptions)
    → OS notification scheduled
  → UI confirms alarm creation
```

### Pattern: Daily Recalculation (Background)

```
Midnight background task fires
  → AlarmScheduler.recalculateAll()
    → CatalogRepository.getTrackedObjects()
    → For each alarm:
      → VisibilityService.getNextVisibleTime(objectId, location)
      → Update SQLite record
      → Reschedule OS notification
  → Background task completes
```

---

## 9. Testing Strategy

Each service is tested at three levels:

1. **Unit tests**: Service logic tested with mocked dependencies.
   All FFI calls mocked. All database calls mocked.
2. **Integration tests**: Service tested with real SQLite database and mocked sensors.
   Rust FFI bridge tested with known input/output pairs.
3. **End-to-end tests**: Full service chain tested on device emulator with simulated
   sensor data and pre-loaded catalog.

See [Testing Strategy](../08-testing/overview.md) for details.

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
