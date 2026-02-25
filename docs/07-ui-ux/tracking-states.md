# Tracking Mode States & Transitions

> **Related Documents**: [UI/UX Architecture](./overview.md) | [SRS FR-4 through FR-7](../02-requirements/srs.md) | [Application Layer Overview](../06-application-layer/overview.md) | [Architecture Overview §4](../03-architecture/architecture-overview.md)

This document defines the state machine governing the AR tracking mode in FindMyStar. The tracking mode is the core real-time experience: the user holds the phone toward the sky and follows a directional arrow to locate a celestial object. Every visual element, sound, and haptic response on the ARScreen is determined by the current tracking state.

---

## 1. State Machine Overview

The tracking mode operates as a finite state machine with five states. Transitions are triggered by user actions, sensor events, and computed angular thresholds.

```
                          user taps "Track"
    ┌───────┐ ──────────────────────────────→ ┌────────────────┐
    │ Idle  │                                  │ Initializing   │
    └───────┘ ←──── user taps "Back" ──────── └───────┬────────┘
        ▲                                             │
        │                                    sensors ready
        │                                             │
        │                                             ▼
        │     user taps "Stop"              ┌────────────────┐
        ├──────────────────────────────────── │   Tracking     │
        │                                    └───────┬────────┘
        │                                       │         ▲
        │                              angle < 0.5°    angle > 0.5°
        │                              held 2+ sec        │
        │                                       │         │
        │                                       ▼         │
        │     user taps "Stop"              ┌────────────────┐
        ├──────────────────────────────────── │    Locked      │
        │                                    └────────────────┘
        │
        │     user taps "Back"              ┌────────────────┐
        └──────────────────────────────────── │    Error       │
                                             └───────┬────────┘
                                                     │
                                              retry succeeds
                                                     │
                                                     ▼
                                             ┌────────────────┐
                                             │   Tracking     │
                                             └────────────────┘
```

### 1.1 Transition Summary Table

| From           | To             | Trigger                                         |
|----------------|----------------|--------------------------------------------------|
| Idle           | Initializing   | User taps "Track" on ObjectInfoScreen            |
| Initializing   | Tracking       | GPS acquired, IMU calibrated, initial position computed |
| Initializing   | Error          | Sensor timeout (>5s), GPS unavailable, camera denied |
| Tracking       | Locked         | Angular error < 0.5° sustained for 2+ seconds (hysteresis: unlock at > 1.0°) |
| Tracking       | Idle           | User taps "Stop" or "Back"                       |
| Tracking       | Error          | Sensor failure, computation exception            |
| Locked         | Tracking       | Angular error exceeds 1.0° (hysteresis unlock)   |
| Locked         | Idle           | User taps "Stop" or "Back"                       |
| Error          | Tracking       | User taps "Retry" and sensors recover            |
| Error          | Idle           | User taps "Back"                                 |

---

## 2. State Descriptions

### 2.1 Idle

The default state when no object is being tracked. The AR camera is off, sensor listeners are inactive, and the tracking loop is not running. The application consumes minimal resources in this state.

**Entry conditions**: App launch, user exits tracking, error dismissed without retry.

**UI**: The ARScreen is not visible. The user is on SearchScreen, ObjectInfoScreen, or AlarmScreen.

### 2.2 Initializing

A transient state entered when the user begins tracking. The system performs all setup required before real-time guidance can start.

**Actions performed during initialization**:
1. Request camera permission (if not already granted).
2. Start GPS listener and acquire current location (or use cached location if fresh within 60 seconds).
3. Start IMU sensor listeners (gyroscope, accelerometer, magnetometer).
4. Run magnetometer accuracy check; if accuracy is degraded (>10° drift), transition to calibration sub-flow before continuing.
5. Compute the target object's current RA/Dec via the Rust ephemeris engine.
6. Convert RA/Dec to altitude/azimuth for the observer's location and time.
7. Compute initial device-to-target vector.

**Timeout**: If initialization does not complete within 5 seconds, transition to Error state with the message "Sensors took too long to start. Please try again."

**UI**: Full-screen camera preview with a centered loading spinner and the text "Preparing sensors...". The directional arrow is not yet visible.

### 2.3 Tracking

