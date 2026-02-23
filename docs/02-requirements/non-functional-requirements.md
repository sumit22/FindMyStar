# Non-Functional Requirements

## 1. Overview

This document expands the non-functional requirements NFR-1 through NFR-14 defined in [SRS](./srs.md) Section 4. Each requirement includes a unique identifier, title, target metric, measurement method, acceptable threshold, and test approach. NFRs are grouped by quality attribute and cross-referenced to the functional requirements they constrain and the testing strategies that validate them.

---

## 2. Performance (NFR-1 to NFR-4)

### NFR-1: Position Computation Performance

| Field | Detail |
|-------|--------|
| **ID** | NFR-1 |
| **Title** | Real-time position computation performance |
| **Target Metric** | End-to-end computation time per frame |
| **Measurement Method** | Rust benchmarks (`cargo bench`) + in-app frame timing instrumentation |
| **Acceptable Threshold** | See table below |
| **Test Approach** | Automated benchmark suite run on every CI build; regression threshold alerts |

**Performance Breakdown**:

| Operation | Target | Acceptable Max | Measurement Tool |
|-----------|--------|---------------|-----------------|
| RA/Dec to Alt/Az transformation | < 5ms | 10ms | `cargo bench` (Rust) |
| 3D vector operations (dot, cross, normalize) | < 1ms | 5ms | `cargo bench` (Rust) |
| Angular error calculation | < 1ms | 5ms | `cargo bench` (Rust) |
| Sensor fusion (Q_device from IMU) | < 3ms | 8ms | In-app profiler |
| Total frame pipeline (sensor to display) | < 10ms | 15ms | Frame timing overlay |

**Rationale**: The AR tracking loop must sustain 30+ FPS. At 30 FPS, each frame has a budget of 33ms. The computation pipeline must complete well under this budget to leave room for rendering.

**Related FRs**: FR-4, FR-5, FR-6

### NFR-2: Alarm Computation Performance

| Field | Detail |
|-------|--------|
| **ID** | NFR-2 |
| **Title** | Rise/set and alarm computation performance |
| **Target Metric** | Computation time for rise/set and batch recalculation |
| **Measurement Method** | Rust benchmarks + in-app timing logs |
| **Acceptable Threshold** | See table below |
| **Test Approach** | Benchmark suite with 100-object batch test; nightly CI run |

| Operation | Target | Acceptable Max | Measurement Tool |
|-----------|--------|---------------|-----------------|
| Single star rise/set (analytical) | < 10ms | 50ms | `cargo bench` |
| Single planet rise/set (iterative) | < 100ms | 500ms | `cargo bench` |
| Circumpolar detection | < 5ms | 100ms | `cargo bench` |
| Batch recalculation (100 objects) | < 2s | 5s | In-app timing log |
| Daily midnight recalculation (total) | < 3s | 10s | Background task log |

**Rationale**: Batch recalculation runs as a background task at midnight. It must complete quickly to minimize battery impact and ensure updated notifications are scheduled before the user's next session.

**Related FRs**: FR-13, FR-14, FR-15, FR-18

### NFR-3: Memory Usage

| Field | Detail |
|-------|--------|
| **ID** | NFR-3 |
| **Title** | Application memory footprint |
| **Target Metric** | Peak memory consumption during typical usage |
| **Measurement Method** | Android Studio Memory Profiler / Xcode Instruments |
| **Acceptable Threshold** | See table below |
| **Test Approach** | Profile during 15-minute session with AR active; check for memory leaks on session end |

| Component | Target | Acceptable Max | Notes |
|-----------|--------|---------------|-------|
| Base app (idle) | < 40MB | 50MB | App loaded, no screen active |
| Catalog in memory | < 25MB | 50MB | Full Hipparcos + Messier loaded |
| AR screen active | < 70MB | 80MB | Camera + overlay + tracking |
| 50 tracked alarms | < 2MB | 5MB | SQLite + in-memory cache |
| Peak total | < 80MB | 100MB | All features active simultaneously |

