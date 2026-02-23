# Unit Tests

## 1. Overview

Unit tests cover the **Rust domain engine** and **TypeScript application services** in
isolation. The domain engine is tested with pure function assertions requiring no mocking.
TypeScript services are tested with Jest, mocking native modules and data access layers.

All unit tests are designed to run fast (under 15 seconds total) and execute on every
commit via the CI pipeline.

For the overall testing strategy, see [overview.md](./overview.md).

---

## 2. Rust Domain Engine Tests

### 2.1 Time Conversion

Validates the Unix timestamp to Julian Date conversion defined in
[algorithms.md](../04-domain-engine/algorithms.md) Section 1.

```rust
#[cfg(test)]
mod time_tests {
    use super::*;

    #[test]
    fn test_unix_epoch_to_julian_date() {
        // Unix epoch (1970-01-01 00:00:00 UTC) = JD 2440587.5
        let jd = unix_to_jd(0);
        assert!((jd - 2440587.5).abs() < 1e-10);
    }

    #[test]
    fn test_j2000_epoch_to_julian_date() {
        // J2000.0 (2000-01-01 12:00:00 UTC) = JD 2451545.0
        let j2000_unix_ms = 946728000000_i64; // 2000-01-01T12:00:00Z
        let jd = unix_to_jd(j2000_unix_ms);
        assert!((jd - 2451545.0).abs() < 1e-6);
    }

    #[test]
    fn test_known_date_2024() {
        // 2024-01-01 00:00:00 UTC = JD 2460310.5
        let unix_ms = 1704067200000_i64;
        let jd = unix_to_jd(unix_ms);
        assert!((jd - 2460310.5).abs() < 1e-6);
    }

    #[test]
    fn test_leap_second_boundary() {
        // Verify no discontinuity around known leap second (2016-12-31 23:59:60)
        let before = unix_to_jd(1483228799000); // 2016-12-31T23:59:59Z
        let after = unix_to_jd(1483228800000);  // 2017-01-01T00:00:00Z
        assert!((after - before - 1.0 / 86400.0).abs() < 1e-6);
    }
}
```

### 2.2 Sidereal Time

Validates Greenwich Mean Sidereal Time and Local Sidereal Time against known reference
values. See [algorithms.md](../04-domain-engine/algorithms.md) Section 2.

```rust
#[test]
fn test_gmst_at_j2000() {
    // At J2000.0 epoch, GMST = 18.697374558 hours
    let gmst = compute_gmst(2451545.0);
    assert!((gmst - 18.697374558).abs() < 0.001);
}

#[test]
fn test_lst_greenwich() {
    // At Greenwich (longitude 0), LST = GMST
    let gmst = compute_gmst(2451545.0);
    let lst = compute_lst(gmst, 0.0);
    assert!((lst - gmst).abs() < 1e-10);
}

#[test]
fn test_lst_various_longitudes() {
    let gmst = 12.0; // noon sidereal
    // East longitude adds to GMST
    let lst_east = compute_lst(gmst, 90.0); // +6 hours
    assert!((lst_east - 18.0).abs() < 1e-10);

    // West longitude subtracts from GMST
    let lst_west = compute_lst(gmst, -90.0); // -6 hours
    assert!((lst_west - 6.0).abs() < 1e-10);
}
```

### 2.3 Coordinate Transforms

Validates RA/Dec to Alt/Az conversion using known star positions. See
[algorithms.md](../04-domain-engine/algorithms.md) Section 3.

```rust
#[test]
fn test_polaris_altitude_equals_latitude() {
    // Polaris (RA 2h31m, Dec +89deg16') altitude ~ observer latitude
    let polaris_ra = 2.0 + 31.0 / 60.0;   // 2.5167 hours
    let polaris_dec = 89.0 + 16.0 / 60.0;  // 89.267 degrees
    for lat in &[0.0, 20.0, 40.0, 60.0, 80.0] {
        let (alt, _az) = ra_dec_to_altaz(polaris_ra, polaris_dec, *lat, 0.0, J2000_MS);
        assert!((alt - lat).abs() < 1.5,
            "Polaris altitude {:.1} should be near latitude {:.1}", alt, lat);
    }
}

#[test]
fn test_sirius_known_position() {
    // Sirius: RA 6h45m, Dec -16deg43'
    // From Greenwich at known time, verify altitude/azimuth within tolerance
    let sirius_ra = 6.0 + 45.0 / 60.0;
    let sirius_dec = -(16.0 + 43.0 / 60.0);
    let (alt, az) = ra_dec_to_altaz(sirius_ra, sirius_dec, 51.48, 0.0, KNOWN_TIME_MS);
    // Verify against pre-computed reference values
    assert!((alt - EXPECTED_SIRIUS_ALT).abs() < 0.5);
    assert!((az - EXPECTED_SIRIUS_AZ).abs() < 0.5);
}

#[test]
fn test_vega_from_equator() {
    // Vega: RA 18h36m, Dec +38deg47'
    let vega_ra = 18.0 + 36.0 / 60.0;
    let vega_dec = 38.0 + 47.0 / 60.0;
    let (alt, _az) = ra_dec_to_altaz(vega_ra, vega_dec, 0.0, 0.0, KNOWN_TIME_MS);
    // From equator, max altitude of Vega = 90 - |Dec| is not reachable at all times
    assert!(alt >= -90.0 && alt <= 90.0);
}
```

