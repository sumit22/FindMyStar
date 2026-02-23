# Validation Strategy

## 1. Validation Philosophy

The domain engine's correctness is validated by comparing its outputs against **authoritative astronomical reference sources**. Because the engine is deterministic and side-effect-free, every function can be tested with exact inputs and compared against known-good reference values.

Validation is not the same as unit testing. Unit tests verify internal logic (e.g., "does normalization produce a unit vector?"). Validation tests verify **astronomical correctness** (e.g., "does our computed sunrise match the official USNO sunrise to within 2 minutes?").

The validation suite runs as part of the standard CI pipeline via `cargo test --test validation_tests` and must pass before any release.

---

## 2. Reference Data Sources

### 2.1 U.S. Naval Observatory (USNO)

The USNO Astronomical Applications Department provides official rise/set times, twilight data, and solar/lunar positions for any date and location.

- **Data**: Sunrise, sunset, moonrise, moonset, twilight times
- **Accuracy**: Definitive (used as ground truth by the U.S. government)
- **Access**: https://aa.usno.navy.mil/data
- **Usage**: Primary reference for rise/set validation
- **Format**: Manually extracted and embedded as test constants

### 2.2 JPL Horizons

NASA's Jet Propulsion Laboratory Horizons system provides high-precision ephemeris for all solar system bodies.

- **Data**: RA, Dec, distance, magnitude for Sun, Moon, planets, asteroids
- **Accuracy**: Sub-arcsecond for planets, sub-arcminute for the Moon
- **Access**: https://ssd.jpl.nasa.gov/horizons/
- **Usage**: Primary reference for ephemeris validation (RA/Dec accuracy)
- **Format**: Batch query results parsed into test data structures

### 2.3 Hipparcos Catalog

The ESA Hipparcos mission measured positions of 118,218 stars with milliarcsecond precision.

- **Data**: RA, Dec, proper motion, parallax, magnitude at epoch J1991.25
- **Accuracy**: 1-2 milliarcseconds (positional)
- **Access**: https://www.cosmos.esa.int/web/hipparcos
- **Usage**: Reference for star catalog verification and precession correction
- **Format**: Pre-processed into the bundled star catalog

### 2.4 SOFA (Standards of Fundamental Astronomy)

The IAU SOFA library provides reference implementations of fundamental astronomy algorithms.

- **Data**: Reference algorithm implementations in C and Fortran
- **Accuracy**: Full IAU-standard precision
- **Access**: https://www.iausofa.org/
- **Usage**: Cross-checking our simplified algorithms against full-precision implementations
- **Format**: Selected test outputs embedded as validation constants

---

## 3. Validation Test Cases

### 3.1 Polaris Altitude Test

The simplest and most intuitive validation: Polaris's altitude should approximately equal the observer's latitude.

```rust
#[test]
fn validate_polaris_altitude_matches_latitude() {
    let polaris_ra = 2.5303;    // hours (RA 2h 31m 49s)
    let polaris_dec = 89.2641;  // degrees (Dec +89° 15' 51")

    let test_latitudes = vec![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0];

    for lat in test_latitudes {
        // Use a time when Polaris is near transit for best accuracy
        let (alt, _az) = ra_dec_to_altaz(polaris_ra, polaris_dec, lat, 0.0, TEST_TIME_MS);
        let error = (alt - lat).abs();
        assert!(
            error < 1.5,
            "Polaris altitude {:.2} should be within 1.5° of latitude {:.1}, error = {:.2}",
            alt, lat, error
        );
    }
}
```

**Acceptance**: |Alt - Lat| < 1.5 degrees (Polaris is 0.74 degrees from the true pole).

### 3.2 Sun Rise/Set Times vs USNO

