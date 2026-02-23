# Alarm & Notification UX

> **Related Documents**: [UI/UX Architecture](./overview.md) | [SRS FR-16 through FR-19](../02-requirements/srs.md) | [Application Layer Overview](../06-application-layer/overview.md) | [Architecture Overview §4](../03-architecture/architecture-overview.md)

This document defines the user experience for creating, managing, and receiving visibility alerts in FindMyStar. Alarms are the primary mechanism for notifying users when a celestial object becomes visible from their location, enabling planned observation sessions without continuous manual checking.

---

## 1. Alarm Creation Flow

### 1.1 Entry Points

Users can create an alarm through two paths:

1. **From ObjectInfoScreen**: Tap the "Set Alert" button. The alarm creation sheet opens with the object pre-filled.
2. **From AlarmScreen**: Tap the "+" button in the top-right corner. A search field appears to select an object first, then the alarm options sheet opens.

### 1.2 Alarm Options Sheet

The alarm creation interface is presented as a bottom sheet (modal) with the following configurable parameters:

```
┌─────────────────────────────────────────┐
│  Set Alert for Saturn                   │
│─────────────────────────────────────────│
│                                         │
│  Minimum Altitude        [10°]  ◄────►  │
│  (slider: 0° to 45°, default 10°)      │
│                                         │
│  Alert Type                             │
│  ○ One-time    ● Daily recurring        │
│                                         │
│  Sun Threshold                          │
│  Only notify during darkness            │
│  (Sun below -6°)            [Toggle ON] │
│                                         │
│  Next alert: Tomorrow, 9:30 PM          │
│                                         │
│  [Cancel]              [Confirm Alert]  │
└─────────────────────────────────────────┘
```

**Parameters**:

| Parameter         | Default    | Range           | Description                                              |
|-------------------|------------|-----------------|----------------------------------------------------------|
| Minimum altitude  | 10°        | 0° to 45°       | Object must be above this altitude to trigger alert      |
| Alert type        | One-time   | One-time / Daily | One-time fires once then deactivates; Daily recurs       |
| Sun threshold     | On         | On / Off         | When on, only alerts when Sun is below -6° (civil twilight) |

### 1.3 Confirmation

When the user taps "Confirm Alert":
1. The system computes the next trigger time using `VisibilityService.computeNextVisible()`.
2. The alarm is persisted to SQLite via `CatalogRepository`.
3. An OS notification is scheduled via `AlarmScheduler.schedule()`.
4. A confirmation toast appears: "Alert set for Saturn -- Tomorrow at 9:30 PM".
5. The bottom sheet dismisses and the AlarmScreen list updates.

### 1.4 Flow Diagram

```
ObjectInfoScreen                      AlarmScreen
     │                                    │
     │ tap "Set Alert"                    │ tap "+"
     │                                    │ select object
     ▼                                    ▼
┌─────────────────────────────────────────────┐
│           Alarm Options Sheet               │
│  (min altitude, type, sun threshold)        │
└──────────────────┬──────────────────────────┘
                   │ tap "Confirm"
                   ▼
         ┌──────────────────┐
         │ Compute next     │
         │ visible time     │
         └────────┬─────────┘
                  │
         ┌────────▼─────────┐
         │ Save to SQLite   │
         │ Schedule OS notif│
         └────────┬─────────┘
                  │
                  ▼
         Confirmation toast
         AlarmScreen updated
```

---

## 2. Notification Design

### 2.1 Notification Content

When a visibility alert triggers, the OS delivers a local notification with the following structure:

| Field     | Content                                                       | Example                                              |
|-----------|---------------------------------------------------------------|------------------------------------------------------|
| Title     | "[Object name] is rising!"                                    | "Saturn is rising!"                                  |
| Body      | "[Object] is now above [threshold]° in the [direction]. Tap to start tracking." | "Saturn is now above 10° in the southeast. Tap to start tracking." |
| Icon      | Object type icon (planet, star, nebula, galaxy)               | Planet icon for Saturn                               |
| Sound     | Optional custom sound (gentle chime, 2 seconds)               | `visibility_chime.wav`                               |
| Badge     | Increments app badge count by 1                               | Badge shows "1"                                      |

### 2.2 Notification Actions

**Tap notification**: Opens the app and navigates to `SearchScreen > ObjectInfoScreen` for the alerted object. The ObjectInfoScreen "Track" button is immediately accessible so the user can begin AR tracking.

**Dismiss notification**: No action taken. The alarm remains active for future triggers (if recurring) or is marked as delivered (if one-time).

### 2.3 Notification Sound

The custom notification sound is a gentle celestial chime lasting approximately 2 seconds. It is designed to be attention-getting without being jarring, suitable for quiet outdoor environments. The sound file ships bundled with the app and is registered with the OS notification system on first launch.

Users can disable the custom sound in Settings, falling back to the system default notification sound or silent delivery.

---

## 3. Alarm Lifecycle

### 3.1 State Diagram