**Rationale**: Target devices (iOS 14+, Android 10+) have 2+ GB RAM, but FindMyStar should not compete aggressively with other apps for memory. Staying under 100MB ensures smooth multi-tasking.

**Related FRs**: All (system-wide constraint)

### NFR-4: Battery Efficiency

| Field | Detail |
|-------|--------|
| **ID** | NFR-4 |
| **Title** | Battery consumption during various usage modes |
| **Target Metric** | Percentage of battery consumed per hour |
| **Measurement Method** | OS battery usage statistics + controlled test sessions (full charge to measurement) |
| **Acceptable Threshold** | See table below |
| **Test Approach** | 60-minute controlled test per mode on reference devices (iPhone 14, Samsung S24) |

| Mode | Target | Acceptable Max | Contributors |
|------|--------|---------------|-------------|
| AR tracking (active, screen on) | < 8%/hr | 10%/hr | Camera, GPS, IMU, CPU, display |
| Info screen (active, screen on) | < 3%/hr | 5%/hr | GPS (intermittent), CPU (light), display |
| Background (app backgrounded) | < 0.5%/hr | 1%/hr | GPS (1-min interval), no CPU |
| Midnight recalculation | < 0.1% total | 0.5% total | CPU burst (~3 seconds) |

**Rationale**: Hobby astronomers (Persona: Raj) conduct 2-4 hour sessions. AR mode battery drain must allow at least 2 hours of continuous use from a full charge without a charger.

**Related FRs**: FR-4 (AR tracking), FR-18 (background recalculation)

---

## 3. Reliability (NFR-5 to NFR-7)

### NFR-5: Offline Operation

| Field | Detail |
|-------|--------|
| **ID** | NFR-5 |
| **Title** | Complete offline operation guarantee |
| **Target Metric** | Feature parity between online and offline states |
| **Measurement Method** | Run full integration test suite with device in airplane mode |
| **Acceptable Threshold** | 100% of MVP features functional offline |
| **Test Approach** | Airplane mode test: enable airplane mode, execute all functional tests, verify zero failures |

**Specific Guarantees**:

| Feature | Offline Behavior | Verification |
|---------|-----------------|-------------|
| Object search | Full catalog available from bundled SQLite | Search "Saturn" in airplane mode |
| AR tracking | All sensors local; no network dependency | Track Jupiter in airplane mode |
| Rise/set calculation | Pure math from ephemeris coefficients | Compute sunrise in airplane mode |
| Alarms | Stored in SQLite; notifications via OS | Set and receive alert in airplane mode |
| GPS | Uses device GPS (no A-GPS network assist) | Verify location lock without network |

**Graceful Degradation**: If GPS is unavailable (indoors, no satellite fix), the system uses the last known location and displays a warning: "Using last known location. Go outdoors for accurate results."

**Related FRs**: All (system-wide constraint). See [ADR-0003](../11-adr/0003-offline-first.md).

### NFR-6: Mathematical Correctness

| Field | Detail |
|-------|--------|
| **ID** | NFR-6 |
| **Title** | Domain engine mathematical correctness |
| **Target Metric** | Unit test coverage and validation accuracy |
| **Measurement Method** | `cargo tarpaulin` (coverage) + validation test suite against USNO/JPL data |
| **Acceptable Threshold** | > 90% line coverage; all validation tests pass |
| **Test Approach** | 100+ validation test cases comparing output to USNO Astronomical Almanac and JPL Horizons ephemeris |

**Validation Targets**:

| Computation | Reference Source | Maximum Acceptable Error |
|-------------|-----------------|------------------------|
| Star altitude | USNO tables | +/- 0.5 deg |
| Planet altitude | JPL Horizons | +/- 1.0 deg |
| Star rise/set time | USNO sunrise/sunset tables | +/- 2 minutes |
| Planet rise/set time | JPL Horizons | +/- 5 minutes |
| Sun position (RA/Dec) | USNO Solar Ephemeris | +/- 5 arcminutes |
| Sidereal time (GMST) | IAU SOFA reference | +/- 1 second |

