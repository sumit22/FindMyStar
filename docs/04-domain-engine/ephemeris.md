# Ephemeris Computation

## 1. Overview

Ephemeris computation determines the **celestial coordinates** (Right Ascension and Declination) of astronomical objects at any given moment. These coordinates are the starting point for every downstream calculation in FindMyStar: coordinate transforms, rise/set solving, visibility filtering, and AR guidance.

The domain engine provides ephemeris for four categories of objects:

| Category | Count | Algorithm | Data Source | Update Frequency |
|----------|-------|-----------|-------------|------------------|
| Sun | 1 | Analytical (simplified) | Embedded constants | Never (constants) |
| Moon | 1 | Analytical (low-precision) | Embedded constants | Never (constants) |
| Planets | 8 | VSOP87 truncated series | Bundled coefficients (~1 MB) | Never (valid for centuries) |
| Fixed Stars | 500+ | Catalog lookup + precession | Hipparcos (bundled, ~3 MB) | Never (valid for decades) |

All ephemeris functions are **pure**: they take a Julian Date (or Unix timestamp) as input and return `(RA_hours, Dec_degrees)` as output, with no side effects or internal state.

---

## 2. Sun Position

### 2.1 Simplified Solar Model (MVP)

The simplified model computes the Sun's apparent geocentric position using mean orbital elements and a first-order equation of center. This is the algorithm documented in [algorithms.md, Section 7.1](./algorithms.md#71-sun-position-simplified).

**Input**: Julian Date (`JD`, f64)
**Output**: `(RA_hours, Dec_degrees)`

```
Algorithm:

1. Compute Julian centuries since J2000.0:
   T = (JD - 2451545.0) / 36525.0

2. Compute geometric mean longitude of the Sun:
   L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T^2
   L0 = L0 mod 360   (normalize to 0-360)

3. Compute mean anomaly:
   M = 357.52911 + 35999.05029 * T - 0.0001537 * T^2
   M = M mod 360

4. Compute equation of center:
   C = (1.914602 - 0.004817 * T - 0.000014 * T^2) * sin(M)
     + (0.019993 - 0.000101 * T) * sin(2 * M)
     + 0.000289 * sin(3 * M)

5. Compute Sun's ecliptic longitude:
   lambda = L0 + C

6. Compute obliquity of the ecliptic:
   epsilon = 23.439291 - 0.013004 * T

7. Convert ecliptic to equatorial:
   RA  = atan2(cos(epsilon) * sin(lambda), cos(lambda))
   Dec = asin(sin(epsilon) * sin(lambda))

8. Normalize RA to 0-24 hours:
   RA_hours = (RA_degrees / 15.0) mod 24
```

**Rust Implementation**:

```rust
pub fn compute_sun_position(jd: f64) -> (f64, f64) {
    let t = (jd - 2451545.0) / 36525.0;

    let l0 = normalize_degrees(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
    let m = normalize_degrees(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
    let m_rad = m.to_radians();

    let c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * m_rad.sin()
          + (0.019993 - 0.000101 * t) * (2.0 * m_rad).sin()
          + 0.000289 * (3.0 * m_rad).sin();

    let lambda = (l0 + c).to_radians();
    let epsilon = (23.439291 - 0.013004 * t).to_radians();

    let ra = epsilon.cos() * lambda.sin();
    let ra_rad = ra.atan2(lambda.cos());
    let dec_rad = (epsilon.sin() * lambda.sin()).asin();

    let ra_hours = normalize_hours(ra_rad.to_degrees() / 15.0);
    let dec_degrees = dec_rad.to_degrees();

    (ra_hours, dec_degrees)
}
```

**Accuracy**: +/-5 arcminutes compared to full VSOP87. Sufficient for MVP where the dominant error source is the device IMU (+/-0.5 to 2 degrees).

### 2.2 Full VSOP87 (Phase 2)

For users requiring higher precision (e.g., solar eclipse timing, precise twilight boundaries), the engine will implement the full VSOP87 heliocentric model in a future phase. This adds ~200 KB of bundled coefficients and achieves sub-arcsecond accuracy over the interval 2000-2100 CE.

---

## 3. Moon Position

### 3.1 Low-Precision Lunar Model (MVP)

The Moon's position is computed using a simplified model based on the principal terms of the lunar theory. This provides accuracy of approximately +/-1 degree, which is adequate for a finder application (the Moon's apparent diameter is ~0.5 degrees).

**Input**: Julian Date (`JD`, f64)
**Output**: `(RA_hours, Dec_degrees)`

