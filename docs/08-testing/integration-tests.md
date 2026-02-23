# Integration Tests

## 1. Overview

Integration tests verify **end-to-end user workflows** across the full application stack:
React Native UI, TypeScript application services, Rust FFI bridge, and SQLite persistence.
These tests exercise the interaction between layers that unit tests cover in isolation.

Integration tests use emulated devices with mocked sensors and a pre-populated test
database, providing reproducible results without requiring real hardware or live GPS/IMU
data.

For the overall testing strategy, see [overview.md](./overview.md).

---

## 2. Test Environment

### Emulator/Simulator Configuration

- **iOS**: Xcode Simulator (iPhone 14 profile, iOS 17+)
- **Android**: Android Emulator (Pixel 7 profile, API 34+)
- **Sensor mocking**: Custom native module stubs that inject deterministic quaternion and
  GPS data into the sensor pipeline

### Pre-Populated Test Database

A fixture database (`test_catalog.db`) is bundled with integration tests containing:

- 50 brightest stars (from Hipparcos catalog)
- Sun, Moon, 8 planets
- 20 Messier objects
- 5 pre-configured tracked objects with active alarms

### Deterministic Time

All integration tests use a **frozen clock** to ensure reproducibility:

```typescript
// Freeze time to a known instant for all tests
const FROZEN_TIME = new Date("2024-06-15T22:00:00Z"); // Summer evening, UTC

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(FROZEN_TIME);
});

afterAll(() => {
  jest.useRealTimers();
});
```

This ensures that rise/set times, visibility windows, and alarm triggers produce
identical results across runs and CI environments.

---

## 3. Test Scenarios

### Scenario 1: Search and Track Object

Validates the complete flow from catalog search through AR tracking lock-on. Covers
SRS functional requirements FR-1 (Search), FR-2 (Object Info), and FR-5 (AR Tracking).

```gherkin
Feature: Search and Track Celestial Object

  Scenario: User searches for Jupiter and tracks it in AR
    Given app is running with test catalog
    And observer location is San Francisco (37.77N, 122.42W)
    And time is frozen to 2024-06-15T22:00:00Z

    When user types "Jupiter" in the search field
    Then search results show Jupiter with magnitude ~ -2.1
    And search completes in under 100ms

    When user taps Jupiter in search results
    Then ObjectInfoScreen displays:
      | Field       | Value                    |
      | Name        | Jupiter                  |
      | Type        | Planet                   |
      | Altitude    | > 0 degrees (visible)    |
      | Azimuth     | between 0 and 360        |
      | Rise time   | a valid time today       |
      | Set time    | a valid time today       |

    When user taps "Track"
    Then ARScreen opens with camera preview
    And a directional arrow is rendered on screen
    And angular distance to Jupiter is displayed in degrees

    When device orientation is simulated to align with Jupiter
    Then angular distance decreases toward 0
    And after angular distance < 2 degrees for 2 seconds
    Then "TARGET LOCKED" indicator appears
    And arrow disappears
```

### Scenario 2: Set and Trigger Alarm

Validates alarm creation, persistence, and notification delivery. Covers SRS FR-10
(Set Alert), FR-11 (Notification Delivery), and FR-12 (Alarm Persistence).

```gherkin
Feature: Visibility Alarm

  Scenario: User sets alarm for Saturn and receives notification
    Given observer location is San Francisco (37.77N, 122.42W)
    And time is frozen to 2024-06-15T10:00:00Z (daytime)
    And Saturn is below the horizon

    When user searches "Saturn"
    And user taps Saturn in search results
    Then ObjectInfoScreen shows altitude < 0 (below horizon)
    And "Set Alert" button is visible

    When user taps "Set Alert"
    Then a confirmation toast appears: "Alert set for Saturn"
    And an alarm record exists in SQLite with:
      | Field           | Value                |
      | objectId        | saturn               |
      | status          | active               |
      | nextTriggerAt   | a future timestamp   |
    And an OS notification is scheduled

    When time advances to Saturn's computed rise time
    Then OS notification is delivered with title "Saturn is rising"
    And alarm status updates to "notified" in SQLite
```

### Scenario 3: Daily Alarm Recalculation

Validates the midnight background task that keeps alarm trigger times accurate as
celestial positions shift day to day. Covers SRS FR-13 (Daily Recalculation).