**Related FRs**: FR-4, FR-5, FR-8, FR-13, FR-14

### NFR-7: Crash Rate

| Field | Detail |
|-------|--------|
| **ID** | NFR-7 |
| **Title** | Production crash rate |
| **Target Metric** | Crash-free session rate |
| **Measurement Method** | Local crash logging (no cloud analytics in MVP); App Store / Play Store crash reports |
| **Acceptable Threshold** | > 99.9% crash-free sessions (< 0.1% crash rate) |
| **Test Approach** | Fuzz testing of domain engine inputs; edge case testing (extreme latitudes, date boundaries, null inputs) |

**Crash Prevention Strategies**:

| Risk Area | Mitigation |
|-----------|-----------|
| Floating-point edge cases | Clamp all acos/asin inputs to [-1, 1] |
| Division by zero | Guard all denominators (cos(lat), cos(dec)) |
| Null sensor data | Fallback values with user warning |
| SQLite corruption | Integrity check on startup; restore from bundled backup |
| Out-of-memory | Lazy catalog loading; pagination of search results |

**Related FRs**: FR-3 (edge cases), all computation FRs

---

## 4. Accuracy (NFR-8 to NFR-10)

### NFR-8: Positional Accuracy

| Field | Detail |
|-------|--------|
| **ID** | NFR-8 |
| **Title** | Celestial object positional accuracy |
| **Target Metric** | Angular deviation from true position |
| **Measurement Method** | Validation against USNO/JPL reference data; field testing with known bright objects |
| **Acceptable Threshold** | See table below |
| **Test Approach** | 100-date validation suite for planets; Polaris-latitude test for stars; field test on 3+ device models |

| Metric | Target | Acceptable Max | Conditions |
|--------|--------|---------------|-----------|
| Horizontal accuracy (Alt/Az) | +/- 0.5 deg | +/- 1.0 deg | Good IMU conditions, device calibrated |
| Rise/set time accuracy (stars) | +/- 1 min | +/- 2 min | Analytical solution |
| Rise/set time accuracy (planets) | +/- 3 min | +/- 5 min | Iterative solution |
| Altitude accuracy at culmination | +/- 0.3 deg | +/- 0.5 deg | Computed, not IMU-limited |

**Related FRs**: FR-5, FR-8, FR-13, FR-14

### NFR-9: Time Accuracy

| Field | Detail |
|-------|--------|
| **ID** | NFR-9 |
| **Title** | System time accuracy requirements |
| **Target Metric** | Maximum tolerable system clock drift |
| **Measurement Method** | Compare device time to NTP time (when available); test with artificially skewed clocks |
| **Acceptable Threshold** | System time within +/- 1 minute of true UTC |
| **Test Approach** | Set device time 30s, 1m, 5m, 30m off and verify graceful degradation |

**Behavior Under Time Skew**:

| Skew | Impact | App Behavior |
|------|--------|-------------|
| < 30 seconds | Negligible (< 0.1 deg altitude error) | Normal operation |
| 30 seconds to 1 minute | Minor (< 0.25 deg altitude error) | Normal operation |
| 1 to 5 minutes | Noticeable (rise/set times off by minutes) | Display warning icon |
| > 5 minutes | Significant (guidance may point to wrong location) | Display prominent warning: "Device clock may be inaccurate" |

**Related FRs**: FR-4, FR-8, FR-13, FR-14

### NFR-10: Attitude/Orientation Accuracy

| Field | Detail |
|-------|--------|
| **ID** | NFR-10 |
| **Title** | Device orientation accuracy from IMU |
| **Target Metric** | Angular accuracy of device pointing direction |
| **Measurement Method** | Comparison against known object positions; controlled rotation tests |
| **Acceptable Threshold** | See table below |
| **Test Approach** | Point device at Polaris (known altitude = latitude); measure deviation across 5 device models |

