# Functional Requirements

## 1. Overview

This document expands the functional requirements FR-1 through FR-23 defined in the [SRS](./srs.md) Section 3. Each requirement includes a unique identifier, title, detailed description, acceptance criteria, priority level, dependencies, and related non-functional requirements. Requirements are grouped by feature area and traced to architecture components described in the [Architecture Overview](../03-architecture/architecture-overview.md).

### Priority Definitions

| Priority | Label | Meaning |
|----------|-------|---------|
| P1 | Must Have | Required for MVP launch; app cannot ship without this |
| P2 | Should Have | Important for user satisfaction; include if schedule permits |
| P3 | Nice to Have | Enhances experience; defer to Phase 2 if needed |

---

## 2. Object Search (FR-1 to FR-3)

**Architecture Component**: CatalogRepository (Data Layer) + SearchScreen (Presentation Layer)

### FR-1: Search Object by Name

| Field | Detail |
|-------|--------|
| **ID** | FR-1 |
| **Title** | User shall search celestial objects by name |
| **Priority** | P1 |
| **Description** | The system provides a text input field where the user enters a partial or full object name. The system performs a case-insensitive substring match against the `objects` table in SQLite and returns matching results ranked by apparent magnitude (brightest first). |
| **Acceptance Criteria** | 1. Entering "Sat" returns "Saturn" as a top result. 2. Entering "M31" returns "M31 (Andromeda Galaxy)." 3. Results appear within 100ms of keystroke. 4. Minimum 1 character required to trigger search. 5. Maximum 20 results displayed per query. |
| **Dependencies** | Pre-loaded catalog in SQLite (`objects` table). See [Schema](../05-data-model/schema.md). |
| **Related NFRs** | NFR-1 (computation < 100ms), NFR-13 (UI responsiveness < 200ms) |

### FR-2: Retrieve Object Metadata

| Field | Detail |
|-------|--------|
| **ID** | FR-2 |
| **Title** | System shall retrieve and display object metadata |
| **Priority** | P1 |
| **Description** | When a search result is selected, the system retrieves and displays: object type (planet, star, nebula, galaxy, moon, sun), Right Ascension, Declination, apparent magnitude, current altitude and azimuth (computed in real-time), and distance in light-years (where available). |
| **Acceptance Criteria** | 1. All metadata fields populated for stars and Messier objects. 2. RA/Dec shown as NULL for planets (computed at runtime). 3. Altitude and azimuth update every second on the info screen. 4. Magnitude displayed to one decimal place. 5. Distance shown in light-years or AU as appropriate. |
| **Dependencies** | FR-1 (search results available), Rust Domain Engine (ephemeris computation). |
| **Related NFRs** | NFR-8 (positional accuracy +/- 1 deg) |

### FR-3: Handle Search Edge Cases

| Field | Detail |
|-------|--------|
| **ID** | FR-3 |
| **Title** | System shall handle search edge cases gracefully |
| **Priority** | P2 |
| **Description** | The system handles the following edge cases: unknown objects return "No results found" with a friendly message; partial matches suggest the closest match by name similarity; empty search input clears results and shows a prompt. |
| **Acceptance Criteria** | 1. Searching "xyz123" displays "No results found." 2. Searching "Andromed" returns "M31 (Andromeda Galaxy)." 3. Empty input shows "Type a star, planet, or object name." 4. Special characters in input do not cause crashes or SQL injection. |
| **Dependencies** | FR-1, sanitized input handling. |
| **Related NFRs** | NFR-7 (crash rate < 0.1%) |

---

## 3. Real-Time Object Tracking (FR-4 to FR-7)

**Architecture Component**: Rust Domain Engine (ephemeris + coordinate transforms) + SensorFusionService + TrackingService + ARScreen

### FR-4: Compute Object Position in Real-Time

| Field | Detail |
|-------|--------|
| **ID** | FR-4 |
| **Title** | System shall compute object position in real-time |
| **Priority** | P1 |
| **Description** | The system computes the target object's altitude and azimuth from the observer's location and current time, then transforms this into a 3D direction vector. Computation runs at 30+ FPS using the Rust domain engine. Inputs: device GPS coordinates, system UTC time, object RA/Dec (fixed for stars; computed for planets). |
| **Acceptance Criteria** | 1. Update frequency >= 30 frames per second. 2. End-to-end latency from sensor read to screen update < 15ms. 3. Position stable (no jitter > 0.5 deg) when device is held steady. 4. Works for all catalog objects (stars, planets, Messier). |
| **Dependencies** | GPS location available, IMU data stream active, Rust engine FFI bridge operational. |
| **Related NFRs** | NFR-1 (position computation < 10ms), NFR-4 (battery < 10%/hr in AR mode) |

