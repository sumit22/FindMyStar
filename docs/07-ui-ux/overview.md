# UI/UX Architecture

> **Related Documents**: [Architecture Overview](../03-architecture/architecture-overview.md) | [Design Principles](../03-architecture/design-principles.md) | [SRS](../02-requirements/srs.md) | [Application Layer Overview](../06-application-layer/overview.md)

This document defines the user interface architecture, navigation structure, screen specifications, state management, theming, and performance targets for the FindMyStar mobile application. All UI decisions are grounded in the principle that FindMyStar is a **focused celestial object finder**, not a general-purpose planetarium.

---

## 1. Design Philosophy

### 1.1 Minimal, Focused Interface

FindMyStar exists to answer one question: **"Where is that object in the sky right now?"** Every screen, component, and interaction serves this singular purpose. Features that do not directly help the user find or track a celestial object are deferred or excluded.

- No star maps, constellation overlays, or sky simulations.
- No social features, sharing, or community content.
- No tutorial wizards or onboarding carousels beyond a single permission prompt.
- The interface stays out of the way so the user can focus on the sky.

### 1.2 Dark Theme by Default

The application launches in dark mode because stargazing happens at night:

- **Dark theme** (default): Near-black backgrounds (#0D0D0D), white and amber text, minimal bright surfaces. Designed for comfortable use in low-light outdoor conditions.
- **Night mode** (optional): A red-tinted variant that preserves the user's dark adaptation. All non-essential UI elements shift to deep red (#8B0000) tones. White text becomes red (#CC3333). This follows established practice among astronomy applications.
- **System theme** (optional): Follows the OS light/dark setting for users who prefer consistency with their device.

### 1.3 One-Hand Operable

During AR tracking, the user holds the phone up toward the sky with one hand. The interface must be fully operable in this posture:

- Primary actions (back, stop tracking) are reachable with the thumb in portrait orientation.
- No gestures that require two hands (pinch, multi-finger swipe).
- Critical information (arrow, angular distance) is rendered at center-screen, not at edges.
- The tab bar is positioned at the bottom of the screen, within natural thumb reach.

### 1.4 Maximum Three Taps to Track

From app launch to active AR tracking of any object, the user completes at most three interactions:

1. **Type** object name in the search field (auto-focused on launch).
2. **Tap** a search result to open the object info screen.
3. **Tap** "Track" to enter the AR screen.

This three-tap ceiling applies to every object in the catalog, regardless of type.

---

## 2. Navigation Structure

FindMyStar uses a bottom tab bar with three primary destinations and a stack-based navigation flow within each tab:

```
App Launch
├── SearchScreen (Home / Default Tab)
│   ├── Tap result → ObjectInfoScreen
│   │   ├── "Track" → ARScreen
│   │   └── "Set Alert" → AlarmScreen (with pre-filled object)
│   └── Tab: Alarms → AlarmScreen
└── Tab Bar: [Search] [Alarms] [Settings]
```

### 2.1 Tab Bar

| Tab      | Icon          | Screen         | Description                        |
|----------|---------------|----------------|------------------------------------|
| Search   | Magnifying glass | SearchScreen | Default landing screen             |
| Alarms   | Bell          | AlarmScreen    | Manage visibility alerts           |
| Settings | Gear          | SettingsScreen | Theme, notifications, about        |

The Search tab is selected by default on every cold launch. The tab bar is hidden during AR tracking to maximize screen real estate.

### 2.2 Stack Navigation

Each tab maintains its own navigation stack. Pushing a new screen animates from right. The back gesture (swipe from left edge or back button) pops the stack. Deep links from notifications push directly onto the Search tab stack: Notification tap opens `SearchScreen > ObjectInfoScreen` with the relevant object pre-loaded.

---

## 3. Screen Specifications

### 3.1 SearchScreen

**Purpose**: Entry point for finding celestial objects by name.

**Layout**:
- Text input field at the top, auto-focused on launch.
- Real-time search results rendered as a scrollable list below the input.
- Search is debounced at 300ms to avoid excessive catalog queries.

**Result Item**:
- Object name (primary text, bold).
- Object type icon (planet, star, nebula, galaxy, cluster).
- Apparent magnitude value.
- Current visibility badge: "Visible" (green), "Below Horizon" (gray), or "Rises at HH:MM" (amber).

**States**:

| State      | Condition                  | Display                                      |
|------------|----------------------------|----------------------------------------------|
| Empty      | No query entered           | Prompt text: "Search stars, planets, and more" |
| Loading    | Query in progress          | Skeleton loader on result list                |
| Results    | Matches found              | Scrollable result list                        |
| No Results | Query returned empty       | "No objects found for '[query]'"              |
| Error      | Catalog query failed       | "Something went wrong. Tap to retry."         |

**Keyboard Behavior**:
- Keyboard appears automatically when the screen mounts.
- Scrolling the results list dismisses the keyboard.
- Tapping the search field re-shows the keyboard.

**Cross-references**: [SRS FR-1](../02-requirements/srs.md), [SRS FR-2](../02-requirements/srs.md), [SRS FR-20](../02-requirements/srs.md)

### 3.2 ARScreen

**Purpose**: Real-time augmented reality guidance to locate a celestial object.

**Layout**:
- Full-screen live camera preview (no system UI chrome except status bar).
- Directional arrow overlay, centered on screen, rotating to point toward the target object.
- Angular distance badge displayed below the arrow: e.g., "3.2° away".
- Color coding follows proximity thresholds defined in [SRS FR-6](../02-requirements/srs.md):

| Distance        | Arrow Color | Meaning              |
|-----------------|-------------|----------------------|
| > 5°            | Red         | Far from target      |
| 1° to 5°       | Yellow      | Approaching target   |
| < 1°           | Green       | Near target          |

- **Target lock indicator**: When angular error falls below 0.5° and is maintained for 2 or more seconds, a "TARGET LOCKED" banner appears at the top of the screen with a green background. Optional haptic feedback (single pulse) fires on lock acquisition. See [SRS FR-7](../02-requirements/srs.md).
- **Object label**: The target object name and type are displayed in a semi-transparent pill at the top-left.
- **Back button**: Top-left corner, returns to ObjectInfoScreen.
- **Stop button**: Bottom-center, ends tracking and returns to ObjectInfoScreen.
- **Debug overlay** (debug builds only): FPS counter, sensor accuracy, and magnetometer heading displayed in a translucent footer.

**Cross-references**: [SRS FR-4](../02-requirements/srs.md) through [FR-7](../02-requirements/srs.md), [SRS FR-21](../02-requirements/srs.md), [Tracking States](./tracking-states.md)

### 3.3 ObjectInfoScreen

**Purpose**: Display detailed information about a celestial object and provide actions.

**Layout**:
- **Header**: Object name (large, bold) with type icon and type label.
- **Position card**: Current altitude and azimuth, updating in real-time (1 Hz refresh). Compass direction label (e.g., "Southeast, 42° above horizon").
- **Visibility status badge**:
  - "Visible Now" (green) — altitude > 0° and sun below -6°.
  - "Below Horizon" (gray) — altitude <= 0°.
  - "Rises at HH:MM" (amber) — next rise time within 48 hours.
  - "Not Visible" (red) — never rises from current location.
- **Rise/Set table**: Today's rise time, set time, and transit (culmination) time with maximum altitude.
- **Details section**: Magnitude, distance (light-years or AU as appropriate), and a brief description of the object.
- **Action buttons** (bottom, sticky):
  - "Track" (primary, filled) — navigates to ARScreen with this object.
  - "Set Alert" (secondary, outlined) — navigates to AlarmScreen with this object pre-filled.

**Cross-references**: [SRS FR-22](../02-requirements/srs.md), [SRS FR-8](../02-requirements/srs.md) through [FR-15](../02-requirements/srs.md)

### 3.4 AlarmScreen

**Purpose**: Manage visibility alerts for tracked celestial objects.

**Layout**:
- Sorted list of alarms, ordered by next notification time (soonest first).
- Each alarm item displays:
  - Object name and type icon.
  - Next notification time (e.g., "Tomorrow, 9:30 PM").
  - Altitude threshold (e.g., "When above 10°").
  - Recurring badge (clock icon if daily, single-dot if one-time).
- **Swipe-to-delete gesture**: Swipe left reveals a red "Delete" button. Confirmation dialog before removal.
- **Tap to edit**: Opens an inline editor for alarm parameters (minimum altitude slider, recurring toggle).
- **Empty state**: Illustration of a night sky with the message "No alarms set. Search for an object to get started." and a button linking to SearchScreen.
- **Pull-to-refresh**: Manually triggers recalculation of all alarm times.

**Cross-references**: [SRS FR-16](../02-requirements/srs.md) through [FR-19](../02-requirements/srs.md), [SRS FR-23](../02-requirements/srs.md), [Alarm & Notification UX](./alarm-feedback.md)

---

## 4. State Management (Redux)

The Presentation Layer reads application state exclusively through Redux selectors and dispatches actions through Redux thunks. Services in the Application Layer are called by thunks, not by components directly. See [Application Layer Overview §6](../06-application-layer/overview.md) for the full data flow.

### 4.1 Store Structure

```
store/
├── searchSlice      { query, results, loading, error }
├── trackingSlice    { activeObject, direction, angle, locked, fps, state }
├── alarmsSlice      { alarms[], loading, lastRecalculated }
├── locationSlice    { lat, lon, accuracy, lastUpdated, isAvailable }
└── preferencesSlice { theme, notificationsEnabled, minAltitude, hapticEnabled }
```

### 4.2 Selector Patterns

Selectors are memoized using `createSelector` (reselect) to prevent unnecessary re-renders. Derived values such as visibility status, formatted rise/set times, and arrow color are computed in selectors, not in components.

### 4.3 Action Flow Example

```
User types "Saturn" → dispatch(setSearchQuery("Saturn"))
  → searchThunk debounces 300ms
  → calls CatalogRepository.findByName("Saturn")
  → dispatch(setSearchResults(results))
  → SearchScreen re-renders with results via useSelector
```

---

## 5. Theming

### 5.1 Theme Definitions

| Token               | Dark Theme   | Night Mode    | Light Theme   |
|----------------------|-------------|---------------|---------------|
| `background`         | #0D0D0D     | #0D0000       | #FFFFFF       |
| `surface`            | #1A1A1A     | #1A0000       | #F5F5F5       |
| `textPrimary`        | #FFFFFF     | #CC3333       | #1A1A1A       |
| `textSecondary`      | #B0B0B0     | #993333       | #666666       |
| `accent`             | #FFC107     | #CC3333       | #1976D2       |
| `success`            | #4CAF50     | #663333       | #4CAF50       |
| `warning`            | #FF9800     | #CC6600       | #FF9800       |
| `error`              | #F44336     | #CC3333       | #F44336       |

### 5.2 Theme Switching

Theme selection is stored in `preferencesSlice` and persisted to AsyncStorage. Changes take effect immediately without app restart. The "System" option registers a listener on the OS appearance change event and updates the Redux store accordingly.

---

## 6. Responsive Design

### 6.1 Orientation Support

- **Portrait**: Default orientation for SearchScreen, ObjectInfoScreen, and AlarmScreen.
- **Landscape**: Supported on all screens. AR screen recommends landscape for wider field of view (a subtle prompt appears on first use).
- **Orientation lock**: The AR screen does not auto-rotate; the user's current orientation is maintained to prevent disorienting flips while pointing at the sky.

### 6.2 Tablet Support

- Layout scales to fill larger screens with appropriate padding and maximum content width (600dp).
- Tap targets are enlarged to at least 48x48dp on tablets.
- Split-view and slide-over are supported on iPadOS.

### 6.3 Safe Areas

All content respects device safe areas (notch, home indicator, status bar). The AR camera preview extends edge-to-edge behind safe area insets, but interactive elements remain within safe boundaries.

---

## 7. Performance Targets

| Metric                  | Target     | Rationale                                          |
|-------------------------|------------|----------------------------------------------------|
| UI interaction response | < 200ms    | Perceived instant feedback ([SRS NFR-13](../02-requirements/srs.md)) |
| Screen transition       | < 300ms    | Smooth navigation without jarring delays           |
| AR frame rate           | 30+ FPS    | Fluid arrow tracking ([SRS NFR-1](../02-requirements/srs.md))       |
| Search result display   | < 100ms    | Real-time search-as-you-type experience            |
| Time to first frame (AR)| < 2s       | Sensor initialization budget                       |
| Memory (UI layer)       | < 40MB     | Leave headroom for Rust engine and catalog          |

Performance is monitored through React Native performance APIs in debug builds and through production crash/ANR reporting. Frame drops below 24 FPS in AR mode trigger a diagnostic log entry.

---

## 8. Error States and Feedback

Every screen defines explicit error states with actionable recovery guidance:

| Screen          | Error Condition               | User Message                                      | Recovery Action        |
|-----------------|-------------------------------|---------------------------------------------------|------------------------|
| SearchScreen    | Catalog query failure         | "Unable to search. Tap to retry."                 | Retry button           |
| ARScreen        | Camera permission denied      | "Camera access needed for AR tracking."           | Open Settings link     |
| ARScreen        | GPS unavailable               | "Location unavailable. Using last known position."| Auto-retry in background |
| ARScreen        | Magnetometer uncalibrated     | "Move phone in a figure-8 to calibrate."          | Calibration animation  |
| ObjectInfoScreen| Position computation error    | "Unable to compute position. Try again."          | Retry button           |
| AlarmScreen     | Notification permission denied| "Enable notifications to receive alerts."         | Open Settings link     |

---

## 9. Cross-References

| Document                                                              | Relevance                                    |
|-----------------------------------------------------------------------|----------------------------------------------|
| [SRS FR-20 through FR-23](../02-requirements/srs.md)                 | Functional requirements for all four screens |
| [SRS NFR-13, NFR-14](../02-requirements/srs.md)                      | Usability and accessibility requirements     |
| [Architecture Overview §4](../03-architecture/architecture-overview.md) | Data flow diagrams for tracking and alarms |
| [Design Principles](../03-architecture/design-principles.md)         | Layered architecture and separation of concerns |
| [Application Layer Overview](../06-application-layer/overview.md)    | Redux store structure and service interfaces |
| [Tracking Mode States](./tracking-states.md)                         | AR screen state machine                      |
| [Alarm & Notification UX](./alarm-feedback.md)                       | Alarm creation flow and notification design  |
| [Accessibility](./accessibility.md)                                   | WCAG compliance and assistive technology     |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