### 2.4 Rise/Set Calculations

Tests for analytical (fixed stars) and iterative (planets) rise/set algorithms. Validates
against USNO reference data. See [algorithms.md](../04-domain-engine/algorithms.md)
Section 5.

```rust
#[test]
fn test_sun_rise_washington_dc() {
    // 2024-01-01, Washington DC (38.9N, 77.0W), expected sunrise 07:37 EST
    let result = compute_sunrise("2024-01-01", 38.9, -77.0);
    assert!(time_diff_minutes(result, "07:37") < 2);
}

#[test]
fn test_circumpolar_detection() {
    // Polaris from 60N latitude should be circumpolar (never sets)
    let result = compute_rise_set(89.267, 60.0);
    assert!(result.is_circumpolar);
}

#[test]
fn test_never_visible_detection() {
    // Southern Cross (Dec ~ -60) from 60N latitude should never rise
    let result = compute_rise_set(-60.0, 60.0);
    assert!(result.is_never_visible);
}

#[test]
fn test_equinox_equal_day_night() {
    // At equinox, sun is above horizon ~12 hours everywhere (approximately)
    let result = compute_rise_set(0.0, 45.0); // Dec=0 at equinox
    let duration_hours = (result.set_lst - result.rise_lst).abs();
    assert!((duration_hours - 12.0).abs() < 0.5);
}
```

### 2.5 Vector Math

Tests for 3D vector operations used in AR pointing calculations.

```rust
#[test]
fn test_normalize_3_4_0() {
    let v = Vector3::new(3.0, 4.0, 0.0);
    let n = v.normalize();
    assert!((n.magnitude() - 1.0).abs() < 1e-10);
    assert!((n.x - 0.6).abs() < 1e-10);
    assert!((n.y - 0.8).abs() < 1e-10);
}

#[test]
fn test_dot_product_orthogonal() {
    let a = Vector3::new(1.0, 0.0, 0.0);
    let b = Vector3::new(0.0, 1.0, 0.0);
    assert!((a.dot(&b)).abs() < 1e-10);
}

#[test]
fn test_cross_product_right_hand() {
    let x = Vector3::new(1.0, 0.0, 0.0);
    let y = Vector3::new(0.0, 1.0, 0.0);
    let z = x.cross(&y);
    assert!((z.x).abs() < 1e-10);
    assert!((z.y).abs() < 1e-10);
    assert!((z.z - 1.0).abs() < 1e-10);
}

#[test]
fn test_magnitude() {
    let v = Vector3::new(1.0, 2.0, 2.0);
    assert!((v.magnitude() - 3.0).abs() < 1e-10);
}

#[test]
fn test_zero_vector_normalize() {
    let v = Vector3::new(0.0, 0.0, 0.0);
    let n = v.normalize();
    // Zero vector normalization should return zero vector (not NaN/panic)
    assert!(n.magnitude().is_finite());
}
```

### 2.6 Quaternion Operations

Tests for quaternion math used in device orientation processing. See
[algorithms.md](../04-domain-engine/algorithms.md) Section 8.