### FR-5: Compute Angular Error

| Field | Detail |
|-------|--------|
| **ID** | FR-5 |
| **Title** | System shall compute angular error between device direction and object direction |
| **Priority** | P1 |
| **Description** | The system computes the angular distance (in degrees) between the 3D vector representing the camera's pointing direction (derived from device orientation quaternion Q_device) and the 3D vector pointing toward the target object (V_target). This value drives the guidance arrow and proximity indicators. See [Algorithms Section 4](../04-domain-engine/algorithms.md#4-angular-distance). |
| **Acceptance Criteria** | 1. Angular error accurate to +/- 1 deg under nominal conditions. 2. Returns 0.0 when device points exactly at target. 3. Returns 180.0 when device points opposite to target. 4. Handles edge case: object directly overhead (zenith). 5. Handles edge case: object below horizon (negative altitude). |
| **Dependencies** | FR-4 (position computation), SensorFusionService (Q_device). |
| **Related NFRs** | NFR-8 (positional accuracy), NFR-10 (orientation accuracy) |

### FR-6: Render Directional Guidance

| Field | Detail |
|-------|--------|
| **ID** | FR-6 |
| **Title** | System shall render directional guidance overlay on AR screen |
| **Priority** | P1 |
| **Description** | An on-screen arrow indicates the direction the user should move the camera to align with the target object. The arrow's color changes based on angular proximity: red when > 5 deg away, yellow when 1-5 deg away, green when < 1 deg away. The arrow rotates to indicate the direction of movement (left, right, up, down, or diagonal). |
| **Acceptance Criteria** | 1. Arrow visible on AR camera preview at all times during tracking. 2. Arrow color transitions smoothly between red/yellow/green zones. 3. Arrow rotation is smooth (no snapping or flickering). 4. Arrow remains visible against both dark sky and light-polluted sky backgrounds. 5. Arrow size adapts to screen dimensions. |
| **Dependencies** | FR-5 (angular error), FR-4 (position), ARCore/ARKit camera feed. |
| **Related NFRs** | NFR-13 (60 FPS animations), NFR-14 (high contrast mode) |

### FR-7: Indicate Target Lock State

| Field | Detail |
|-------|--------|
| **ID** | FR-7 |
| **Title** | System shall indicate when device is aligned with target |
| **Priority** | P1 |
| **Description** | When the angular error between device direction and target direction falls below 0.5 deg and remains below this threshold for at least 2 continuous seconds, the system displays a "TARGET LOCKED" indicator. An optional audio cue (short tone) accompanies the visual indicator. The lock state clears if angular error exceeds 1.0 deg. |
| **Acceptance Criteria** | 1. "TARGET LOCKED" displayed when error < 0.5 deg for >= 2 seconds. 2. Lock indicator clears when error > 1.0 deg (hysteresis prevents flickering). 3. Visual indicator is prominent and readable in dark conditions. 4. Audio cue is optional and respects device mute/volume settings. 5. Lock state persisted in tracking state for the session. |
| **Dependencies** | FR-5 (angular error), FR-6 (guidance rendering). |
| **Related NFRs** | NFR-8 (positional accuracy), NFR-13 (UI responsiveness) |

---

## 4. Visibility Computation (FR-8 to FR-12)

**Architecture Component**: Rust Domain Engine (coordinate transforms + visibility logic) + VisibilityService

### FR-8: Compute Current Altitude

| Field | Detail |
|-------|--------|
| **ID** | FR-8 |
| **Title** | System shall compute the current altitude of a celestial object |
| **Priority** | P1 |
| **Description** | The system computes the altitude (angle above the horizon, -90 to +90 degrees) of any catalog object from the observer's latitude, longitude, and current UTC time. Uses the RA/Dec to Alt/Az transformation described in [Algorithms Section 3.1](../04-domain-engine/algorithms.md#31-radec-to-altitudeazimuth). |
| **Acceptance Criteria** | 1. Computation completes in <= 10ms. 2. Altitude accurate to +/- 0.5 deg for stars. 3. Altitude accurate to +/- 1.0 deg for planets (due to ephemeris approximation). 4. Returns negative values for objects below the horizon. 5. Handles polar locations (lat > 80 deg) without numerical instability. |
| **Dependencies** | Rust Domain Engine, observer GPS coordinates, system time. |
| **Related NFRs** | NFR-1 (< 10ms), NFR-8 (accuracy) |