```
                                      ┌──────────────┐
     User creates alarm ────────────→ │   Created    │
                                      └──────┬───────┘
                                             │
                              compute next visible time
                                             │
                                             ▼
                                      ┌──────────────┐
              ┌──────────────────────── │  Scheduled   │
              │                        └──────┬───────┘
              │                               │
              │                    rise time reached
              │                               │
              │                               ▼
              │                        ┌──────────────┐
              │                        │  Triggered   │
              │                        └──────┬───────┘
              │                               │
              │                    OS delivers notification
              │                               │
              │                               ▼
              │                        ┌──────────────┐
              │                        │  Notified    │
              │                        └──────┬───────┘
              │                               │
              │              ┌────────────────┴───────────────┐
              │              │                                │
              │        if recurring                     if one-time
              │              │                                │
              │              ▼                                ▼
              │   Recalculated at midnight            ┌──────────────┐
              │   (new rise time computed)            │  Completed   │
              │              │                        └──────────────┘
              │              │
              └──────────────┘
```

### 3.2 State Descriptions

| State      | Description                                                                  |
|------------|------------------------------------------------------------------------------|
| Created    | Alarm saved to SQLite, awaiting initial computation                          |
| Scheduled  | Next trigger time computed, OS notification registered                       |
| Triggered  | Rise time has been reached, notification is being delivered                  |
| Notified   | User has been notified (notification appeared on device)                     |
| Completed  | One-time alarm has fired and is now inactive (remains in list as history)    |

---

## 4. Daily Recalculation

### 4.1 Background Task

A background task runs daily at midnight (local device time) to recalculate visibility windows for all active recurring alarms. This is necessary because rise and set times shift by approximately 4 minutes per day for stars and vary more significantly for planets, the Sun, and the Moon.

**Platform implementation**:

| Platform | API                        | Scheduling                          | Constraints                |
|----------|----------------------------|-------------------------------------|----------------------------|
| Android  | WorkManager (PeriodicWorkRequest) | ~24-hour interval, flex window 1h | Battery-friendly, deferred |
| iOS      | BGTaskScheduler (BGAppRefreshTask) | Requested daily, OS discretion   | 30-second execution limit  |

### 4.2 Recalculation Process

For each active recurring alarm:

1. Fetch the tracked object from the catalog.
2. Fetch the user's current (or last known) location.
3. Call `VisibilityService.computeNextVisible(object, location, preferences)` to determine the next rise time above the alarm's altitude threshold, filtered by the sun threshold setting.
4. Cancel the previous OS notification for this alarm.
5. Schedule a new OS notification for the updated rise time.
6. Update the alarm record in SQLite with the new trigger time.

**Performance budget**: The entire recalculation batch (up to 100 alarms) must complete within 5 seconds to stay within background task time limits. Individual rise/set computations are targeted at < 50ms each (see [SRS NFR-2](../02-requirements/srs.md)).

### 4.3 Timezone Handling

When the user travels across time zones, the midnight recalculation adjusts automatically because it is scheduled relative to local device time. Additionally, rise/set computations use the updated GPS location, so alarms reflect the sky visible from the user's current position, not their home location.

If the device location is stale (GPS unavailable for >24 hours), the last known location is used and a subtle warning appears on the AlarmScreen: "Using last known location. Alarm times may be inaccurate."

---

## 5. Alarm Management UI

### 5.1 List Layout

The AlarmScreen displays all alarms in a scrollable list, sorted by next notification time (soonest first). Completed one-time alarms appear at the bottom in a "Past" section with dimmed styling.

**Each alarm item displays**:

```
┌─────────────────────────────────────────────────┐
│  ♄  Saturn                           🔁 Daily   │
│     Tomorrow, 9:30 PM · Above 10°               │
└─────────────────────────────────────────────────┘
```

- **Object type icon**: Visual indicator of the object type (planet, star, etc.).
- **Object name**: Primary text, bold.
- **Recurring badge**: A repeating icon for daily alarms, absent for one-time alarms.
- **Next notification time**: Relative format ("Tomorrow, 9:30 PM", "Today, 11:45 PM", "Feb 25, 8:15 PM").
- **Altitude threshold**: "Above [N]°".

### 5.2 Interactions

**Swipe left to delete**: Reveals a red "Delete" action button. On tap, a confirmation alert appears: "Delete alarm for Saturn? You will no longer receive visibility alerts for this object." Confirming deletes the alarm from SQLite and cancels the OS notification.

**Tap to edit**: Opens the Alarm Options Sheet (same as creation) pre-populated with the alarm's current settings. The user can modify altitude threshold, alert type, or sun threshold and tap "Save Changes".

**Pull-to-refresh**: Triggers an immediate recalculation of all alarm times. Useful when the user has traveled to a new location and wants updated rise times without waiting for the midnight background task.

### 5.3 Empty State

When no alarms exist, the AlarmScreen displays:

- A subtle illustration of a crescent moon above a horizon line.
- Text: "No alarms set."
- Secondary text: "Search for an object to get started."
- A button: "Search Objects" that navigates to SearchScreen.

### 5.4 Batch Actions

A long-press on any alarm item enters selection mode, allowing the user to select multiple alarms and delete them in batch. A "Select All" option is available in the action bar. This prevents tedious one-by-one deletion when clearing many alarms.