```rust
struct SunRiseSetTestCase {
    date: &'static str,
    lat: f64,
    lon: f64,
    expected_sunrise_utc: &'static str,  // "HH:MM"
    expected_sunset_utc: &'static str,
    source: &'static str,
}

const SUN_RISE_SET_CASES: &[SunRiseSetTestCase] = &[
    SunRiseSetTestCase {
        date: "2024-01-01", lat: 38.9072, lon: -77.0369,
        expected_sunrise_utc: "12:27", expected_sunset_utc: "21:58",
        source: "USNO Washington DC",
    },
    SunRiseSetTestCase {
        date: "2024-06-21", lat: 38.9072, lon: -77.0369,
        expected_sunrise_utc: "09:43", expected_sunset_utc: "00:37",
        source: "USNO Washington DC (summer solstice)",
    },
    SunRiseSetTestCase {
        date: "2024-03-20", lat: 51.4769, lon: -0.0005,
        expected_sunrise_utc: "06:04", expected_sunset_utc: "18:07",
        source: "USNO Greenwich (vernal equinox)",
    },
    // ... additional cases for 10 locations worldwide
];

#[test]
fn validate_sun_rise_set_against_usno() {
    for tc in SUN_RISE_SET_CASES {
        let time_ms = date_to_unix_ms(tc.date);
        let result = compute_rise_set_iterative(
            ObjectId::Sun, tc.lat, tc.lon, time_ms, SUN_STANDARD_ALTITUDE
        );
        match result {
            RiseSetResult::Normal { rise_ms, set_ms } => {
                let rise_error = time_diff_minutes(rise_ms, parse_utc(tc.date, tc.expected_sunrise_utc));
                let set_error = time_diff_minutes(set_ms, parse_utc(tc.date, tc.expected_sunset_utc));
                assert!(rise_error < 3.0, "Sunrise error {:.1} min for {}", rise_error, tc.source);
                assert!(set_error < 3.0, "Sunset error {:.1} min for {}", set_error, tc.source);
            },
            _ => panic!("Expected Normal rise/set for {}", tc.source),
        }
    }
}
```

**Acceptance**: Rise/set times within +/-3 minutes of USNO data.

### 3.3 Planet Positions vs JPL Horizons

```rust
struct PlanetPositionTestCase {
    date: &'static str,
    planet: ObjectId,
    expected_ra_hours: f64,
    expected_dec_deg: f64,
    tolerance_arcmin: f64,
    source: &'static str,
}

const PLANET_POSITION_CASES: &[PlanetPositionTestCase] = &[
    PlanetPositionTestCase {
        date: "2024-01-15", planet: ObjectId::Jupiter,
        expected_ra_hours: 2.387, expected_dec_deg: 13.12,
        tolerance_arcmin: 5.0, source: "JPL Horizons",
    },
    PlanetPositionTestCase {
        date: "2024-07-04", planet: ObjectId::Saturn,
        expected_ra_hours: 23.307, expected_dec_deg: -7.52,
        tolerance_arcmin: 5.0, source: "JPL Horizons",
    },
    // ... cases for all 8 planets across multiple dates
];
```

**Acceptance**: RA/Dec within +/-5 arcminutes of JPL Horizons for outer planets, +/-2 arcminutes for inner planets.

### 3.4 Known Star Positions

```rust
#[test]
fn validate_bright_star_positions() {
    let stars = vec![
        ("Sirius",    6.7525, -16.7161),
        ("Vega",     18.6156,  38.7837),
        ("Arcturus", 14.2610,  19.1824),
        ("Rigel",     5.2423,  -8.2016),
        ("Betelgeuse", 5.9195, 7.4071),
    ];

    for (name, expected_ra, expected_dec) in stars {
        let (ra, dec, _mag) = lookup_star_by_name(name);
        let ra_error_arcmin = (ra - expected_ra).abs() * 60.0 * 15.0;  // hours to arcmin
        let dec_error_arcmin = (dec - expected_dec).abs() * 60.0;
        assert!(ra_error_arcmin < 1.0, "{} RA error: {:.2}'", name, ra_error_arcmin);
        assert!(dec_error_arcmin < 1.0, "{} Dec error: {:.2}'", name, dec_error_arcmin);
    }
}
```

**Acceptance**: Catalog positions match Hipparcos to within 1 arcminute (after precession correction).

---

## 4. Test Data Format

All validation test data is stored as embedded Rust constants in `validation/reference_data.rs`:

```rust
pub struct ValidationRecord {
    pub date_iso: &'static str,       // "2024-01-15"
    pub time_utc: &'static str,       // "22:00:00"
    pub lat: f64,                      // Observer latitude
    pub lon: f64,                      // Observer longitude
    pub object: &'static str,         // Object name or ID
    pub expected_ra: f64,              // RA in hours
    pub expected_dec: f64,             // Dec in degrees
    pub expected_alt: Option<f64>,     // Alt in degrees (if applicable)
    pub expected_az: Option<f64>,      // Az in degrees (if applicable)
    pub expected_rise_utc: Option<&'static str>,  // "HH:MM"
    pub expected_set_utc: Option<&'static str>,
    pub source: &'static str,         // "USNO", "JPL Horizons", etc.
    pub tolerance_arcmin: f64,         // Acceptable error
}
```