### FR-9: Determine Visibility Status

| Field | Detail |
|-------|--------|
| **ID** | FR-9 |
| **Title** | System shall determine and display visibility status |
| **Priority** | P1 |
| **Description** | The system classifies each object into one of three visibility states: "Visible now" (altitude > 0 deg and sun below -6 deg), "Rises at [TIME]" (object below horizon but will rise within 48 hours, with sun below -6 deg at that time), or "Not visible from your location" (object never rises at this latitude). |
| **Acceptance Criteria** | 1. Correct status displayed for Polaris at lat 45N ("Visible now" or "Always visible"). 2. Correct status for Canopus at lat 45N ("Not visible from your location"). 3. Rise time shown in user's local timezone. 4. "Visible now" status includes current altitude value. 5. Status refreshes every 60 seconds on the info screen. |
| **Dependencies** | FR-8 (altitude computation), FR-10 (sun filtering), FR-13/FR-14 (rise/set). |
| **Related NFRs** | NFR-8 (accuracy), NFR-9 (time accuracy) |

### FR-10: Filter by Sun Brightness

| Field | Detail |
|-------|--------|
| **ID** | FR-10 |
| **Title** | System shall filter visibility by sun altitude |
| **Priority** | P1 |
| **Description** | An object is only classified as "Visible now" when the Sun's altitude is below -6 deg (civil twilight threshold). This prevents the system from showing objects as visible during daylight or bright twilight when they cannot be observed with the naked eye. See [Algorithms Section 6.1](../04-domain-engine/algorithms.md#61-sun-altitude-constraint). |
| **Acceptance Criteria** | 1. Objects not marked "Visible now" if Sun altitude > -6 deg. 2. Sun altitude computed using the same ephemeris engine as other objects. 3. Twilight state displayed on info screen: "Daylight," "Civil Twilight," "Nautical Twilight," "Astronomical Twilight," or "Night." 4. Visibility alerts only fire when sun constraint is satisfied. |
| **Dependencies** | FR-8 (altitude for Sun), Rust Domain Engine (Sun ephemeris). |
| **Related NFRs** | NFR-6 (mathematical correctness) |

### FR-11: Handle Circumpolar Objects

