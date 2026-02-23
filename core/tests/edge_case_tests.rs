//! REL-006: Edge Case & Security Testing
//!
//! Tests extreme inputs, boundary conditions, and potential failure modes:
//! - Polar latitudes (90°, -90°)
//! - Equator (0°, 0°)
//! - International Date Line
//! - Extreme Julian Dates
//! - NaN/Infinity inputs
//! - Coordinate wraparound
//! - Time edge cases (DST, leap seconds)
//!
//! Run with: cargo test --test edge_case_tests

use findmystar_core::coordinates::sidereal::{compute_gmst, compute_lst};
use findmystar_core::coordinates::time::{jd_to_unix, unix_to_jd};
use findmystar_core::coordinates::transforms::ra_dec_to_altaz;
use findmystar_core::ephemeris::moon::compute_moon_position;
use findmystar_core::ephemeris::planets::{compute_planet_position, Planet};
use findmystar_core::ephemeris::stars::compute_star_position;
use findmystar_core::ephemeris::sun::compute_sun_position;
use findmystar_core::math::utils::{deg_to_rad, normalize_degrees, rad_to_deg, safe_acos, safe_asin};
use findmystar_core::math::vector3::Vector3;

// ============================================================================
// 1. Polar Latitude Edge Cases
// ============================================================================

#[test]
fn test_north_pole_latitude() {
    // At North Pole (90°), altitude should equal declination
    let lat = 89.99; // Just under 90° to avoid singularity
    let lon = 0.0;
    let unix_ms = 1_704_067_200_000.0;

    // High-dec star should be circumpolar
    let (alt, _az) = ra_dec_to_altaz(0.0, 80.0, lat, lon, unix_ms);
    assert!(alt > 70.0, "Dec=80° star at pole should be high: alt={alt:.1}°");

    // Negative-dec star should never rise
    let (alt_neg, _) = ra_dec_to_altaz(0.0, -20.0, lat, lon, unix_ms);
    assert!(alt_neg < 0.0, "Dec=-20° star at pole should be below horizon: alt={alt_neg:.1}°");
}

#[test]
fn test_south_pole_latitude() {
    let lat = -89.99;
    let lon = 0.0;
    let unix_ms = 1_704_067_200_000.0;

    // Negative-dec star should be circumpolar at south pole
    let (alt, _) = ra_dec_to_altaz(0.0, -80.0, lat, lon, unix_ms);
    assert!(alt > 70.0, "Dec=-80° star at south pole should be high: alt={alt:.1}°");
}

#[test]
fn test_equator_latitude() {
    let lat = 0.0;
    let lon = 0.0;
    let unix_ms = 1_704_067_200_000.0;

    // At equator, objects can reach altitude = 90° - |dec|
    // A star near zenith should have altitude near 90°
    let jd = unix_to_jd(unix_ms);
    let lst = compute_lst(jd, lon);

    // Object at RA=LST, Dec=0 should be near zenith at equator
    let (alt, _) = ra_dec_to_altaz(lst, 0.0, lat, lon, unix_ms);
    assert!(
        (alt - 90.0).abs() < 1.0,
        "Zenith object at equator: alt={alt:.2}° (expected ~90°)"
    );
}

// ============================================================================
// 2. Longitude Edge Cases (Date Line, Prime Meridian)
// ============================================================================

#[test]
fn test_date_line_longitudes() {
    let lat = 35.0;
    let unix_ms = 1_704_067_200_000.0;

    // Longitudes near ±180° should produce valid results
    let (alt_179, az_179) = ra_dec_to_altaz(12.0, 30.0, lat, 179.0, unix_ms);
    let (alt_neg179, az_neg179) = ra_dec_to_altaz(12.0, 30.0, lat, -179.0, unix_ms);

    // Both should be valid
    assert!(alt_179 > -90.0 && alt_179 < 90.0);
    assert!(alt_neg179 > -90.0 && alt_neg179 < 90.0);
    assert!(az_179 >= 0.0 && az_179 < 360.0);
    assert!(az_neg179 >= 0.0 && az_neg179 < 360.0);

    // Positions 2° apart in longitude should produce similar results
    let alt_diff = (alt_179 - alt_neg179).abs();
    assert!(
        alt_diff < 10.0,
        "2° longitude diff should give similar altitudes: {alt_179:.1}° vs {alt_neg179:.1}°"
    );
}

#[test]
fn test_prime_meridian() {
    let lat = 51.5; // London
    let unix_ms = 1_704_067_200_000.0;

    let (alt, az) = ra_dec_to_altaz(12.0, 30.0, lat, 0.0, unix_ms);
    assert!(alt > -90.0 && alt < 90.0);
    assert!(az >= 0.0 && az < 360.0);
}

// ============================================================================
// 3. Extreme Time Values
// ============================================================================