```rust
#[test]
fn test_quaternion_multiplication_identity() {
    let q = Quaternion::new(0.707, 0.707, 0.0, 0.0);
    let identity = Quaternion::identity(); // (1, 0, 0, 0)
    let result = q * identity;
    assert!((result.w - q.w).abs() < 1e-10);
    assert!((result.x - q.x).abs() < 1e-10);
}

#[test]
fn test_quaternion_conjugate() {
    let q = Quaternion::new(0.5, 0.5, 0.5, 0.5);
    let conj = q.conjugate();
    assert!((conj.w - 0.5).abs() < 1e-10);
    assert!((conj.x + 0.5).abs() < 1e-10);
    assert!((conj.y + 0.5).abs() < 1e-10);
    assert!((conj.z + 0.5).abs() < 1e-10);
}

#[test]
fn test_rotation_preserves_magnitude() {
    let q = Quaternion::from_axis_angle(Vector3::unit_z(), std::f64::consts::PI / 4.0);
    let v = Vector3::new(1.0, 0.0, 0.0);
    let rotated = q.rotate_vector(&v);
    assert!((v.magnitude() - rotated.magnitude()).abs() < 1e-10);
}

#[test]
fn test_identity_quaternion_no_rotation() {
    let identity = Quaternion::identity();
    let v = Vector3::new(3.0, 4.0, 5.0);
    let rotated = identity.rotate_vector(&v);
    assert!((v.x - rotated.x).abs() < 1e-10);
    assert!((v.y - rotated.y).abs() < 1e-10);
    assert!((v.z - rotated.z).abs() < 1e-10);
}
```

### 2.7 Angular Error

Tests for angular distance computation between two pointing vectors. See
[algorithms.md](../04-domain-engine/algorithms.md) Section 4.

```rust
#[test]
fn test_angular_error_aligned() {
    let a = Vector3::new(0.0, 0.0, 1.0);
    let b = Vector3::new(0.0, 0.0, 1.0);
    assert!((angular_error(&a, &b) - 0.0).abs() < 1e-10);
}

#[test]
fn test_angular_error_perpendicular() {
    let a = Vector3::new(1.0, 0.0, 0.0);
    let b = Vector3::new(0.0, 1.0, 0.0);
    assert!((angular_error(&a, &b) - 90.0).abs() < 1e-6);
}

#[test]
fn test_angular_error_opposite() {
    let a = Vector3::new(0.0, 0.0, 1.0);
    let b = Vector3::new(0.0, 0.0, -1.0);
    assert!((angular_error(&a, &b) - 180.0).abs() < 1e-6);
}

#[test]
fn test_angular_error_floating_point_edge() {
    // Dot product may exceed 1.0 due to floating point; verify clamping
    let a = Vector3::new(1.0, 0.0, 0.0);
    let b = Vector3::new(1.0 + 1e-15, 0.0, 0.0).normalize();
    let error = angular_error(&a, &b);
    assert!(error.is_finite());
    assert!(error >= 0.0 && error <= 180.0);
}
```

### 2.8 Ephemeris

Tests for Sun and Moon position calculations. See
[algorithms.md](../04-domain-engine/algorithms.md) Section 7.

```rust
#[test]
fn test_sun_at_vernal_equinox() {
    // At vernal equinox (~March 20), Sun RA ~ 0h, Dec ~ 0deg
    let (ra, dec) = compute_sun_position(EQUINOX_JD_2024);
    assert!(ra.abs() < 0.5 || (24.0 - ra).abs() < 0.5); // near 0h
    assert!(dec.abs() < 1.0); // near 0 degrees
}

#[test]
fn test_sun_at_summer_solstice() {
    // At summer solstice (~June 21), Sun Dec ~ +23.44deg
    let (_ra, dec) = compute_sun_position(SOLSTICE_JD_2024);
    assert!((dec - 23.44).abs() < 0.5);
}

#[test]
fn test_moon_phase_full() {
    // At known full moon date, phase angle ~ 180deg (opposite sun)
    let phase = compute_moon_phase(KNOWN_FULL_MOON_JD);
    assert!((phase - 180.0).abs() < 10.0); // within 10 degrees
}
```

---

## 3. TypeScript Service Tests

### 3.1 CatalogRepository

Tests for the SQLite-backed catalog search and tracking management. See
[services.md](../06-application-layer/services.md) Section 6.

```typescript
describe("CatalogRepository", () => {
  let repo: CatalogRepository;
  let mockDb: jest.Mocked<SQLiteDatabase>;

  beforeEach(() => {
    mockDb = createMockDatabase(TEST_CATALOG);
    repo = new CatalogRepository(mockDb);
  });

  test("search returns results for valid query", async () => {
    const results = await repo.search("Sirius");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("Sirius");
  });

  test("search returns empty array for no match", async () => {
    const results = await repo.search("NonexistentStar12345");
    expect(results).toEqual([]);
  });

  test("search handles special characters safely", async () => {
    const results = await repo.search("O'Brien; DROP TABLE objects;--");
    expect(results).toEqual([]); // No crash, no injection
  });

  test("search with empty query returns empty", async () => {
    const results = await repo.search("");
    expect(results).toEqual([]);
  });
});
```