The primary active state. The tracking loop runs at 30+ FPS, continuously computing the angular distance between the device's pointing direction and the target object's position.

**Loop (each frame)**:
1. Read fused device orientation quaternion from SensorFusionService.
2. Compute target altitude/azimuth for current time (updates RA/Dec for planets; uses cached RA/Dec for stars).
3. Extract `deviceHeading` (compass bearing of back camera) and `deviceElevation` (tilt above horizon) from the quaternion.
4. Build `deviceDir` unit vector in the Rust core's EUN (East-Up-North) frame from heading and elevation, using the same alt/az-to-vector3 formula as the core engine. This ensures both vectors share the same coordinate frame. See [Coordinate Transforms §4.4](../04-domain-engine/coordinate-transforms.md).
5. Compute angular distance between `deviceDir` and target direction vector.
6. Determine guidance phase (turn / tilt / locked) and proximity color.
7. Dispatch updated tracking frame (altitude, azimuth, angularDistance, isLocked, deviceHeading, deviceElevation) to the Zustand store.
8. Check lock condition (angle < 0.5°, with 1.0° hysteresis for unlock).

**Two-phase guidance**: The UI decomposes tracking into sequential steps:
- **Phase 1 — Horizontal alignment**: When `|relativeBearing|` (difference between target azimuth and device heading) exceeds the screen FOV (~30°), a large turn hint appears: "◀ Turn left X°" or "Turn right X° ▶". The bearing counter updates live as the user rotates. Once the target enters the screen FOV, the sky guide renders with the azimuth diamond on the horizon line.
- **Phase 2 — Vertical alignment**: With horizontal alignment achieved (diamond near center), the plumb line guides the user upward. A tilt hint ("▲ Tilt up X°") appears if the target is above the screen bounds.
- **Convergence**: As both axes align, the target crosshair approaches the viewport center circle, guide elements turn green, and the angular distance badge shows the shrinking gap.

**UI**: Sky guide overlay with horizon line, azimuth diamond, plumb line, and target crosshair. Viewport center circle as alignment target. Angular distance badge below center. All elements color-coded by proximity (blue → yellow → green). See [UI/UX Architecture §3.2](./overview.md).

### 2.4 Locked

The target has been acquired. The device is pointing within 0.5° of the object and has held this alignment for at least 2 consecutive seconds.

**Entry conditions**: Angular error < 0.5° sustained for 2000ms. The timer resets if the angle exceeds 0.5° at any point during the 2-second window.

**Exit conditions**: Angular error exceeds 1.0° (hysteresis). The 0.5° entry / 1.0° exit gap prevents rapid flickering between locked and tracking states when the user holds the phone near the threshold.