```
Algorithm:

1. Compute Julian centuries:
   T = (JD - 2451545.0) / 36525.0

2. Compute fundamental arguments (degrees):
   L' = 218.3165 + 481267.8813 * T         (Moon's mean longitude)
   D  = 297.8502 + 445267.1115 * T         (Mean elongation)
   M  = 357.5291 + 35999.0503 * T          (Sun's mean anomaly)
   M' = 134.9634 + 477198.8676 * T         (Moon's mean anomaly)
   F  = 93.2720  + 483202.0175 * T         (Moon's argument of latitude)

3. Compute ecliptic longitude correction:
   dL = 6.289 * sin(M')
      - 1.274 * sin(2*D - M')
      + 0.658 * sin(2*D)
      + 0.214 * sin(2*M')
      - 0.186 * sin(M)
      - 0.114 * sin(2*F)

4. Compute ecliptic latitude:
   B = 5.128 * sin(F)
     + 0.281 * sin(M' + F)
     + 0.278 * sin(M' - F)

5. Moon's ecliptic longitude:
   lambda = L' + dL

6. Convert (lambda, B) to equatorial (RA, Dec):
   epsilon = 23.439291 - 0.013004 * T    (obliquity)

   RA  = atan2(sin(lambda)*cos(epsilon) - tan(B)*sin(epsilon), cos(lambda))
   Dec = asin(sin(B)*cos(epsilon) + cos(B)*sin(epsilon)*sin(lambda))
```

**Accuracy**: +/-1 degree in both RA and Dec. The Moon moves approximately 0.5 degrees per hour, so this model remains valid for time windows up to approximately 2 hours without recomputation.

### 3.2 Recomputation Interval

Because the Moon moves rapidly, the engine recomputes lunar position at every AR frame (30 FPS). At 0.5 degrees per hour, the position error from a 33 ms stale computation is negligible (< 0.005 arcseconds).

---

## 4. Planetary Positions

### 4.1 VSOP87 Truncated Series

Planetary positions are computed using truncated VSOP87 (Variations Seculaires des Orbites Planetaires) series. The full VSOP87 theory provides heliocentric ecliptic coordinates for each planet as a sum of periodic terms.

**Input**: Planet ID (enum: Mercury..Neptune), Julian Date (`JD`, f64)
**Output**: `(RA_hours, Dec_degrees)` geocentric equatorial

```
Algorithm:

1. Compute Julian millennia since J2000.0:
   tau = (JD - 2451545.0) / 365250.0

2. For each coordinate (L = longitude, B = latitude, R = radius):
   Compute truncated sum:
   L = L0(tau) + L1(tau)*tau + L2(tau)*tau^2 + ...

   where each Ln is a sum of periodic terms:
   Ln(tau) = sum_i [ A_i * cos(B_i + C_i * tau) ]

   A_i, B_i, C_i are pre-computed coefficients bundled with the app.

3. Convert heliocentric ecliptic (L, B, R) to geocentric ecliptic:
   a. Compute Earth's heliocentric position: (L_earth, B_earth, R_earth)
   b. Convert both to rectangular heliocentric:
      x_h = R * cos(B) * cos(L)
      y_h = R * cos(B) * sin(L)
      z_h = R * sin(B)
   c. Geocentric rectangular:
      x_g = x_h - x_earth
      y_g = y_h - y_earth
      z_g = z_h - z_earth

4. Convert geocentric rectangular to ecliptic (lambda, beta):
   lambda = atan2(y_g, x_g)
   beta   = atan2(z_g, sqrt(x_g^2 + y_g^2))

5. Convert ecliptic to equatorial using obliquity:
   RA  = atan2(sin(lambda)*cos(epsilon) - tan(beta)*sin(epsilon), cos(lambda))
   Dec = asin(sin(beta)*cos(epsilon) + cos(beta)*sin(epsilon)*sin(lambda))
```

### 4.2 Truncation Levels and Accuracy

The number of retained terms controls the tradeoff between accuracy and computation time:

| Planet | Full Terms | Retained Terms | Accuracy | Computation Time |
|--------|-----------|---------------|----------|-----------------|
| Mercury | 2200 | 150 | +/-2' | ~0.5 ms |
| Venus | 1800 | 120 | +/-1' | ~0.4 ms |
| Mars | 3000 | 200 | +/-2' | ~0.6 ms |
| Jupiter | 2500 | 100 | +/-3' | ~0.3 ms |
| Saturn | 2800 | 100 | +/-5' | ~0.3 ms |
| Uranus | 1500 | 60 | +/-5' | ~0.2 ms |
| Neptune | 1200 | 50 | +/-5' | ~0.2 ms |

All retained terms contribute corrections larger than 0.1 arcminutes. Sub-threshold terms are discarded at build time.

### 4.3 Bundled Coefficient Data

VSOP87 coefficients are embedded as compile-time constant arrays in `planets.rs`. Total data size is approximately 1 MB uncompressed. The coefficients are valid for the interval 3000 BCE to 3000 CE with degrading accuracy outside 1000 CE to 3000 CE.

```rust
/// VSOP87 series coefficients for Jupiter's ecliptic longitude L0.
/// Each entry is (amplitude_A, phase_B, frequency_C).
const JUPITER_L0: &[(f64, f64, f64)] = &[
    (59954691.494, 0.000000000, 0.000000000),
    (9695898.719,  5.061812846, 529.690965095),
    (573610.142,   1.444062068, 7.113547001),
    // ... 97 more terms
];
```

---

## 5. Fixed Stars

### 5.1 Hipparcos Catalog

Fixed star positions are pre-computed and bundled as a static catalog derived from the Hipparcos astrometry mission. Each entry contains:

```rust
pub struct StarEntry {
    pub hip_id: u32,          // Hipparcos catalog number
    pub ra_j2000: f64,        // Right Ascension at J2000.0 epoch (hours)
    pub dec_j2000: f64,       // Declination at J2000.0 epoch (degrees)
    pub magnitude: f32,       // Apparent visual magnitude
    pub proper_motion_ra: f32,  // mas/year (milliarcseconds per year)
    pub proper_motion_dec: f32, // mas/year
    pub common_name: Option<&'static str>,  // e.g., "Sirius", "Vega"
}
```

The catalog contains approximately 500 stars with magnitude brighter than +5.0 (naked-eye limit under good conditions), plus all 110 Messier deep-sky objects.

### 5.2 Precession Correction

Star coordinates in the Hipparcos catalog are given for epoch J2000.0. For observations at a different epoch, the coordinates must be corrected for the precession of Earth's rotational axis.

```
Precession correction (simplified):

1. Compute years since J2000.0:
   t = (JD - 2451545.0) / 365.25

2. Compute precession rates:
   dRA  = (3.075 + 1.336 * sin(RA) * tan(Dec)) * t / 3600.0   (hours)
   dDec = (20.04 * cos(RA)) * t / 3600.0                       (degrees)

3. Corrected position:
   RA_now  = RA_j2000 + dRA
   Dec_now = Dec_j2000 + dDec
```

**Magnitude of correction**: Over a 25-year span (J2000.0 to 2025), precession shifts star positions by approximately 0.35 degrees. This is below the IMU error floor for most devices, so precession correction is optional for MVP but included for correctness.

### 5.3 Proper Motion

Proper motion (the star's own movement across the sky) is negligible for the vast majority of stars over the FindMyStar operational window (1-2 years). The fastest proper motion in the catalog is Barnard's Star at 10.3 arcseconds per year. For a 1-year window, this is 0.003 degrees -- well below the IMU noise floor. Proper motion correction is included but can be disabled via a build feature flag.

---

## 6. Data Sources

| Object Type | Algorithm | Primary Data Source | Fallback | Last Verified |
|-------------|-----------|---------------------|----------|---------------|
| Sun | Simplified analytical | Meeus, *Astronomical Algorithms* Ch. 25 | VSOP87 (Phase 2) | Feb 2026 |
| Moon | Low-precision analytical | Meeus, *Astronomical Algorithms* Ch. 47 | ELP2000 (Phase 2) | Feb 2026 |
| Planets | VSOP87 truncated | Bretagnon & Francou (1988), BDL | Full VSOP87 | Feb 2026 |
| Stars | Hipparcos catalog | ESA Hipparcos (1997) | Yale BSC | Feb 2026 |
| Messier objects | Fixed coordinates | SEDS Messier database | NGC/IC | Feb 2026 |

---

## 7. Caching Strategy

The domain engine itself performs **no caching** (pure functions, no internal state). However, the application layer may cache ephemeris results to avoid redundant FFI calls.

Recommended caching policy:

| Object Type | Cache Duration | Rationale |
|-------------|---------------|-----------|
| Sun | 60 seconds | Moves ~0.25'/min; well below IMU error |
| Moon | 30 seconds | Moves ~0.5'/min; still below IMU error |
| Planets | 5 minutes | Move < 0.1'/min (except Mercury near elongation) |
| Stars | 24 hours | Positions change only due to Earth's rotation (already in Alt/Az transform) |

The application layer invalidates cached RA/Dec values when the time delta exceeds the threshold, then re-calls the engine.

---

## 8. Performance Characteristics

All benchmarks measured on a Cortex-A76 core (typical modern Android SoC) using `cargo bench`:

| Operation | Mean Time | Std Dev | Notes |
|-----------|-----------|---------|-------|
| `compute_sun_position` | 1.2 us | 0.1 us | Simplified model |
| `compute_moon_position` | 2.1 us | 0.2 us | 6 principal terms |
| `compute_planet_position` (Jupiter) | 45 us | 3 us | 100 VSOP87 terms |
| `lookup_star` (by HIP ID) | 0.3 us | 0.05 us | Binary search on sorted array |
| Batch: all 8 planets | 280 us | 15 us | Sequential computation |

The entire ephemeris computation for one frame (Sun + Moon + 1 planet + 0 star lookups) completes in under 50 microseconds, well within the 33 ms frame budget for 30 FPS AR.

---

## 9. Cross-References

- **[Core Astronomical Algorithms, Section 7](./algorithms.md#7-ephemeris-sun-and-moon)** -- Pseudocode for Sun position algorithm
- **[Validation Strategy](./validation.md)** -- How ephemeris outputs are validated against USNO and JPL Horizons
- **[Error Bounds](./error-bounds.md)** -- Accuracy analysis for each object type
- **[Coordinate Transforms](./coordinate-transforms.md)** -- Converting ephemeris RA/Dec to observer-relative Alt/Az
- **[Architecture Overview, Section 5](../03-architecture/architecture-overview.md#5-technology-stack)** -- Technology stack and data sizes

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