```gherkin
Feature: Daily Alarm Recalculation

  Scenario: Midnight task recalculates all active alarms
    Given user has 3 active alarms:
      | Object   | Original Next Trigger       |
      | Jupiter  | 2024-06-15T20:30:00Z        |
      | Vega     | 2024-06-15T21:15:00Z        |
      | Saturn   | 2024-06-16T03:45:00Z        |
    And time is frozen to 2024-06-16T07:00:00Z (midnight PDT)

    When the midnight background task fires
    Then AlarmScheduler.recalculateAll() is called
    And all 3 alarms have updated nextTriggerAt values
    And all 3 OS notifications are rescheduled
    And recalculation completes within 2 seconds

    When querying alarms from SQLite
    Then each alarm's nextTriggerAt is in the future
    And each alarm's status remains "active"
```

### Scenario 4: Error Recovery -- GPS Unavailable

Validates graceful degradation when GPS is unavailable. Covers SRS FR-16 (Offline
Operation) and NFR-5 (Reliability).

```gherkin
Feature: GPS Error Recovery

  Scenario: App recovers from GPS unavailability
    Given GPS is unavailable (permission denied or no fix)
    And a last known location exists: New York (40.71N, 74.01W)

    When user opens the app and starts tracking Polaris
    Then app uses the last known location for calculations
    And a warning banner shows "Using last known location"
    And Polaris altitude is computed as ~ 40.7 degrees

    When GPS becomes available again
    Then location updates automatically within 60 seconds
    And the warning banner disappears
    And computed positions update to reflect new coordinates
```

### Scenario 5: Catalog Search Edge Cases

Validates search behavior under boundary conditions. Covers SRS FR-1 (Search).

```gherkin
Feature: Search Edge Cases

  Scenario Outline: Search handles various inputs
    When user types "<query>" in the search field
    Then <expected_result>

    Examples:
      | query              | expected_result                              |
      | M31                | results include Andromeda Galaxy (M31)        |
      | m31                | results include Andromeda Galaxy (case-insensitive) |
      | Bet               | results include Betelgeuse (partial match)    |
      |                    | no results (empty query rejected)             |
      | aaaaaaa...x200     | no results (long query handled gracefully)    |
      | ' OR 1=1 --       | no results (SQL injection prevented)          |
```

---

## 4. Test Implementation

### Framework: Detox (React Native)