**UI**: "TARGET LOCKED" banner displayed near the top of the screen with a green (#4CAF50) background. The sky guide elements (horizon, diamond, plumb line, crosshair) are hidden when locked to keep the screen clean — only the lock banner and angular distance badge remain. A single haptic pulse fires on lock acquisition. An optional short audio chime plays if enabled in settings.

### 2.5 Error

An unrecoverable (for the current frame) condition has occurred that prevents tracking from continuing.

**Common error causes**:
- Camera permission denied or revoked.
- GPS location unavailable and no cached location exists.
- Magnetometer reports critically low accuracy after calibration attempt.
- Rust engine returns a computation error (e.g., object below horizon during tracking start).
- Device sensors stop reporting data (hardware failure or OS throttling).

**UI**: Semi-transparent dark overlay on camera preview. Error message in center with an icon. Two buttons: "Retry" (attempts re-initialization) and "Back" (returns to ObjectInfoScreen).

---

## 3. Transition Actions

Each state transition triggers specific side effects in the Application Layer:

### 3.1 Idle to Initializing

```typescript
// Dispatched by ObjectInfoScreen "Track" button
dispatch(startTracking(objectId));
// Thunk actions:
// 1. sensorFusionService.start()
// 2. locationService.requestLocation()
// 3. ephemerisEngine.computeRaDec(objectId, now())
// 4. dispatch(setTrackingState('initializing'))
```

### 3.2 Initializing to Tracking

```typescript
// All sensors ready, initial computation complete
dispatch(setTrackingState('tracking'));
// Start the 30+ FPS tracking loop
trackingLoop.start();
```

### 3.3 Tracking to Locked

```typescript
// Lock timer has elapsed (2000ms below 0.5°)
dispatch(setTrackingState('locked'));
hapticFeedback.trigger('impactMedium');
if (preferences.soundEnabled) audioService.playLockChime();
```

### 3.4 Locked to Tracking (Unlock)

```typescript
// Angular error exceeded 0.5°
dispatch(setTrackingState('tracking'));
// Lock timer resets, haptic/audio do not fire on unlock
```

### 3.5 Any State to Error

```typescript
dispatch(setTrackingState('error'));
dispatch(setTrackingError({ code, message }));
trackingLoop.stop();
sensorFusionService.stop();
```

### 3.6 Any Active State to Idle

```typescript
dispatch(stopTracking());
trackingLoop.stop();
sensorFusionService.stop();
locationService.reduceToPassive();
dispatch(setTrackingState('idle'));
```

---

## 4. UI Feedback Per State

| State        | Sky Guide | Distance Badge | Turn/Tilt Hints | Banner Text     | Haptic       | Sound        |
|--------------|-----------|----------------|-----------------|-----------------|--------------|--------------|
| Idle         | Hidden    | No             | No              | None            | None         | None         |
| Initializing | Hidden    | No             | No              | "Preparing..."  | None         | None         |
| Tracking     | Visible   | Yes            | Yes (off-screen)| None            | None         | None         |
| Locked       | Hidden    | Yes ("0.0°")   | No              | "TARGET LOCKED" | Single pulse | Optional chime |
| Error        | Hidden    | No             | No              | Error message   | None         | None         |

### 4.1 Proximity Color Thresholds

The sky guide elements (horizon diamond, plumb dots, target crosshair), the viewport center circle, and the distance badge all change color based on angular distance:

| Angular Distance | Color        | Theme Token    | Meaning              |
|-----------------|--------------|----------------|----------------------|
| > 30°           | Blue         | `colors.primary` | Far from target      |
| 10° to 30°     | Yellow/Amber | `colors.warning` | Getting closer       |
| 1° to 10°      | Green        | `colors.success` | Approaching target   |
| < 1°           | Bright green | `colors.arLocked`| Near target / locked |

The viewport center circle uses a simplified two-tier scheme: dim white (>10°), green (<10°), bright green (<1°). The distance badge background turns green when under 10°.

Color transitions are immediate (no animation blending) to provide clear, unambiguous feedback.

---

## 5. Timing Requirements

| Requirement                  | Target        | Enforcement                                    |
|------------------------------|---------------|------------------------------------------------|
| Initialization time          | < 2 seconds   | Timeout at 5s triggers Error state             |
| Tracking loop frame time     | < 33ms (30 FPS) | Performance monitor logs frame drops          |
| Lock detection window        | 2000ms        | Timer runs in tracking loop, resets on drift   |
| Unlock detection             | Immediate     | Checked every frame; no debounce on unlock     |
| State transition dispatch    | < 5ms         | Redux dispatch is synchronous                  |
| Arrow render update          | Every frame   | Driven by requestAnimationFrame / native loop  |

### 5.1 Lock Timer Implementation

The lock timer is implemented as a monotonic timestamp comparison within the tracking loop:

```typescript
if (angularError < LOCK_THRESHOLD) {
  if (lockStartTime === null) {
    lockStartTime = performance.now();
  } else if (performance.now() - lockStartTime >= LOCK_DURATION_MS) {
    dispatch(setTrackingState('locked'));
  }
} else {
  lockStartTime = null;
  if (currentState === 'locked') {
    dispatch(setTrackingState('tracking'));
  }
}
```

The timer uses `performance.now()` (monotonic clock) rather than `Date.now()` to avoid issues with system clock adjustments.

---

## 6. Magnetometer Calibration

The magnetometer is critical for determining compass heading. When accuracy degrades beyond 10° drift (as reported by the platform sensor API), the tracking system must pause and request user intervention.

### 6.1 Detection

The SensorFusionService monitors the magnetometer accuracy value provided by the OS:
- **Android**: `SensorEvent.accuracy` field (UNRELIABLE, LOW, MEDIUM, HIGH).
- **iOS**: `CLLocationManager.headingFilter` and `CLHeading.headingAccuracy`.

When accuracy drops below the acceptable threshold (MEDIUM on Android, >10° on iOS), the calibration flow activates.

### 6.2 Calibration Prompt

**UI**: A modal overlay appears on the AR screen with:
- An animated illustration showing the figure-8 motion pattern.
- Text: "Compass needs calibration. Move your phone in a figure-8 pattern."
- A progress indicator that fills as accuracy improves.
- A "Skip" button (tracking continues with degraded accuracy; a warning badge remains visible).

### 6.3 Post-Calibration

Once accuracy returns to acceptable levels, the modal dismisses automatically and tracking resumes from the current device orientation. The tracking loop does not need to re-initialize; it simply starts receiving more accurate heading data.

---

## 7. Edge Cases

### 7.1 Object Below Horizon

If the user taps "Track" for an object currently below the horizon, the app shows a confirmation dialog: "Saturn is currently below the horizon. Track anyway?" If confirmed, the AR screen enters Tracking state and displays the arrow pointing downward (below the horizon line), which may be useful for objects about to rise.

### 7.2 Rapid State Toggling

If the user rapidly enters and exits tracking (e.g., tapping Track then immediately Back), the system ensures clean teardown. The initialization process checks a cancellation flag before each async step and aborts gracefully if the user has navigated away.

### 7.3 App Backgrounding During Tracking

When the app moves to the background during active tracking, the tracking loop stops and sensor listeners are unregistered (see [Application Layer Overview §5.2](../06-application-layer/overview.md)). When the app returns to the foreground, the system re-enters the Initializing state to recalibrate sensors before resuming Tracking.

### 7.4 Low Battery

When device battery drops below 15%, the AR screen displays a non-intrusive warning: "Low battery. AR tracking uses significant power." No automatic behavior change occurs; the user decides whether to continue.

---

## 8. State Shape (Zustand Store)

The tracking state is managed by a Zustand store (`useTrackingStore`) rather than Redux. The `ar` field holds the real-time tracking frame, updated at ~30 FPS by the ObjectTrackingService callback:

```typescript
interface ARState {
  altitude: number;         // Target altitude (degrees above horizon)
  azimuth: number;          // Target azimuth (degrees, 0=N, 90=E)
  angularDistance: number;  // Angular separation from device to target (degrees)
  isLocked: boolean;        // True when locked on target
  deviceHeading: number;    // Device compass heading (degrees, 0=N, 90=E)
  deviceElevation: number;  // Device tilt above horizon (degrees, 0=level)
}

interface TrackingState {
  trackedObjects: TrackedObjectInfo[];
  activeTrackingId: number | null;
  ar: ARState | null;        // null when not tracking
  loading: boolean;
  error: string | null;
}
```

The ARScreen component derives all visual elements from `ar`:
- `relativeBearing = ((ar.azimuth - ar.deviceHeading + 540) % 360) - 180` — horizontal offset to target
- `relativeElevation = ar.altitude - ar.deviceElevation` — vertical offset to target
- Proximity color is derived from `ar.angularDistance` using the thresholds in section 4.1
- Lock state comes directly from `ar.isLocked`

---

## 9. Cross-References

| Document                                                              | Relevance                                         |
|-----------------------------------------------------------------------|---------------------------------------------------|
| [SRS FR-4](../02-requirements/srs.md)                                | Real-time position computation requirement        |
| [SRS FR-5](../02-requirements/srs.md)                                | Angular error computation requirement             |
| [SRS FR-6](../02-requirements/srs.md)                                | Arrow color thresholds                            |
| [SRS FR-7](../02-requirements/srs.md)                                | Target lock definition (< 0.5°, 2+ seconds)      |
| [UI/UX Architecture](./overview.md)                                  | ARScreen specification and navigation context     |
| [Application Layer Overview](../06-application-layer/overview.md)    | ObjectTrackingService and SensorFusionService     |
| [Architecture Overview §4](../03-architecture/architecture-overview.md) | Object tracking data flow diagram              |
| [Accessibility](./accessibility.md)                                   | Audio guidance and haptic alternatives for AR mode |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