| Condition | Target Accuracy | Acceptable Max |
|-----------|----------------|---------------|
| After fresh calibration | +/- 0.5 deg | +/- 1.0 deg |
| After 10 minutes of use | +/- 1.0 deg | +/- 2.0 deg |
| Near metal/magnetic interference | +/- 2.0 deg | +/- 5.0 deg |
| Without magnetometer (gyro-only drift) | +/- 5.0 deg | +/- 10.0 deg |

**Calibration Prompt**: If estimated magnetometer error exceeds 10 deg, display a calibration prompt instructing the user to perform figure-eight motion with the device. See FR-6 arrow guidance degradation.

**Phase 2 Enhancement**: Manual star alignment mode -- user points device at a known bright star to correct orientation bias.

**Related FRs**: FR-5, FR-6, FR-7

---

## 5. Data Integrity (NFR-11 to NFR-12)

### NFR-11: SQLite Data Consistency

| Field | Detail |
|-------|--------|
| **ID** | NFR-11 |
| **Title** | SQLite database ACID compliance and consistency |
| **Target Metric** | Zero data loss or corruption during normal operation |
| **Measurement Method** | PRAGMA integrity_check on startup; transaction logging; crash recovery tests |
| **Acceptable Threshold** | PRAGMA integrity_check returns "ok" on 100% of startups after normal and abnormal termination |
| **Test Approach** | Kill app during write operations; verify data integrity on restart; test with low-storage scenarios |

**Data Protection Measures**:

| Mechanism | Purpose |
|-----------|---------|
| SQLite WAL mode | Concurrent reads during writes; crash recovery |
| Foreign key enforcement | Prevent orphaned tracked_objects records |
| UNIQUE constraint on tracked_objects.object_id | Prevent duplicate alarms |
| Startup integrity check | Detect corruption before user interaction |
| Bundled backup catalog | Restore catalog if corruption detected |

**Related FRs**: FR-16 (alarm storage), FR-18 (daily recalculation writes)

### NFR-12: Catalog Integrity

| Field | Detail |
|-------|--------|
| **ID** | NFR-12 |
| **Title** | Pre-loaded catalog validation and integrity |
| **Target Metric** | Catalog completeness and correctness after install and update |
| **Measurement Method** | CRC-32 checksum comparison on app startup; row count validation |
| **Acceptable Threshold** | CRC matches bundled reference; row count matches expected catalog size |
| **Test Approach** | Corrupt catalog file in test builds; verify detection and recovery |

**Integrity Pipeline**:

```
App Install
  |
  v
Load bundled catalog SQLite
  |
  v
Compute CRC-32 of catalog tables
  |
  v
Compare to bundled CRC reference
  |
  +--> Match: Normal operation
  |
  +--> Mismatch: Log error, restore from bundled backup,
       reload catalog, re-verify CRC
```

**Expected Catalog Sizes**:

| Table | Expected Rows (MVP) | Size |
|-------|-------------------|------|
| objects (total) | ~620 | ~100 KB |
| objects (stars) | 100-500 | ~80 KB |
| objects (Messier) | ~110 | ~15 KB |
| objects (planets + Sun + Moon) | 10 | ~1 KB |

**Related FRs**: FR-1 (search depends on catalog), FR-2 (metadata depends on catalog)

---

## 6. Usability (NFR-13 to NFR-14)

### NFR-13: UI Responsiveness

| Field | Detail |
|-------|--------|
| **ID** | NFR-13 |
| **Title** | User interface responsiveness and smoothness |
| **Target Metric** | Interaction response time and animation frame rate |
| **Measurement Method** | React Native Performance Monitor; custom frame timing; manual testing |
| **Acceptable Threshold** | See table below |
| **Test Approach** | Automated UI test suite with timing assertions; manual testing on minimum-spec devices |