### 3.2 AlarmScheduler

Tests for alarm creation, deletion, listing, and daily recalculation. See
[services.md](../06-application-layer/services.md) Section 4.

```typescript
describe("AlarmScheduler", () => {
  let scheduler: AlarmScheduler;
  let mockVisibility: jest.Mocked<IVisibilityService>;
  let mockNotifications: jest.Mocked<NotificationService>;

  beforeEach(() => {
    mockVisibility = createMockVisibilityService();
    mockNotifications = createMockNotificationService();
    scheduler = new AlarmScheduler(mockVisibility, mockNotifications, mockDb);
  });

  test("createAlarm stores alarm and schedules notification", async () => {
    const alarm = await scheduler.createAlarm("jupiter", { minAltitude: 10 });
    expect(alarm.status).toBe("active");
    expect(mockNotifications.schedule).toHaveBeenCalledTimes(1);
  });

  test("deleteAlarm removes alarm and cancels notification", async () => {
    const alarm = await scheduler.createAlarm("saturn", {});
    await scheduler.deleteAlarm(alarm.id);
    const list = await scheduler.listAlarms();
    expect(list.find(a => a.id === alarm.id)).toBeUndefined();
    expect(mockNotifications.cancel).toHaveBeenCalled();
  });

  test("recalculateAll updates all active alarms", async () => {
    await scheduler.createAlarm("jupiter", {});
    await scheduler.createAlarm("mars", {});
    await scheduler.createAlarm("vega", {});
    await scheduler.recalculateAll();
    expect(mockVisibility.getNextVisibleTime).toHaveBeenCalledTimes(3);
  });
});
```

### 3.3 LocationService

Tests for GPS fallback and permission handling. See
[services.md](../06-application-layer/services.md) Section 7.

```typescript
describe("LocationService", () => {
  test("falls back to last known location on timeout", async () => {
    const mockGPS = createMockGPS({ timeout: true });
    const service = new LocationService(mockGPS);
    service.setLastKnown(MOCK_LOCATION_SF);
    const loc = await service.getCurrentLocation();
    expect(loc).toEqual(MOCK_LOCATION_SF);
  });

  test("throws LocationPermissionDenied when denied", async () => {
    const mockGPS = createMockGPS({ permissionDenied: true });
    const service = new LocationService(mockGPS);
    await expect(service.getCurrentLocation()).rejects.toThrow("LocationPermissionDenied");
  });
});
```

---

## 4. Test Organization

```
/core/src/
├── time.rs          → #[cfg(test)] mod tests { ... }
├── sidereal.rs      → #[cfg(test)] mod tests { ... }
├── coordinates.rs   → #[cfg(test)] mod tests { ... }
├── rise_set.rs      → #[cfg(test)] mod tests { ... }
├── vector.rs        → #[cfg(test)] mod tests { ... }
├── quaternion.rs    → #[cfg(test)] mod tests { ... }
├── angular.rs       → #[cfg(test)] mod tests { ... }
└── ephemeris.rs     → #[cfg(test)] mod tests { ... }

/core/tests/
├── validation_sun.rs        → Integration tests against USNO
├── validation_planets.rs    → Integration tests against JPL
└── validation_stars.rs      → Integration tests against Hipparcos

/mobile/src/
├── services/__tests__/
│   ├── CatalogRepository.test.ts
│   ├── AlarmScheduler.test.ts
│   ├── LocationService.test.ts
│   ├── ObjectTrackingService.test.ts
│   └── VisibilityService.test.ts
└── utils/__tests__/
    └── formatters.test.ts
```

---

## 5. Running Tests

```bash
# Rust domain engine unit tests (~5 seconds)
cargo test --lib

# Rust unit tests with stdout output
cargo test --lib -- --nocapture

# Rust unit tests for a specific module
cargo test --lib time_tests
cargo test --lib quaternion_tests

# TypeScript unit tests (~10 seconds)
npm test

# TypeScript tests with coverage report
npm test -- --coverage

# TypeScript tests in watch mode (development)
npm test -- --watch
```

---

## 6. Coverage Targets