Integration tests use [Detox](https://wix.github.io/Detox/) for gray-box end-to-end
testing on iOS and Android emulators.

```typescript
import { device, element, by, expect } from "detox";

describe("Search and Track Flow", () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      launchArgs: {
        mockTime: "2024-06-15T22:00:00Z",
        mockLocation: "37.77,-122.42",
      },
    });
  });

  it("should search for Jupiter and display results", async () => {
    await element(by.id("search-input")).typeText("Jupiter");
    await expect(element(by.id("search-result-jupiter"))).toBeVisible();
  });

  it("should navigate to object info screen", async () => {
    await element(by.id("search-result-jupiter")).tap();
    await expect(element(by.id("object-info-screen"))).toBeVisible();
    await expect(element(by.id("altitude-value"))).not.toHaveText("--");
  });

  it("should open AR tracking screen", async () => {
    await element(by.id("track-button")).tap();
    await expect(element(by.id("ar-screen"))).toBeVisible();
    await expect(element(by.id("direction-arrow"))).toBeVisible();
    await expect(element(by.id("angular-distance"))).toBeVisible();
  });

  it("should show TARGET LOCKED when aligned", async () => {
    // Inject simulated device orientation pointing at Jupiter
    await device.setOrientation("portrait");
    await device.sendUserNotification({
      type: "simulateSensorAlignment",
      target: "jupiter",
    });

    await waitFor(element(by.id("target-locked")))
      .toBeVisible()
      .withTimeout(5000);
  });
});
```

### Sensor Simulation

Sensor data is injected through a test-only native module that bypasses the real
`SensorFusionService`:

```typescript
// TestSensorBridge.ts -- only included in test builds
export class TestSensorBridge {
  static setOrientation(quaternion: Quaternion): void {
    NativeModules.TestSensorBridge.injectQuaternion(
      quaternion.w, quaternion.x, quaternion.y, quaternion.z
    );
  }

  static setLocation(lat: number, lon: number): void {
    NativeModules.TestSensorBridge.injectLocation(lat, lon, 0, 10);
  }

  static simulateGPSUnavailable(): void {
    NativeModules.TestSensorBridge.setGPSAvailable(false);
  }

  static simulateGPSRestore(): void {
    NativeModules.TestSensorBridge.setGPSAvailable(true);
  }
}
```

### Database Fixtures

Test fixtures are loaded from JSON files before each test suite:

```typescript
async function loadTestFixtures(db: SQLiteDatabase): Promise<void> {
  const catalog = require("./fixtures/test_catalog.json");
  const alarms = require("./fixtures/test_alarms.json");

  for (const obj of catalog.objects) {
    await db.executeSql(
      "INSERT INTO objects (id, name, type, ra, dec, magnitude) VALUES (?, ?, ?, ?, ?, ?)",
      [obj.id, obj.name, obj.type, obj.ra, obj.dec, obj.magnitude]
    );
  }

  for (const alarm of alarms.tracked_objects) {
    await db.executeSql(
      "INSERT INTO tracked_objects (object_id, latitude, longitude, min_altitude, next_visible_at) VALUES (?, ?, ?, ?, ?)",
      [alarm.objectId, alarm.lat, alarm.lon, alarm.minAlt, alarm.nextVisible]
    );
  }
}
```

---

## 5. Running Integration Tests

```bash
# Full integration test suite (~30 minutes)
npm run test:integration

# Smoke tests only (~5 minutes)
npm run test:integration:smoke

# Run on specific platform
npm run test:integration -- --platform ios
npm run test:integration -- --platform android

# Run a specific test file
npm run test:integration -- --testNamePattern "Search and Track"

# Generate HTML report
npm run test:integration -- --reporter html
```

### Smoke Test Suite

The smoke test suite covers the critical happy paths and runs on every pull request:

1. App launches without crash
2. Search returns results for "Jupiter"
3. Object info screen renders with valid data
4. AR screen opens and renders direction arrow
5. Alarm creation persists to SQLite
6. Alarm list screen displays active alarms

---

## 6. CI Integration

### Pull Request Pipeline

Smoke tests run on every pull request to catch regressions before merge:

```yaml
# .github/workflows/integration-smoke.yml
name: Integration Smoke Tests
on: [pull_request]

jobs:
  smoke-test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build:test
      - run: npm run test:integration:smoke
        timeout-minutes: 15
```

### Merge-to-Main Pipeline

The full integration suite runs on every merge to `main`:

```yaml
# .github/workflows/integration-full.yml
name: Full Integration Tests
on:
  push:
    branches: [main]

jobs:
  full-integration:
    runs-on: macos-latest
    strategy:
      matrix:
        platform: [ios, android]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run build:test
      - run: npm run test:integration -- --platform ${{ matrix.platform }}
        timeout-minutes: 45
```

### Device Farm Testing (Phase 2)

Real hardware testing on AWS Device Farm or Firebase Test Lab is planned for Phase 2:

- Run full suite on 5+ physical device models
- Test IMU accuracy with real sensor data
- Validate battery drain on actual hardware
- Scheduled weekly (not per-commit due to cost and duration)

---

## 7. Test Data Management

### Fixture Files

```
/mobile/e2e/
├── fixtures/
│   ├── test_catalog.json       - 50 stars, 10 planets, 20 Messier objects
│   ├── test_alarms.json        - 5 pre-configured alarms
│   ├── sensor_sequences/
│   │   ├── align_jupiter.json  - Quaternion sequence simulating alignment
│   │   ├── sweep_horizon.json  - 360-degree horizontal sweep
│   │   └── random_motion.json  - Realistic hand-held motion noise
│   └── locations/
│       ├── san_francisco.json  - 37.77N, 122.42W
│       ├── greenwich.json      - 51.48N, 0.00E
│       └── north_pole.json     - 90.00N, 0.00E
├── smoke/
│   ├── app-launch.test.ts
│   ├── search-basic.test.ts
│   └── alarm-create.test.ts
└── full/
    ├── search-and-track.test.ts
    ├── alarm-lifecycle.test.ts
    ├── daily-recalc.test.ts
    ├── error-recovery.test.ts
    └── search-edge-cases.test.ts
```

---

## 8. Cross-References

- [Testing Strategy Overview](./overview.md) -- Full testing strategy and CI pipeline
- [Unit Tests](./unit-tests.md) -- Isolated component tests
- [Astronomical Validation](./validation.md) -- Ephemeris accuracy testing
- [Performance Testing](./performance.md) -- Benchmarks and resource profiling
- [Application Services](../06-application-layer/services.md) -- Service interfaces exercised
  by integration tests
- [SRS Functional Requirements](../02-requirements/srs.md) -- FR-1 through FR-16 validated
  by these scenarios

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