| Interaction | Target | Acceptable Max |
|------------|--------|---------------|
| Touch response (any button) | < 100ms | 200ms |
| Screen transition (navigation) | < 200ms | 300ms |
| Search results update (per keystroke) | < 100ms | 200ms |
| Animation frame rate | 60 FPS | 30 FPS (minimum) |
| AR overlay frame rate | 30 FPS | 24 FPS (minimum) |
| Pull-to-refresh completion | < 500ms | 1000ms |

**Jank Prevention**:
- Heavy computations (rise/set, batch recalculation) run on background threads.
- UI thread never blocks on Rust FFI calls.
- List rendering uses virtualization (FlatList) for alarm and search lists.

**Related FRs**: FR-20, FR-21, FR-22, FR-23

### NFR-14: Accessibility

| Field | Detail |
|-------|--------|
| **ID** | NFR-14 |
| **Title** | Accessibility support for users with disabilities |
| **Target Metric** | WCAG 2.1 Level AA compliance for non-AR screens |
| **Measurement Method** | VoiceOver (iOS) and TalkBack (Android) manual testing; automated accessibility audits |
| **Acceptable Threshold** | All non-AR interactive elements accessible; high-contrast mode available; text scaling 100-200% |
| **Test Approach** | Manual screen reader walkthrough of all screens; contrast ratio validation; dynamic type testing |

**Accessibility Requirements**:

| Feature | Requirement |
|---------|------------|
| Screen reader support | All buttons, labels, and data fields have accessibility labels |
| High contrast mode | UI adapts to OS high-contrast setting; arrow colors remain distinguishable |
| Text scaling | Supports 100% to 200% system text size; layout reflows without clipping |
| Touch targets | Minimum 44x44 pt touch targets for all interactive elements |
| Color independence | Information not conveyed by color alone (distance also shown as number) |
| Motion sensitivity | Option to reduce arrow animation smoothness for users sensitive to motion |

**AR Screen Exception**: The AR tracking screen is inherently visual and camera-dependent. For screen reader users, the AR screen provides audio-only guidance: spoken direction ("turn right") and spoken distance ("3 degrees away").

**Related FRs**: FR-20 through FR-23 (all UI screens). Related Persona: Sam (educator, inclusive teaching).

---

## 7. Performance Targets Summary

| Operation | Target | Current Estimate | Measurement Tool | Related NFR |
|-----------|--------|------------------|-----------------|-------------|
| AR frame rate | 30 FPS | 60+ FPS | Frame timing overlay | NFR-1 |
| Position computation | < 10ms | < 5ms | `cargo bench` | NFR-1 |
| Rise/set (star) | < 50ms | < 10ms | `cargo bench` | NFR-2 |
| Rise/set (planet) | < 500ms | < 100ms | `cargo bench` | NFR-2 |
| Batch alarm recalc (100 objects) | < 5s | < 2s | In-app timing | NFR-2 |
| Touch response | < 200ms | < 100ms | UI profiler | NFR-13 |
| Memory (peak) | < 100MB | ~65MB | OS profiler | NFR-3 |
| Battery (AR mode) | < 10%/hr | ~5-8%/hr | Controlled test | NFR-4 |
| Crash-free sessions | > 99.9% | TBD | App Store metrics | NFR-7 |

---

## 8. Cross-References

| Document | Relationship |
|----------|-------------|
| [SRS](./srs.md) | Source definitions for NFR-1 through NFR-14 |
| [Functional Requirements](./functional-requirements.md) | FRs constrained by each NFR |
| [Constraints](./constraints.md) | Technical and business constraints influencing NFR targets |
| [Architecture Overview](../03-architecture/architecture-overview.md) | Performance targets table (Section 10) |
| [Algorithms](../04-domain-engine/algorithms.md) | Mathematical precision enabling NFR-6 and NFR-8 |
| [Testing Strategy](../08-testing/overview.md) | Test approaches for each NFR |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md) | NFR-5 architectural foundation |
| [Database Schema](../05-data-model/schema.md) | NFR-11 and NFR-12 data structures |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Engineering Team