---

## 6. Edge Cases

### 6.1 Object Currently Visible

If the user creates an alarm for an object that is already above the threshold altitude and the sun is below -6°, the system displays a prompt: "Saturn is visible right now! Would you like to track it instead?" Options:

- "Track Now" -- navigates to ObjectInfoScreen then ARScreen.
- "Set Alert Anyway" -- creates the alarm for the next rise event.

### 6.2 Circumpolar Object

If the target object is circumpolar (never sets from the user's location), the alarm behaves differently:

- The "Rises at" concept does not apply since the object is always above the horizon.
- Instead, the alarm triggers when the object reaches its **maximum altitude** (transit/culmination), which represents the best viewing opportunity.
- The alarm item displays "Always visible" with a note: "Alert set for best viewing time (transit)."

### 6.3 Never-Visible Object

If the target object never rises above the horizon from the user's location (e.g., southern hemisphere objects from high northern latitudes):

- The alarm creation sheet displays a warning: "This object is not visible from your current location."
- The user can still create the alarm (useful if they plan to travel).
- The alarm item displays "Not visible from here" in red text.
- No OS notification is scheduled until a recalculation detects that the user has moved to a location where the object is visible.

### 6.4 Notification Permissions Denied

If the user has not granted notification permissions:

- The alarm creation flow detects this before saving.
- A prompt appears: "FindMyStar needs notification permissions to alert you when objects are visible. Open Settings?"
- If the user declines, the alarm is still saved to SQLite but marked as "silent" -- the user can see it in the AlarmScreen but no OS notification will fire.
- A persistent banner on AlarmScreen reads: "Notifications are disabled. You won't receive alerts." with a "Fix" button that opens OS settings.

### 6.5 Device Rebooted

On Android, scheduled notifications (via AlarmManager) are cleared when the device reboots. FindMyStar registers a `BOOT_COMPLETED` broadcast receiver that re-registers all active alarms on device startup:

1. App receives `BOOT_COMPLETED` intent.
2. Reads all active alarms from SQLite.
3. Calls `AlarmScheduler.rescheduleAll()` to re-register OS notifications.

On iOS, `UNUserNotificationCenter` persists scheduled notifications across reboots, so no special handling is needed.

### 6.6 Alarm for Past Time

If the computed next rise time is in the past (e.g., the background recalculation ran late, or the device was off), the system skips the missed notification and computes the next future rise time. No retroactive notifications are delivered.

---

## 7. Notification Channels (Android)

Android 8.0+ requires notification channels for categorizing notifications. FindMyStar creates a single channel on first launch:

| Property        | Value                                           |
|-----------------|-------------------------------------------------|
| Channel ID      | `visibility_alerts`                             |
| Channel Name    | "Visibility Alerts"                             |
| Description     | "Notifications when celestial objects become visible" |
| Importance      | HIGH (appears in status bar, makes sound)       |
| Sound           | Custom `visibility_chime.wav` (or system default if changed by user) |
| Vibration       | Default system vibration pattern                |
| Lock screen     | PUBLIC (shows full notification content)        |
| Badge           | Enabled (shows count on app icon)               |

Users can customize the channel directly through Android system settings (sound, vibration, importance). The app respects these user overrides.

On iOS, equivalent behavior is achieved through `UNNotificationSound` and the notification authorization options (`.alert`, `.sound`, `.badge`).

---

## 8. Data Model

Alarm records are persisted in the `alarms` table in SQLite (see [Database Schema](../05-data-model/schema.md) for the full schema):

```sql
CREATE TABLE alarms (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    object_id       INTEGER NOT NULL REFERENCES objects(id),
    min_altitude    REAL NOT NULL DEFAULT 10.0,
    is_recurring    INTEGER NOT NULL DEFAULT 0,
    sun_threshold   INTEGER NOT NULL DEFAULT 1,
    next_trigger    TEXT,           -- ISO 8601 datetime
    last_notified   TEXT,           -- ISO 8601 datetime, NULL if never
    status          TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled, completed, silent
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## 9. Cross-References

| Document                                                              | Relevance                                        |
|-----------------------------------------------------------------------|--------------------------------------------------|
| [SRS FR-16](../02-requirements/srs.md)                               | User alarm creation requirement                  |
| [SRS FR-17](../02-requirements/srs.md)                               | OS notification scheduling requirement           |
| [SRS FR-18](../02-requirements/srs.md)                               | Daily recomputation requirement                  |
| [SRS FR-19](../02-requirements/srs.md)                               | Alarm management UI requirement                  |
| [SRS FR-23](../02-requirements/srs.md)                               | Alarm screen functional requirement              |
| [UI/UX Architecture](./overview.md)                                  | AlarmScreen specification and navigation context |
| [Application Layer Overview](../06-application-layer/overview.md)    | AlarmScheduler service and VisibilityService     |
| [Database Schema](../05-data-model/schema.md)                        | Alarms table definition                          |
| [Accessibility](./accessibility.md)                                   | Screen reader support for alarm list             |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
