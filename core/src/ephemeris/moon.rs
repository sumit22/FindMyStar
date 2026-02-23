use crate::coordinates::time::jd_to_centuries;
use crate::math::utils::{deg_to_rad, normalize_degrees, normalize_hours, rad_to_deg, safe_asin};

/// Computes the Moon's geocentric equatorial position (RA/Dec) for a given Julian Date.
///
/// Uses a 6-term principal lunar model. Accuracy: +/-1 degree.
///
/// # Returns
/// `(ra_hours, dec_degrees)` where RA is 0-24 and Dec is -90 to +90.
pub fn compute_moon_position(jd: f64) -> (f64, f64) {
    let t = jd_to_centuries(jd);

    // Fundamental arguments (degrees)
    let l_prime = normalize_degrees(218.3165 + 481267.8813 * t); // Moon's mean longitude
    let d = normalize_degrees(297.8502 + 445267.1115 * t); // Mean elongation
    let m = normalize_degrees(357.5291 + 35999.0503 * t); // Sun's mean anomaly
    let m_prime = normalize_degrees(134.9634 + 477198.8676 * t); // Moon's mean anomaly
    let f = normalize_degrees(93.2720 + 483202.0175 * t); // Argument of latitude

    let d_rad = deg_to_rad(d);
    let m_rad = deg_to_rad(m);
    let m_prime_rad = deg_to_rad(m_prime);
    let f_rad = deg_to_rad(f);

    // Ecliptic longitude correction (degrees)
    let dl = 6.289 * m_prime_rad.sin() - 1.274 * (2.0 * d_rad - m_prime_rad).sin()
        + 0.658 * (2.0 * d_rad).sin()
        + 0.214 * (2.0 * m_prime_rad).sin()
        - 0.186 * m_rad.sin()
        - 0.114 * (2.0 * f_rad).sin();

    // Ecliptic latitude (degrees)
    let b = 5.128 * f_rad.sin()
        + 0.281 * (m_prime_rad + f_rad).sin()
        + 0.278 * (m_prime_rad - f_rad).sin();

    // Moon's ecliptic longitude (radians)
    let lambda = deg_to_rad(l_prime + dl);
    let b_rad = deg_to_rad(b);

    // Obliquity of the ecliptic
    let epsilon = deg_to_rad(23.439291 - 0.013004 * t);

    // Ecliptic to equatorial
    let ra_rad = (lambda.sin() * epsilon.cos() - b_rad.tan() * epsilon.sin()).atan2(lambda.cos());
    let dec_rad =
        safe_asin(b_rad.sin() * epsilon.cos() + b_rad.cos() * epsilon.sin() * lambda.sin());

    let ra_hours = normalize_hours(rad_to_deg(ra_rad) / 15.0);
    let dec_degrees = rad_to_deg(dec_rad);

    (ra_hours, dec_degrees)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coordinates::time::JD_J2000;

    #[test]
    fn test_moon_ra_range() {
        // Moon RA should always be in [0, 24)
        for day in 0..30 {
            let jd = JD_J2000 + day as f64;
            let (ra, _) = compute_moon_position(jd);
            assert!(
                ra >= 0.0 && ra < 24.0,
                "Moon RA out of range: {ra} at day {day}"
            );
        }
    }

    #[test]
    fn test_moon_dec_range() {
        // Moon Dec should always be within +/-29 degrees (inclination ~5° + obliquity ~23.4°)
        for day in 0..30 {
            let jd = JD_J2000 + day as f64;
            let (_, dec) = compute_moon_position(jd);
            assert!(
                dec.abs() < 29.0,
                "Moon Dec out of range: {dec} at day {day}"
            );
        }
    }

    #[test]
    fn test_moon_moves_rapidly() {
        // Moon moves ~13 degrees/day. Check that positions 1 day apart differ.
        let (ra1, _) = compute_moon_position(JD_J2000);
        let (ra2, _) = compute_moon_position(JD_J2000 + 1.0);
        let diff = ((ra2 - ra1 + 12.0) % 24.0 - 12.0).abs();
        // ~13 deg/day = ~0.87 hours/day
        assert!(
            diff > 0.3,
            "Moon should move significantly in 1 day, RA diff={diff}h"
        );
    }

    #[test]
    fn test_moon_at_j2000() {
        let (ra, dec) = compute_moon_position(JD_J2000);
        // Just verify reasonable values
        assert!(ra >= 0.0 && ra < 24.0);
        assert!(dec.abs() < 29.0);
    }

    #[test]
    fn test_moon_full_orbit_coverage() {
        // Over ~28 days the moon should cover a large RA range
        let mut min_ra = 24.0_f64;
        let mut max_ra = 0.0_f64;
        for day in 0..28 {
            let (ra, _) = compute_moon_position(JD_J2000 + day as f64);
            if ra < min_ra {
                min_ra = ra;
            }
            if ra > max_ra {
                max_ra = ra;
            }
        }
        // Moon should span a significant RA range over a full orbit
        let span = if max_ra > min_ra {
            max_ra - min_ra
        } else {
            (24.0 - min_ra) + max_ra
        };
        assert!(
            span > 10.0,
            "Moon should cover large RA range in 28 days, span={span}"
        );
    }
}
