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
| Tracking       | Locked         | Angular error < 0.5° sustained for 2+ seconds   |
| Tracking       | Idle           | User taps "Stop" or "Back"                       |
| Tracking       | Error          | Sensor failure, computation exception            |
| Locked         | Tracking       | Angular error exceeds 0.5° (immediate unlock)    |
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
3. Convert target alt/az to a 3D unit vector.
4. Compute angular error between device direction and target vector.
5. Determine arrow rotation angle and color.
6. Dispatch updated tracking result to Redux store.
7. Check lock condition (angle < 0.5°).

**UI**: Directional arrow visible, rotating toward target. Angular distance badge updates every frame. Arrow color reflects proximity (see section 4).

### 2.4 Locked

The target has been acquired. The device is pointing within 0.5° of the object and has held this alignment for at least 2 consecutive seconds.

**Entry conditions**: Angular error < 0.5° sustained for 2000ms. The timer resets if the angle exceeds 0.5° at any point during the 2-second window.

**Exit conditions**: Angular error exceeds 0.5° at any point. The unlock is immediate (no hysteresis delay) to provide responsive feedback when the user drifts off target.

**UI**: "TARGET LOCKED" banner displayed at the top of the screen with a green (#4CAF50) background. The arrow turns bright green and stops rotating (it points straight up, indicating alignment). A single haptic pulse fires on lock acquisition. An optional short audio chime plays if enabled in settings.

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

| State        | Arrow Visible | Arrow Color | Distance Badge | Banner Text       | Haptic       | Sound        |
|--------------|---------------|-------------|----------------|-------------------|--------------|--------------|
| Idle         | No            | N/A         | No             | None              | None         | None         |
| Initializing | No            | N/A         | No             | "Preparing..."    | None         | None         |
| Tracking     | Yes           | Red/Yellow/Green | Yes        | None              | None         | None         |
| Locked       | Yes (static)  | Green       | Yes ("0.0°")   | "TARGET LOCKED"   | Single pulse | Optional chime |
| Error        | No            | N/A         | No             | Error message     | None         | None         |

### 4.1 Arrow Color Thresholds

These thresholds are defined in [SRS FR-6](../02-requirements/srs.md) and are non-configurable:

| Angular Distance | Color   | Hex Code | Meaning             |
|-----------------|---------|----------|---------------------|
| > 5°            | Red     | #F44336  | Far from target     |
| 1° to 5°       | Yellow  | #FFC107  | Approaching target  |
| < 1°           | Green   | #4CAF50  | Near target         |

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

## 8. Redux State Shape

The `trackingSlice` in the Redux store reflects the current state machine position:

```typescript
interface TrackingState {
  state: 'idle' | 'initializing' | 'tracking' | 'locked' | 'error';
  activeObject: CelestialObject | null;
  angularError: number;           // degrees, 0.0 = perfect alignment
  arrowRotation: number;          // degrees, direction to rotate arrow
  arrowColor: 'red' | 'yellow' | 'green';
  lockStartTime: number | null;   // monotonic timestamp, null if not approaching lock
  fps: number;                    // current frame rate (debug)
  error: TrackingError | null;    // populated only in Error state
  needsCalibration: boolean;      // true when magnetometer accuracy degraded
}
```

Selectors derived from this state determine all visual elements on the ARScreen. Components never compute arrow color or lock status directly; they read pre-computed values from Redux selectors.

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
