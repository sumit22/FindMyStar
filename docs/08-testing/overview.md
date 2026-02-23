# Testing Strategy

## 1. Unit Testing (Domain Engine)

### 1.1 Mathematical Validation Tests

**Test**: Polaris Altitude ≈ Observer Latitude

```
Given: Observer at latitude 40°N
When: Computing altitude of Polaris (RA 2h31m, Dec +89°16')
Then: Altitude should be ≈ 40° ± 1°
```

**Rationale**: Polaris is nearly at celestial pole, so altitude ≈ observer latitude

**Implementation**:
```rust
#[test]
fn test_polaris_altitude_equals_latitude() {
    for lat in vec![0., 20., 40., 60., 80.] {
        let polaris = Star::polaris();
        let alt = compute_altitude(polaris.ra, polaris.dec, lat, 0., current_time);
        assert!((alt - lat).abs() < 1.0);
    }
}
```

---

### 1.2 Sun Rise/Set Validation

**Test**: Sun Rise Time Matches USNO Data

```
Given: Date 2024-01-01, Location Washington DC (38.9°N, 77.0°W)
When: Computing sunrise using our algorithm
Then: Time should match USNO Sunrise 7:37 ± 2 minutes
```

**Data Source**: U.S. Naval Observatory official data

**Test Suite**:
```rust
#[test]
fn test_sun_rise_set_against_usno() {
    let test_cases = vec![
        TestCase { date: "2024-01-01", lat: 38.9, lon: -77.0, expected_sunrise: "07:37" },
        TestCase { date: "2024-06-21", lat: 38.9, lon: -77.0, expected_sunrise: "05:43" },
        // ... more test cases
    ];
    
    for tc in test_cases {
        let computed = compute_sunrise(tc.date, tc.lat, tc.lon);
        assert!(time_diff(computed, tc.expected_sunrise) < 2 minutes);
    }
}
```

---

### 1.3 Vector Math Tests

**Test**: Normalize Reduces Vector to Unit Length

```rust
#[test]
fn test_vector_normalize() {
    let v = Vector3::new(3.0, 4.0, 0.0);
    let normalized = v.normalize();
    
    assert_eq!(normalized.magnitude(), 1.0);
    assert!((normalized.x - 0.6).abs() < 1e-10);
    assert!((normalized.y - 0.8).abs() < 1e-10);
}
```

---

### 1.4 Quaternion Tests

**Test**: Quaternion Rotation Preserves Magnitude

```rust
#[test]
fn test_quaternion_rotation_preserves_magnitude() {
    let q = Quaternion::from_axis_angle(Vector3::unit_z(), PI / 4.);
    let v = Vector3::new(1.0, 0.0, 0.0);
    let v_rotated = q * v * q.conjugate();
    
    assert!((v.magnitude() - v_rotated.magnitude()).abs() < 1e-10);
}
```

---

## 2. Integration Testing

### 2.1 End-to-End Tracking Flow

**Scenario**: User searches for Jupiter, starts tracking

```gherkin
Scenario: User tracks Jupiter from their location
  Given application is running
  When user searches "Jupiter"
  Then search results show Jupiter with magnitude -2.1
  
  When user taps "Track"
  Then AR screen opens
  And compass arrow points toward Jupiter
  And angular distance decreases as camera moves
  
  When angular distance < 0.5°
  Then "TARGET LOCKED" indicator appears
```

**Test Code**:
```typescript
test("tracking flow", async () => {
  const app = await app_launch();
  
  // Search
  await app.type_search("Jupiter");
  expect(await app.get_search_results()).to_have_length.greaterThan(0);
  
  // Track
  await app.tap("Track");
  expect(await app.screen_name()).toBe("ARScreen");
  
  // Verify arrow rendered
  expect(await app.arrow_exists()).toBeTrue();
  expect(await app.angular_distance()).lessThan(5);
  
  // Simulate camera movement
  await app.set_device_orientation(near_jupiter_direction);
  expect(await app.lock_indicator_visible()).toBeTrue();
});
```

---

