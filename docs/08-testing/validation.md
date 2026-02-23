# Astronomical Validation

## 1. Validation Philosophy

FindMyStar computes celestial positions, rise/set times, and ephemeris data using
simplified algorithms optimized for mobile performance. To ensure these computations
remain accurate enough for reliable AR tracking and alarm scheduling, we **compare
every computed result against authoritative professional sources**.

Validation tests are distinct from unit tests: rather than testing internal logic, they
verify that the system's outputs match real-world astronomical truth within defined
acceptance thresholds.

For the overall testing strategy, see [overview.md](./overview.md). For algorithm
specifications, see [algorithms.md](../04-domain-engine/algorithms.md) Section 10.

---

## 2. Reference Data Sources

### 2.1 U.S. Naval Observatory (USNO)

- **URL**: https://aa.usno.navy.mil/
- **Data used**: Official sun/moon rise/set times, twilight times, planet positions
- **Authority**: The U.S. Government's official source for astronomical data
- **Precision**: Sub-second timing, sub-arcsecond positions
- **Coverage**: Sun and Moon rise/set tables for any location and date

### 2.2 JPL Horizons (NASA)

- **URL**: https://ssd.jpl.nasa.gov/horizons/
- **Data used**: High-precision ephemeris for all solar system objects
- **Authority**: NASA Jet Propulsion Laboratory's definitive planetary ephemeris
- **Precision**: Sub-arcsecond for inner planets, arcsecond-level for outer planets
- **Coverage**: All planets, dwarf planets, moons, asteroids, comets

### 2.3 Hipparcos Catalog (ESA)

- **URL**: https://www.cosmos.esa.int/web/hipparcos
- **Data used**: Definitive star positions, proper motions, parallax
- **Authority**: European Space Agency's space astrometry mission
- **Precision**: Milliarcsecond-level star positions
- **Coverage**: 118,218 stars; we use the ~500 brightest

### 2.4 SOFA Library (IAU)

- **URL**: https://www.iausofa.org/
- **Data used**: Reference algorithm implementations for time conversion, coordinate
  transforms, precession, and nutation
- **Authority**: International Astronomical Union's Standards of Fundamental Astronomy
- **Purpose**: Cross-check our simplified algorithms against the gold-standard
  implementations

---

## 3. Validation Test Suite Structure

```
/core/tests/
├── validation_sun.rs           - Sun position and rise/set validation
├── validation_moon.rs          - Moon position and phase validation
├── validation_planets.rs       - Planet position validation
├── validation_stars.rs         - Star position (Alt/Az) validation
├── validation_report.rs        - Report generation utility
└── reference_data/
    ├── usno_sunrise_2024.json  - 100 dates x 10 locations (USNO)
    ├── usno_sunset_2024.json   - 100 dates x 10 locations (USNO)
    ├── usno_moonrise_2024.json - 50 dates x 10 locations (USNO)
    ├── jpl_planets_2024.json   - 8 planets x 50 dates x 5 locations (JPL)
    ├── hipparcos_bright.json   - 50 brightest stars (Hipparcos)
    └── sofa_reference.json     - SOFA algorithm comparison values
```

Each JSON reference file includes the source URL, retrieval date, and original query
parameters for reproducibility.

---

## 4. Sun Validation Tests

### Test Matrix

- **Dates**: 100 dates evenly distributed across 2024 (every ~3.65 days)
- **Locations**: 10 worldwide locations spanning all latitudes

| Location            | Latitude  | Longitude  | Purpose               |
|---------------------|-----------|------------|-----------------------|
| Greenwich, UK       | 51.48°N   | 0.00°W     | Prime meridian        |
| Washington DC, USA  | 38.90°N   | 77.04°W    | USNO home location    |
| Sydney, Australia   | 33.87°S   | 151.21°E   | Southern hemisphere   |
| Reykjavik, Iceland  | 64.15°N   | 21.94°W    | High latitude (polar) |
| Singapore           | 1.35°N    | 103.82°E   | Near equator          |
| Ushuaia, Argentina  | 54.80°S   | 68.30°W    | Far southern          |
| Tokyo, Japan        | 35.68°N   | 139.69°E   | East Asia             |
| Nairobi, Kenya      | 1.29°S    | 36.82°E    | Equatorial Africa     |
| Anchorage, USA      | 61.22°N   | 149.90°W   | High latitude (North) |
| McMurdo, Antarctica | 77.85°S   | 166.67°E   | Near South Pole       |