This format allows a single data-driven test to validate multiple aspects of the computation pipeline.

---

## 5. Automated Validation Pipeline

### 5.1 CI Integration

The validation suite runs in the GitHub Actions CI pipeline on every push and pull request:

```yaml
- name: Run validation tests
  run: cargo test --test validation_tests --release
  timeout-minutes: 10
```

### 5.2 Coverage Matrix

| Dimension | Values | Count |
|-----------|--------|-------|
| Dates | 1st and 15th of each month, 2024-2025 | 48 |
| Locations | See table below | 10 |
| Objects | Sun, Moon, Mercury through Neptune | 10 |
| **Total test cases** | | **~4800** |

### 5.3 Test Locations

| Location | Latitude | Longitude | Rationale |
|----------|---------|-----------|-----------|
| Greenwich, UK | 51.4769 | -0.0005 | Prime meridian reference |
| Washington DC | 38.9072 | -77.0369 | USNO headquarters |
| Tokyo, Japan | 35.6762 | 139.6503 | Eastern hemisphere |
| Sydney, Australia | -33.8688 | 151.2093 | Southern hemisphere |
| Quito, Ecuador | -0.1807 | -78.4678 | Equatorial |
| Tromso, Norway | 69.6496 | 18.9560 | Arctic (midnight sun) |
| Ushuaia, Argentina | -54.8019 | -68.3030 | High southern latitude |
| Mauna Kea, Hawaii | 19.8207 | -155.4680 | Major observatory site |
| Cape Town, SA | -33.9249 | 18.4241 | Southern hemisphere mid-lat |
| New Delhi, India | 28.6139 | 77.2090 | Indian subcontinent |

---

## 6. Acceptance Criteria

| Metric | Threshold | Current Status | Notes |
|--------|-----------|----------------|-------|
| Sun RA/Dec | < 5 arcminutes | Passing | Simplified model |
| Moon RA/Dec | < 60 arcminutes | Passing | Low-precision model |
| Inner planets RA/Dec | < 2 arcminutes | Passing | VSOP87 truncated |
| Outer planets RA/Dec | < 5 arcminutes | Passing | VSOP87 truncated |
| Sun rise/set time | < 3 minutes | Passing | Iterative solver |
| Star Alt/Az | < 1 degree | Passing | Coordinate transforms |
| Polaris altitude | < 1.5 degrees of latitude | Passing | Combined pipeline |
| Sidereal time (GMST) | < 1 second | Passing | Polynomial approximation |
| Julian Date | < 1 millisecond | Passing | Direct formula |
| Angular distance | < 0.001 degree (self-test) | Passing | Floating-point precision |

### 6.1 Regression Policy

If any validation test fails after a code change:

1. The CI build is marked as failed (merge blocked).
2. The developer must either fix the regression or update the threshold with justification.
3. Threshold relaxation requires review and approval by a second team member.
4. All threshold changes are documented in the CHANGELOG.

---

## 7. Known Limitations

The following physical effects are **not modeled** in the MVP. They contribute to the gap between computed and true observed positions:

| Effect | Magnitude | Impact | Planned |
|--------|-----------|--------|---------|
| Atmospheric refraction | 0 at zenith, ~0.5 at horizon, ~34' at 0 altitude | Rise/set times off by ~2 min | Phase 2 |
| Nutation | ~9" in obliquity, ~17" in longitude | Negligible for our accuracy | Phase 2 |
| Aberration | ~20" maximum | Below threshold | Phase 3 |
| Parallax (diurnal) | < 9" for Moon, negligible for others | Below threshold | Not planned |
| Delta-T (TT - UT) | ~69 seconds in 2024 | Absorbed into time error budget | Phase 2 |
| Light-time correction | Varies by planet distance | < 1" for practical purposes | Phase 2 |

These limitations are acceptable for the MVP because the dominant error source is the device IMU (+/-0.5 to 2 degrees), which is 2-3 orders of magnitude larger than any unmodeled physical effect.

---

## 8. Cross-References

- **[Testing Strategy](../08-testing/overview.md)** -- Overall testing approach including unit and integration tests
- **[Core Astronomical Algorithms, Section 10](./algorithms.md#10-error-bounds-and-validation)** -- Error bounds summary
- **[Error Bounds](./error-bounds.md)** -- Detailed accuracy analysis and error propagation
- **[Ephemeris Computation](./ephemeris.md)** -- Algorithms being validated
- **[SRS, NFR-8/9/10](../02-requirements/srs.md)** -- Non-functional requirements for accuracy

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