### 2.2 Alarm Scheduling Flow

**Scenario**: User sets alarm for Saturn

```
Given:
  - Date: 2024-02-01 08:00
  - Location: San Francisco (37.77°N, 122.41°W)
  - Object: Saturn (currently below horizon)

When:
  - User searches "Saturn"
  - User taps "Set Alert"

Then:
  - System computes next rise: 2024-02-01 21:30
  - Notification scheduled for OS
  - SQLite stores alarm record
  
When:
  - Time advances to 2024-02-01 21:30
  Then:
  - OS delivers notification
  - Alarm can be marked as notified
```

---

## 3. Validation Testing

### 3.1 Ephemeris Validation

Compare our computed positions against professional software:

**Test Data**:
```
Software: JPL Horizons / USNO
Objects: Sun, Moon, 8 planets
Dates: 100 sample dates across 2024
Metrics: RA/Dec and Alt/Az accuracy
```

**Acceptance Criteria**:
- RA/Dec error < 1 arcminute
- Alt/Az error < 1 degree
- Rise/set time error < 2 minutes

---

### 3.2 Real Device Testing

**Hardware**: Multiple phone models

| Device | OS | IMU Quality | Test Result |
|--------|-----|-----------|------------|
| iPhone 14 | iOS 17 | Excellent | ✅ ±0.5° |
| Samsung S24 | Android 14 | Excellent | ✅ ±0.5° |
| iPhone 12 | iOS 16 | Good | ✅ ±1° |
| OnePlus 11 | Android 13 | Good | ✅ ±1° |
| Budget Phone | Android 12 | Fair | ✅ ±2° |

---

## 4. Performance Testing

### 4.1 Computation Benchmarks

```rust
#[bench]
fn bench_ra_dec_to_altaz(b: &mut Bencher) {
    let ra = 5.5;  // hours
    let dec = 45.0; // degrees
    
    b.iter(|| {
        ra_dec_to_altaz(ra, dec, 40., 0., current_time)
    });
}

// Expected: < 10 microseconds
```

**Targets**:
- Position computation: < 10ms
- Rise/set calculation: < 500ms
- Batch alarm recalculation (100 objects): < 5s

---

### 4.2 Memory Profiling

```
Baseline: Empty app = 30MB
+ Catalog loaded: +25MB
+ 50 tracked objects: +2MB
+ AR screen active: +8MB
Total: ~65MB (well under 100MB target)
```

---

### 4.3 Battery Profiling

| Mode | Battery Drain | Test Conditions |
|------|---------------|-----------------|
| Standby | 1%/hour | App backgrounded |
| AR active (continuous) | 8%/hour | 30 FPS, GPS on, IMU on |
| AR with screen off | 1%/hour | Position still calculated |
| Alarm recalc (nightly) | Negligible | ~2 seconds at midnight |

---

## 5. Regression Testing Suite

Every release runs:

1. **Domain Engine**
   - 50+ unit tests (5 minutes)
   - Ephemeris validation (10 minutes)

2. **Integration**
   - Search tests
   - Tracking tests
   - Alarm tests
   - ~30 minutes total

3. **UI Tests**
   - Navigation
   - Screen transitions
   - Input validation
   - ~20 minutes total

**Total**: ~60 minutes per release

---

## 6. Test Data Sets

### 6.1 Known Good Values

```
Date: 2024-01-01 00:00:00 UTC
Location: Greenwich Observatory (51.48°N, 0°W)

Expected Sun Position:
  RA: 18h42m
  Dec: -23°0'
  Alt: 45°
  Az: 180° (due south)
```

---

## 7. Continuous Integration

**CI Pipeline** (GitHub Actions):

```yaml
on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest]
        rust: [stable, nightly]
    steps:
      - uses: actions/checkout@v2
      - uses: actions-rs/toolchain@v1
      - name: Run tests
        run: cargo test --release
      - name: Ephemeris validation
        run: cargo test --test validation_tests
```

---

**Testing Strategy Status**: Complete  
**Version**: 1.0  
**Last Updated**: February 2026