### Metrics and Acceptance Thresholds

| Metric          | Acceptance Threshold | Rationale                                |
|-----------------|---------------------|------------------------------------------|
| RA              | +/- 5 arcminutes    | Sufficient for visual identification      |
| Dec             | +/- 5 arcminutes    | Sufficient for visual identification      |
| Altitude        | +/- 0.5 degrees     | Within AR pointing accuracy               |
| Azimuth         | +/- 0.5 degrees     | Within AR pointing accuracy               |
| Rise time       | +/- 2 minutes       | Acceptable for alarm scheduling           |
| Set time        | +/- 2 minutes       | Acceptable for alarm scheduling           |

### Implementation

```rust
#[test]
fn test_sun_rise_times_against_usno() {
    let reference: Vec<SunReference> = load_reference("usno_sunrise_2024.json");
    let mut failures = Vec::new();

    for entry in &reference {
        let computed = compute_sunrise(entry.date, entry.lat, entry.lon);
        let diff_minutes = time_diff_minutes(computed, entry.expected_rise);

        if diff_minutes.abs() > 2.0 {
            failures.push(format!(
                "FAIL: {} at ({:.2}, {:.2}): computed={}, expected={}, diff={:.1}min",
                entry.date, entry.lat, entry.lon, computed, entry.expected_rise, diff_minutes
            ));
        }
    }

    assert!(
        failures.is_empty(),
        "Sun rise validation failures:\n{}",
        failures.join("\n")
    );
}

#[test]
fn test_sun_position_against_usno() {
    let reference: Vec<SunPositionRef> = load_reference("usno_sun_positions_2024.json");

    for entry in &reference {
        let (ra, dec) = compute_sun_position(entry.jd);
        let ra_err_arcmin = (ra - entry.expected_ra).abs() * 60.0;
        let dec_err_arcmin = (dec - entry.expected_dec).abs() * 60.0;

        assert!(ra_err_arcmin < 5.0,
            "Sun RA error {:.2}' exceeds 5' threshold on JD {}", ra_err_arcmin, entry.jd);
        assert!(dec_err_arcmin < 5.0,
            "Sun Dec error {:.2}' exceeds 5' threshold on JD {}", dec_err_arcmin, entry.jd);
    }
}
```

---

## 5. Planet Validation Tests

### Test Matrix

- **Planets**: Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune (+ Earth excluded)
- **Dates**: 50 dates across 2024 (weekly samples)
- **Locations**: 5 locations (Greenwich, Washington DC, Sydney, Tokyo, Nairobi)

### Acceptance Thresholds

| Planet Group     | RA/Dec Threshold | Rationale                              |
|------------------|-----------------|----------------------------------------|
| Inner (Mercury, Venus, Mars) | +/- 1 arcminute | Fast-moving; tighter precision needed |
| Outer (Jupiter, Saturn)      | +/- 3 arcminutes | Slower; moderate precision sufficient |
| Far outer (Uranus, Neptune)  | +/- 5 arcminutes | Very slow; relaxed threshold          |

### Implementation

```rust
#[test]
fn test_planet_positions_against_jpl() {
    let reference: Vec<PlanetReference> = load_reference("jpl_planets_2024.json");
    let mut report = ValidationReport::new("Planet Positions vs JPL Horizons");

    for entry in &reference {
        let (ra, dec) = compute_planet_position(entry.planet_id, entry.jd);
        let ra_err = angular_diff_arcmin(ra, entry.expected_ra);
        let dec_err = (dec - entry.expected_dec).abs() * 60.0;
        let threshold = planet_threshold(entry.planet_id);

        report.add_result(ValidationResult {
            object: entry.planet_name.clone(),
            date: entry.date.clone(),
            ra_error_arcmin: ra_err,
            dec_error_arcmin: dec_err,
            pass: ra_err < threshold && dec_err < threshold,
        });
    }

    report.print_summary();
    assert!(report.all_passed(), "Planet validation failures:\n{}", report.failures_text());
}
```