| Layer                         | Target   | Rationale                                      |
|-------------------------------|----------|-------------------------------------------------|
| Rust domain engine (overall)  | > 90%    | Pure math functions are fully testable           |
| Coordinate transforms         | 100%     | Critical path; errors propagate to AR display    |
| Rise/set calculations         | 100%     | Incorrect times produce bad alarm notifications  |
| Vector/quaternion math        | 100%     | AR pointing depends on correct vector operations |
| TypeScript services (overall) | > 80%    | Some platform-specific paths are hard to cover   |
| CatalogRepository             | > 90%    | Core data access, fully mockable                 |
| AlarmScheduler                | > 85%    | Complex state transitions require thorough tests |

Coverage is measured with `cargo tarpaulin` (Rust) and `jest --coverage` (TypeScript).

---

## 7. Test Data

### Known Star Positions (J2000.0 Epoch)

| Star     | RA          | Dec          | Magnitude | Notes                    |
|----------|-------------|--------------|-----------|--------------------------|
| Polaris  | 2h 31m 49s  | +89° 15' 51" | 1.98      | Near celestial north pole |
| Sirius   | 6h 45m 09s  | -16° 42' 58" | -1.46     | Brightest star in sky     |
| Vega     | 18h 36m 56s | +38° 47' 01" | 0.03      | Summer triangle vertex    |
| Betelgeuse | 5h 55m 10s | +07° 24' 25" | 0.42     | Variable; Orion shoulder  |
| Canopus  | 6h 23m 57s  | -52° 41' 44" | -0.74     | Never visible from 60°N   |

### Known Dates with Verified Ephemeris

| Date       | Event              | Reference Source |
|------------|--------------------|------------------|
| 2024-03-20 | Vernal equinox     | USNO             |
| 2024-06-20 | Summer solstice    | USNO             |
| 2024-09-22 | Autumnal equinox   | USNO             |
| 2024-12-21 | Winter solstice    | USNO             |
| 2024-01-25 | Full moon          | USNO             |

### Edge Case Locations

| Location          | Latitude | Longitude | Test Purpose                         |
|-------------------|----------|-----------|--------------------------------------|
| North Pole        | 90.0°N   | 0.0°E     | All stars circumpolar or invisible    |
| South Pole        | 90.0°S   | 0.0°E     | Reversed circumpolar logic            |
| Equator           | 0.0°     | 0.0°E     | All stars rise and set                |
| Date Line (East)  | 0.0°     | 179.9°E   | Longitude wrapping edge case          |
| Date Line (West)  | 0.0°     | 179.9°W   | Longitude wrapping edge case          |

---

## 8. Mocking Strategy

### Rust: No Mocking Needed

The Rust domain engine consists entirely of **pure functions**: given inputs (coordinates,
time, location), they produce deterministic outputs. There are no side effects, no I/O,
no network calls, and no mutable shared state. This eliminates the need for mocking
frameworks entirely.

```rust
// Pure function: same input always produces same output
fn ra_dec_to_altaz(ra: f64, dec: f64, lat: f64, lon: f64, time_ms: i64) -> (f64, f64) {
    // ... deterministic math ...
}
```

### TypeScript: Mock External Dependencies

TypeScript services depend on native modules, SQLite, and sensor APIs that must be mocked
in unit tests:

| Dependency         | Mock Approach                                 |
|--------------------|-----------------------------------------------|
| SQLite database    | In-memory mock with pre-loaded test data      |
| Rust FFI bridge    | Jest mock returning pre-computed values        |
| GPS (LocationService) | Mock returning fixed coordinates           |
| IMU (SensorFusion)    | Mock returning fixed quaternion             |
| OS Notifications      | Mock tracking scheduled/cancelled calls     |
| React Native modules  | `jest.mock('react-native', ...)` overrides  |

---

## 9. Cross-References

- [Testing Strategy Overview](./overview.md) -- Full testing strategy and CI pipeline
- [Integration Tests](./integration-tests.md) -- End-to-end workflow tests
- [Astronomical Validation](./validation.md) -- Ephemeris validation against USNO/JPL
- [Performance Testing](./performance.md) -- Benchmarks and profiling
- [Core Algorithms](../04-domain-engine/algorithms.md) -- Algorithm specifications tested here
- [Application Services](../06-application-layer/services.md) -- TypeScript service interfaces
- [Contributing Guide](../CONTRIBUTING.md) -- How to run tests before submitting PRs

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