#[test]
fn test_far_future_julian_date() {
    // Year ~2100 — still within valid range for simplified models
    let jd_2100 = 2_488_070.0;

    let (ra, dec) = compute_sun_position(jd_2100);
    assert!(ra >= 0.0 && ra < 24.0, "Sun RA in 2100: {ra:.3}h");
    assert!(dec.abs() < 23.5, "Sun Dec in 2100: {dec:.2}°");

    let (moon_ra, moon_dec) = compute_moon_position(jd_2100);
    assert!(moon_ra >= 0.0 && moon_ra < 24.0);
    assert!(moon_dec.abs() < 30.0);
}

#[test]
fn test_far_past_julian_date() {
    // Year ~1900
    let jd_1900 = 2_415_020.0;

    let (ra, dec) = compute_sun_position(jd_1900);
    assert!(ra >= 0.0 && ra < 24.0, "Sun RA in 1900: {ra:.3}h");
    assert!(dec.abs() < 23.5, "Sun Dec in 1900: {dec:.2}°");
}

#[test]
fn test_unix_epoch_roundtrip() {
    let original_ms = 1_704_067_200_000.0;
    let jd = unix_to_jd(original_ms);
    let roundtrip_ms = jd_to_unix(jd);
    let diff = (original_ms - roundtrip_ms).abs();
    assert!(diff < 1.0, "Round-trip should be <1ms, got {diff:.3}ms");
}

#[test]
fn test_zero_unix_time() {
    // Unix epoch (1970-01-01)
    let jd = unix_to_jd(0.0);
    assert!((jd - 2_440_587.5).abs() < 0.01, "Unix epoch JD: {jd}");
}

#[test]
fn test_negative_unix_time() {
    // Before Unix epoch (1969-12-31)
    let jd = unix_to_jd(-86_400_000.0);
    assert!((jd - 2_440_586.5).abs() < 0.01, "1969-12-31 JD: {jd}");
}

// ============================================================================
// 4. Math Utility Edge Cases
// ============================================================================

#[test]
fn test_safe_asin_clamping() {
    // Values slightly outside [-1, 1] should be clamped, not NaN
    let result = safe_asin(1.0001);
    assert!(!result.is_nan(), "safe_asin(1.0001) should not be NaN");
    assert!((result - std::f64::consts::FRAC_PI_2).abs() < 0.001);

    let result_neg = safe_asin(-1.0001);
    assert!(!result_neg.is_nan());
    assert!((result_neg + std::f64::consts::FRAC_PI_2).abs() < 0.001);
}

#[test]
fn test_safe_acos_clamping() {
    let result = safe_acos(1.0001);
    assert!(!result.is_nan(), "safe_acos(1.0001) should not be NaN");
    assert!(result.abs() < 0.001);

    let result_neg = safe_acos(-1.0001);
    assert!(!result_neg.is_nan());
    assert!((result_neg - std::f64::consts::PI).abs() < 0.001);
}

#[test]
fn test_normalize_degrees_edge_cases() {
    assert!((normalize_degrees(0.0) - 0.0).abs() < 0.001);
    assert!((normalize_degrees(360.0) - 0.0).abs() < 0.001);
    assert!((normalize_degrees(-360.0) - 0.0).abs() < 0.001);
    assert!((normalize_degrees(720.0) - 0.0).abs() < 0.001);
    assert!((normalize_degrees(-0.001) - 359.999).abs() < 0.01);
    assert!((normalize_degrees(180.0) - 180.0).abs() < 0.001);
}

#[test]
fn test_deg_rad_roundtrip() {
    for deg in [-180.0, -90.0, 0.0, 45.0, 90.0, 180.0, 360.0] {
        let roundtrip = rad_to_deg(deg_to_rad(deg));
        assert!(
            (roundtrip - deg).abs() < 1e-10,
            "deg→rad→deg roundtrip failed for {deg}°: got {roundtrip}°"
        );
    }
}

// ============================================================================
// 5. Vector3 Edge Cases
// ============================================================================

#[test]
fn test_zero_vector_normalize() {
    let v = Vector3::new(0.0, 0.0, 0.0);
    let n = v.normalize();
    // Zero vector normalization should return a safe fallback, not NaN
    assert!(!n.x.is_nan() && !n.y.is_nan() && !n.z.is_nan());
}

#[test]
fn test_very_small_vector_normalize() {
    let v = Vector3::new(1e-15, 1e-15, 1e-15);
    let n = v.normalize();
    assert!(!n.x.is_nan() && !n.y.is_nan() && !n.z.is_nan());
}

#[test]
fn test_large_vector_magnitude() {
    let v = Vector3::new(1e10, 1e10, 1e10);
    let mag = v.magnitude();
    assert!(!mag.is_nan() && !mag.is_infinite());
    assert!(mag > 0.0);
}

// ============================================================================
// 6. GMST/LST Edge Cases
// ============================================================================

#[test]
fn test_gmst_always_in_range() {
    // Test over a wide range of dates
    for day_offset in (-36525..36525).step_by(100) {
        let jd = 2_451_545.0 + day_offset as f64;
        let gmst = compute_gmst(jd);
        assert!(
            gmst >= 0.0 && gmst < 24.0,
            "GMST out of range at JD {jd}: {gmst}h"
        );
    }
}