---

## 6. Star Validation Tests

### Test Matrix

- **Stars**: 50 brightest stars from the Hipparcos catalog
- **Dates**: 10 dates across 2024 (monthly + solstices/equinoxes)
- **Locations**: 5 locations (same as planet tests)

### Acceptance Thresholds

| Metric     | Threshold     | Rationale                                 |
|------------|--------------|-------------------------------------------|
| Altitude   | +/- 0.5 degrees | Must be within AR field-of-view accuracy |
| Azimuth    | +/- 0.5 degrees | Must be within AR field-of-view accuracy |

Stars have fixed RA/Dec (ignoring proper motion for MVP), so the primary validation is
that the horizontal coordinate transform (RA/Dec to Alt/Az) produces correct results
at specific times and locations.

### Implementation

```rust
#[test]
fn test_star_altaz_against_reference() {
    let stars: Vec<StarReference> = load_reference("hipparcos_bright.json");
    let dates = load_test_dates();
    let locations = load_test_locations();
    let mut failures = Vec::new();

    for star in &stars {
        for date in &dates {
            for loc in &locations {
                let (alt, az) = ra_dec_to_altaz(
                    star.ra_hours, star.dec_deg, loc.lat, loc.lon, date.unix_ms
                );
                let expected = lookup_expected(star.id, date.id, loc.id);

                if (alt - expected.alt).abs() > 0.5 {
                    failures.push(format!(
                        "{} on {} at {}: alt={:.2} expected={:.2}",
                        star.name, date.label, loc.name, alt, expected.alt
                    ));
                }
                if (az - expected.az).abs() > 0.5 {
                    // Handle 360/0 wraparound
                    let az_diff = azimuth_diff(az, expected.az);
                    if az_diff > 0.5 {
                        failures.push(format!(
                            "{} on {} at {}: az={:.2} expected={:.2}",
                            star.name, date.label, loc.name, az, expected.az
                        ));
                    }
                }
            }
        }
    }

    assert!(failures.is_empty(),
        "{} star validation failures:\n{}", failures.len(), failures.join("\n"));
}
```

---

## 7. Automated Validation Pipeline

### Running Validation Tests

```bash
# Run all validation tests with detailed output
cargo test --test validation_sun --test validation_moon \
           --test validation_planets --test validation_stars \
           -- --nocapture

# Run a specific validation suite
cargo test --test validation_sun -- --nocapture

# Generate a full comparison report (writes to stdout)
cargo test --test validation_report -- --nocapture > validation_report.txt
```

### CI Pipeline Integration

Validation tests run on every merge to `main` as part of the full test suite:

```yaml
# .github/workflows/validation.yml
name: Astronomical Validation
on:
  push:
    branches: [main]
  schedule:
    - cron: "0 6 1 * *"  # Monthly on the 1st

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run validation suite
        run: cargo test --test validation_sun --test validation_moon --test validation_planets --test validation_stars -- --nocapture
      - name: Generate report
        run: cargo test --test validation_report -- --nocapture > validation_report.txt
      - uses: actions/upload-artifact@v4
        with:
          name: validation-report
          path: validation_report.txt
```

### Report Format

The validation report summarizes pass/fail statistics and highlights outliers:

```
=== FindMyStar Astronomical Validation Report ===
Date: 2024-06-15
Reference sources: USNO, JPL Horizons, Hipparcos

Sun Position:      1000/1000 passed (100.0%)  max error: 3.8 arcmin
Sun Rise/Set:       980/1000 passed (98.0%)   max error: 1.8 min
Moon Position:      490/500  passed (98.0%)   max error: 8.2 arcmin
Planet Positions:  1980/2000 passed (99.0%)   max error: 4.1 arcmin
Star Alt/Az:       2490/2500 passed (99.6%)   max error: 0.48 deg

OVERALL: 6940/7000 passed (99.1%)

Failures flagged for review:
  - Moon position on 2024-03-25 at McMurdo: Dec error 8.2' (threshold 5')
  ...
```

---