| Field | Detail |
|-------|--------|
| **ID** | FR-11 |
| **Title** | System shall detect and display circumpolar objects |
| **Priority** | P2 |
| **Description** | When an object's declination is such that it never dips below the horizon at the observer's latitude (condition: |latitude| + |declination| > 90 deg for same-hemisphere objects), the system displays "Always visible from your location" instead of a rise/set time. See [Algorithms Section 5.1](../04-domain-engine/algorithms.md#51-analytical-solution-for-fixed-stars). |
| **Acceptance Criteria** | 1. Polaris marked "Always visible" for all Northern Hemisphere locations. 2. Sigma Octantis marked "Always visible" for Southern Hemisphere locations. 3. No rise/set time shown for circumpolar objects. 4. Circumpolar objects still show current altitude and azimuth. 5. Alert can still be set for circumpolar objects (notify at peak altitude). |
| **Dependencies** | FR-8, FR-13 (rise/set calculation returns circumpolar flag). |
| **Related NFRs** | NFR-6 (mathematical correctness) |

### FR-12: Detect Never-Visible Objects

| Field | Detail |
|-------|--------|
| **ID** | FR-12 |
| **Title** | System shall detect and display never-visible objects |
| **Priority** | P2 |
| **Description** | When an object's declination is such that it never rises above the horizon at the observer's latitude, the system displays "Not visible from your location." For objects with seasonal visibility (e.g., the Sun in polar regions), the system suggests the next visible date if within 1 year. |
| **Acceptance Criteria** | 1. Canopus (Dec -52.7 deg) marked "Not visible" at lat 45N. 2. Southern Messier objects correctly flagged at high northern latitudes. 3. No alert option for never-visible objects. 4. Informational message: "This object does not rise above the horizon at your latitude." |
| **Dependencies** | FR-8, FR-13 (rise/set calculation returns never-visible flag). |
| **Related NFRs** | NFR-6 (mathematical correctness) |

---

## 5. Rise/Set Calculation (FR-13 to FR-15)

**Architecture Component**: Rust Domain Engine (RiseSetSolver module)

### FR-13: Compute Rise Time for Stars

| Field | Detail |
|-------|--------|
| **ID** | FR-13 |
| **Title** | System shall compute rise time for fixed stars |
| **Priority** | P1 |
| **Description** | For objects with fixed RA/Dec (stars, Messier objects), the system uses the analytical Hour Angle formula to compute rise and set times. The formula computes cos(H0) = -tan(lat) * tan(Dec). If |cos(H0)| > 1, the object is either circumpolar or never-visible. |
| **Acceptance Criteria** | 1. Rise time accurate to +/- 2 minutes compared to USNO data. 2. Returns "circumpolar" when |cos(H0)| > 1 and object is above horizon. 3. Returns "never visible" when |cos(H0)| > 1 and object is below horizon. 4. Computation completes in < 50ms per object. 5. Results in user's local timezone. |
| **Dependencies** | Rust Domain Engine, observer location, current date. |
| **Related NFRs** | NFR-2 (rise/set < 500ms), NFR-8 (accuracy +/- 2 min) |

### FR-14: Compute Rise Time for Planets

| Field | Detail |
|-------|--------|
| **ID** | FR-14 |
| **Title** | System shall compute rise time for planets |
| **Priority** | P1 |
| **Description** | For objects with changing RA/Dec (planets, Sun, Moon), the system uses an iterative scan algorithm. It steps forward in 5-minute increments over a 48-hour window, computing altitude at each step. When altitude crosses from negative to positive, a binary search refines the crossing time to sub-minute accuracy. |
| **Acceptance Criteria** | 1. Rise time accurate to +/- 5 minutes compared to USNO data. 2. Scans 48 hours forward from current time. 3. Handles Moon (fast-moving: ~13 deg/day). 4. Returns "No rise in 48 hours" if object remains below horizon. 5. Computation completes in < 500ms per object. |
| **Dependencies** | Rust Domain Engine (planet ephemeris via VSOP87). |
| **Related NFRs** | NFR-2 (< 500ms), NFR-8 (accuracy) |

### FR-15: Compute Optimal Altitude (Culmination)

| Field | Detail |
|-------|--------|
| **ID** | FR-15 |
| **Title** | System shall compute the time of maximum altitude for each object |
| **Priority** | P2 |
| **Description** | For each visible object, the system computes the culmination time (when the object reaches its highest altitude during the current night). This enables "best viewing time" recommendations. For circumpolar objects, this is the upper culmination. |
| **Acceptance Criteria** | 1. Culmination time accurate to +/- 5 minutes. 2. Maximum altitude value displayed in degrees. 3. Clearly labeled as "Best viewing time" on the info screen. 4. For circumpolar objects, shows upper culmination. 5. Computation completes within the rise/set calculation window (< 500ms total). |
| **Dependencies** | FR-13 or FR-14 (rise/set calculation). |
| **Related NFRs** | NFR-2 (performance), NFR-8 (accuracy) |

---

## 6. Alarm Scheduling (FR-16 to FR-19)

**Architecture Component**: AlarmScheduler (Application Layer) + OS Notification APIs + SQLite (`tracked_objects` table)

### FR-16: Set Visibility Alarm

| Field | Detail |
|-------|--------|
| **ID** | FR-16 |
| **Title** | User shall set a visibility alarm for a celestial object |
| **Priority** | P1 |
| **Description** | From the object info screen, the user taps "Set Alert" to create a visibility alarm. The user chooses between a one-time alert ("Notify when next visible") or a recurring daily alert. The system confirms with: "Alert set for [OBJECT] at [DATE TIME]." |
| **Acceptance Criteria** | 1. "Set Alert" button visible on object info screen. 2. Alert type selection: one-time or recurring. 3. Confirmation message displays object name and scheduled time. 4. Alert stored in SQLite `tracked_objects` table. 5. Duplicate alert for same object prevented (update existing instead). |
| **Dependencies** | FR-9 (visibility status), FR-13/FR-14 (rise/set time), SQLite schema. |
| **Related NFRs** | NFR-5 (offline operation), NFR-11 (data consistency) |

### FR-17: Schedule OS Notification

| Field | Detail |
|-------|--------|
| **ID** | FR-17 |
| **Title** | System shall schedule an OS-level notification for the alarm |
| **Priority** | P1 |
| **Description** | The system registers a local notification with the OS notification service. On Android, this uses AlarmManager or WorkManager. On iOS, this uses UNUserNotificationCenter. The notification fires at the computed rise time and includes the object name, rising direction, and altitude. |
| **Acceptance Criteria** | 1. Notification delivered within +/- 1 minute of scheduled time. 2. Notification body includes: "[OBJECT] is now visible. Look [DIRECTION]." 3. Notification respects Do Not Disturb settings. 4. Notification works when app is backgrounded or killed. 5. Notification tap opens app to the object's info screen. |
| **Dependencies** | FR-16 (alarm created), OS notification permissions granted. |
| **Related NFRs** | NFR-5 (offline operation -- local notifications only) |

### FR-18: Recompute Alarms Daily

| Field | Detail |
|-------|--------|
| **ID** | FR-18 |
| **Title** | System shall recompute all alarm times daily |
| **Priority** | P1 |
| **Description** | A background task runs at midnight (device-local time) to recalculate the next visible time for all tracked objects. Updated times are written to SQLite and new OS notifications are scheduled. This handles date advancement, location changes, and seasonal position shifts. |
| **Acceptance Criteria** | 1. Recalculation triggers at midnight local time (+/- 5 minutes). 2. All tracked objects updated (batch: < 5s for 100 objects). 3. Stale notifications (past due) canceled and replaced. 4. Handles timezone changes (e.g., user travels). 5. Handles Daylight Saving Time transitions. 6. No user interaction required. |
| **Dependencies** | FR-16/FR-17 (alarms exist), WorkManager (Android) / BackgroundTasks (iOS). |
| **Related NFRs** | NFR-2 (batch recalculation < 5s), NFR-4 (background battery < 1%/hr) |

### FR-19: Alarm Management UI

| Field | Detail |
|-------|--------|
| **ID** | FR-19 |
| **Title** | System shall provide alarm management interface |
| **Priority** | P2 |
| **Description** | A dedicated screen lists all active alarms, showing the object name, next notification time, alarm type (one-time/recurring), and minimum altitude threshold. Users can delete individual alarms or edit the altitude threshold. |
| **Acceptance Criteria** | 1. All active alarms displayed in chronological order. 2. Swipe-to-delete or delete button per alarm. 3. Edit altitude threshold (default 10 deg). 4. Empty state: "No alarms set. Search for an object to get started." 5. Alarm count badge on navigation tab. |
| **Dependencies** | FR-16 (alarms exist), SQLite `tracked_objects` table. |
| **Related NFRs** | NFR-13 (UI responsiveness < 200ms) |

---

## 7. User Interface (FR-20 to FR-23)

**Architecture Component**: Presentation Layer (React Native screens + state management)

### FR-20: Search Screen

| Field | Detail |
|-------|--------|
| **ID** | FR-20 |
| **Title** | System shall provide a search screen |
| **Priority** | P1 |
| **Description** | The search screen contains a text input field at the top, with search results displayed as a scrollable list below. Each result shows the object name, type icon, and apparent magnitude. Tapping a result navigates to the object info screen. |
| **Acceptance Criteria** | 1. Text input auto-focuses on screen open. 2. Results update as user types (debounced at 100ms). 3. Each result shows: name, type (icon), magnitude. 4. Tap navigates to object info screen (FR-22). 5. Keyboard dismisses on scroll. |
| **Dependencies** | FR-1 (search logic), FR-2 (metadata). |
| **Related NFRs** | NFR-13 (< 200ms response), NFR-14 (accessibility) |

### FR-21: AR Tracking Screen

| Field | Detail |
|-------|--------|
| **ID** | FR-21 |
| **Title** | System shall provide an AR tracking screen |
| **Priority** | P1 |
| **Description** | The AR tracking screen displays a live camera preview with a directional arrow overlay, angular distance indicator (e.g., "3.2 deg away"), target lock indicator, and a back button to return to info screen. The screen prevents auto-lock/screen-off during active tracking. |
| **Acceptance Criteria** | 1. Camera preview fills screen (ARCore/ARKit). 2. Directional arrow rendered at 30+ FPS. 3. Angular distance displayed numerically with one decimal place. 4. "TARGET LOCKED" indicator when aligned (FR-7). 5. Screen auto-lock disabled during tracking. 6. Back button returns to object info screen. |
| **Dependencies** | FR-4 through FR-7 (tracking logic), camera permissions. |
| **Related NFRs** | NFR-1 (30+ FPS), NFR-4 (battery), NFR-13 (60 FPS animations) |

### FR-22: Object Info Screen

| Field | Detail |
|-------|--------|
| **ID** | FR-22 |
| **Title** | System shall provide an object information screen |
| **Priority** | P1 |
| **Description** | The object info screen displays all metadata for a selected object: name, type, magnitude, distance, current altitude, azimuth, rise/set times, culmination time, and visibility status. A "Track" button opens the AR screen (FR-21). A "Set Alert" button creates a visibility alarm (FR-16). |
| **Acceptance Criteria** | 1. All metadata fields displayed and labeled. 2. Altitude and azimuth update every second. 3. "Track" button opens AR screen with this object as target. 4. "Set Alert" button opens alarm creation flow. 5. Visibility status prominently displayed at top. |
| **Dependencies** | FR-2 (metadata), FR-9 (visibility), FR-13/FR-14 (rise/set). |
| **Related NFRs** | NFR-13 (UI responsiveness), NFR-14 (accessibility) |

### FR-23: Alarm Management Screen

| Field | Detail |
|-------|--------|
| **ID** | FR-23 |
| **Title** | System shall provide an alarm management screen |
| **Priority** | P2 |
| **Description** | Identical to FR-19 description. This is the UI implementation of the alarm management feature, accessible from the main navigation tab bar. |
| **Acceptance Criteria** | See FR-19 acceptance criteria. Additionally: 1. Accessible from bottom tab navigation. 2. Pull-to-refresh triggers immediate alarm recalculation. 3. Tapping an alarm navigates to that object's info screen (FR-22). |
| **Dependencies** | FR-19 (alarm management logic). |
| **Related NFRs** | NFR-13 (UI responsiveness), NFR-14 (accessibility) |

---

## 8. Requirements Traceability

### 8.1 FR to Architecture Component Mapping

| FR Range | Feature Area | Architecture Component(s) |
|----------|-------------|--------------------------|
| FR-1 to FR-3 | Object Search | CatalogRepository, SearchScreen |
| FR-4 to FR-7 | Real-Time Tracking | Rust Domain Engine, SensorFusionService, TrackingService, ARScreen |
| FR-8 to FR-12 | Visibility | Rust Domain Engine (CoordinateEngine, VisibilityLogic) |
| FR-13 to FR-15 | Rise/Set | Rust Domain Engine (RiseSetSolver) |
| FR-16 to FR-19 | Alarms | AlarmScheduler, SQLite, OS Notification API |
| FR-20 to FR-23 | User Interface | React Native Screens, State Management |

### 8.2 FR to Test Mapping

Each functional requirement maps to at least one test case in the [Testing Strategy](../08-testing/overview.md):

| FR | Test Type | Test Reference |
|----|-----------|---------------|
| FR-1 | Unit + Integration | Search substring test, search performance test |
| FR-4 | Benchmark | AR frame rate benchmark (< 10ms) |
| FR-5 | Unit | Angular error vector math tests |
| FR-8 | Unit + Validation | Altitude test against USNO data |
| FR-13 | Unit + Validation | Rise time test against USNO data |
| FR-14 | Unit + Validation | Planet rise iterative scan test |
| FR-16 | Integration | Alarm scheduling end-to-end flow |
| FR-18 | Integration | Daily recalculation test |

---

## 9. Cross-References

| Document | Relationship |
|----------|-------------|
| [SRS](./srs.md) | Source requirements FR-1 to FR-23 and NFR-1 to NFR-14 |
| [Non-Functional Requirements](./non-functional-requirements.md) | Performance and accuracy targets for each FR |
| [Architecture Overview](../03-architecture/architecture-overview.md) | Component mapping and data flow |
| [Algorithms](../04-domain-engine/algorithms.md) | Mathematical basis for FR-4 through FR-15 |
| [Database Schema](../05-data-model/schema.md) | Data structures supporting FR-1 through FR-3 and FR-16 through FR-19 |
| [Testing Strategy](../08-testing/overview.md) | Test cases validating each FR |
| [User Personas](../01-product/personas.md) | User scenarios driving acceptance criteria |
| [Feature Scope](../01-product/scope.md) | Phase boundaries for each FR |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Engineering Team