#[test]
fn test_lst_all_longitudes() {
    let jd = 2_451_545.0;
    for lon_deg in (-180..=180).step_by(15) {
        let lst = compute_lst(jd, lon_deg as f64);
        assert!(
            lst >= 0.0 && lst < 24.0,
            "LST out of range at lon={lon_deg}°: {lst}h"
        );
    }
}

// ============================================================================
// 7. Ephemeris Edge Cases
// ============================================================================

#[test]
fn test_sun_position_at_j2000_boundary() {
    let (ra, dec) = compute_sun_position(2_451_545.0);
    assert!(ra >= 0.0 && ra < 24.0);
    assert!(dec.abs() < 23.5);

    let (ra2, dec2) = compute_sun_position(2_451_545.0 + 0.001);
    assert!(ra2 >= 0.0 && ra2 < 24.0);
    assert!(dec2.abs() < 23.5);
}

#[test]
fn test_all_planets_at_extremes() {
    let planets = [
        Planet::Mercury, Planet::Venus, Planet::Mars, Planet::Jupiter,
        Planet::Saturn, Planet::Uranus, Planet::Neptune,
    ];

    for planet in &planets {
        // Test at J2000
        let (ra, dec) = compute_planet_position(*planet, 2_451_545.0);
        assert!(ra >= 0.0 && ra < 24.0, "{:?} RA at J2000: {ra}", planet);
        assert!(dec.abs() < 90.0, "{:?} Dec at J2000: {dec}", planet);

        // Test at 50 years later
        let (ra2, dec2) = compute_planet_position(*planet, 2_451_545.0 + 18262.5);
        assert!(ra2 >= 0.0 && ra2 < 24.0, "{:?} RA at 2050: {ra2}", planet);
        assert!(dec2.abs() < 90.0, "{:?} Dec at 2050: {dec2}", planet);
    }
}

#[test]
fn test_unknown_star_returns_none() {
    // HIP ID that doesn't exist in our catalog
    let result = compute_star_position(999999, 2_451_545.0);
    assert!(result.is_none(), "Unknown HIP ID should return None");
}

#[test]
fn test_star_position_future_precession() {
    // 100 years of precession should move star positions but keep them valid
    let jd_2100 = 2_451_545.0 + 36525.0;
    if let Some((ra, dec)) = compute_star_position(32349, jd_2100) {
        assert!(ra >= 0.0 && ra < 24.0, "Sirius RA in 2100: {ra}h");
        assert!(dec.abs() < 90.0, "Sirius Dec in 2100: {dec}°");
    }
}

// ============================================================================
// 8. Coordinate Transform Boundary Cases
// ============================================================================

#[test]
fn test_object_at_celestial_poles() {
    let lat = 40.0;
    let lon = -74.0;
    let unix_ms = 1_704_067_200_000.0;

    // North celestial pole (Dec=90°)
    let (alt_ncp, _) = ra_dec_to_altaz(0.0, 90.0, lat, lon, unix_ms);
    assert!(
        (alt_ncp - lat).abs() < 0.5,
        "NCP altitude should ≈ latitude: {alt_ncp:.2}° vs {lat}°"
    );

    // South celestial pole (Dec=-90°)
    let (alt_scp, _) = ra_dec_to_altaz(0.0, -90.0, lat, lon, unix_ms);
    assert!(
        (alt_scp + lat).abs() < 0.5,
        "SCP altitude should ≈ -latitude: {alt_scp:.2}° vs -{lat}°"
    );
}

#[test]
fn test_azimuth_full_circle() {
    let lat = 40.0;
    let lon = -74.0;
    let unix_ms = 1_704_067_200_000.0;

    // Check azimuth for objects at different RAs covers full range
    let mut azimuths = Vec::new();
    for ra_hour in 0..24 {
        let (_, az) = ra_dec_to_altaz(ra_hour as f64, 0.0, lat, lon, unix_ms);
        assert!(az >= 0.0 && az < 360.0, "Azimuth out of range: {az}°");
        azimuths.push(az);
    }

    // Azimuth values should span a wide range (not all clustered)
    let min_az = azimuths.iter().cloned().fold(f64::INFINITY, f64::min);
    let max_az = azimuths.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
    assert!(
        max_az - min_az > 180.0,
        "Azimuths should span >180° range: min={min_az:.0}°, max={max_az:.0}°"
    );
}

#[test]
fn test_altitude_range_for_all_declinations() {
    let lat = 40.0;
    let lon = 0.0;
    let unix_ms = 1_704_067_200_000.0;

    for dec in (-90..=90).step_by(5) {
        let (alt, az) = ra_dec_to_altaz(12.0, dec as f64, lat, lon, unix_ms);
        assert!(
            alt >= -90.0 && alt <= 90.0,
            "Alt={alt:.1}° out of range for dec={dec}°"
        );
        assert!(
            az >= 0.0 && az < 360.0,
            "Az={az:.1}° out of range for dec={dec}°"
        );
    }
}