## 8. Sample Reference Data

The following table shows a representative subset of reference data used in validation:

| Date       | Location        | Object  | Expected RA  | Expected Dec  | Expected Alt | Source |
|------------|-----------------|---------|-------------|---------------|-------------|--------|
| 2024-01-01 | Greenwich       | Sun     | 18h 45m     | -23° 01'      | 15.2°       | USNO   |
| 2024-03-20 | Greenwich       | Sun     | 0h 00m      | +0° 00'       | 38.5°       | USNO   |
| 2024-06-21 | Greenwich       | Sun     | 6h 02m      | +23° 26'      | 62.0°       | USNO   |
| 2024-06-15 | Washington DC   | Jupiter | 4h 52m      | +21° 58'      | 45.3°       | JPL    |
| 2024-06-15 | Washington DC   | Saturn  | 23h 12m     | -7° 15'       | -12.4°      | JPL    |
| 2024-06-15 | San Francisco   | Mars    | 2h 38m      | +15° 22'      | 28.1°       | JPL    |
| 2024-01-15 | Sydney          | Sirius  | 6h 45m      | -16° 43'      | 72.1°       | HIP    |
| 2024-01-15 | Tokyo           | Vega    | 18h 37m     | +38° 47'      | -5.2°       | HIP    |
| 2024-06-15 | Nairobi         | Canopus | 6h 24m      | -52° 42'      | 36.0°       | HIP    |

> **Note**: RA/Dec values for stars are fixed (J2000.0 epoch). Planet RA/Dec values are
> date-specific. Altitude values depend on both location and time of observation.

---

## 9. Known Limitations

### Atmospheric Refraction Not Modeled

Our algorithms compute **geometric** altitude (the true angle above the horizon). The
atmosphere bends light, making objects appear higher than they geometrically are. This
effect is strongest at the horizon (+0.57 degrees on average) and negligible above 15
degrees altitude.

**Impact**: Rise/set times may differ from USNO by up to 2 minutes because USNO accounts
for standard atmospheric refraction. Our acceptance threshold of +/- 2 minutes
accommodates this difference.

### Nutation Simplified

Full nutation (the short-period wobble of Earth's axis) involves hundreds of terms. Our
implementation uses a simplified model with the dominant terms only.

**Impact**: Adds up to +/- 0.003 degrees error in RA/Dec. This is well below our
acceptance thresholds and negligible for visual observation.

### Proper Motion Ignored for MVP

Star positions are fixed at J2000.0 epoch values. Real stars move across the sky at rates
of up to a few arcseconds per year (Barnard's Star: 10.3"/yr).

**Impact**: For the 50 brightest stars, maximum positional error after 25 years (from
J2000.0 to 2025) is approximately:
- Most stars: < 0.01 degrees (negligible)
- High proper motion stars (e.g., Arcturus): ~ 0.015 degrees
- This is well within our 0.5-degree acceptance threshold

Proper motion correction is planned for a future version.

### Aberration Not Modeled

Annual aberration (up to 20.5 arcseconds) due to Earth's orbital velocity is not
modeled.

**Impact**: Adds up to +/- 0.006 degrees. Negligible for our use case.

---

## 10. Future Validation Plans

- **Phase 2**: Add real-time validation mode that compares live computations against
  JPL Horizons API (when internet is available)
- **Phase 2**: Include atmospheric refraction model and re-validate rise/set times
  against tighter thresholds (+/- 1 minute)
- **Phase 3**: Add proper motion corrections and validate against Gaia DR3 catalog
  positions

---

## 11. Cross-References

- [Testing Strategy Overview](./overview.md) -- Full testing strategy and CI pipeline
- [Unit Tests](./unit-tests.md) -- Isolated component tests
- [Integration Tests](./integration-tests.md) -- End-to-end workflow tests
- [Performance Testing](./performance.md) -- Benchmarks and profiling
- [Core Algorithms](../04-domain-engine/algorithms.md) -- Algorithm specifications,
  particularly Section 10 (Error Bounds and Validation)
- [SRS Non-Functional Requirements](../02-requirements/srs.md) -- NFR-6 (Accuracy) and
  NFR-8 (Validation)

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
