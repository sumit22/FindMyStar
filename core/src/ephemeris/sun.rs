use crate::coordinates::time::jd_to_centuries;
use crate::math::utils::{deg_to_rad, normalize_degrees, normalize_hours, rad_to_deg, safe_asin};

/// Computes the Sun's geocentric equatorial position (RA/Dec) for a given Julian Date.
///
/// Uses the simplified Meeus model with first-order equation of center.
/// Accuracy: +/-5 arcminutes compared to full VSOP87.
///
/// # Returns
/// `(ra_hours, dec_degrees)` where RA is 0-24 and Dec is -90 to +90.
pub fn compute_sun_position(jd: f64) -> (f64, f64) {
    let t = jd_to_centuries(jd);

    // Geometric mean longitude of the Sun (degrees)
    let l0 = normalize_degrees(280.46646 + 36000.76983 * t + 0.0003032 * t * t);

    // Mean anomaly (degrees)
    let m = normalize_degrees(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
    let m_rad = deg_to_rad(m);

    // Equation of center (degrees)
    let c = (1.914602 - 0.004817 * t - 0.000014 * t * t) * m_rad.sin()
        + (0.019993 - 0.000101 * t) * (2.0 * m_rad).sin()
        + 0.000289 * (3.0 * m_rad).sin();

    // Sun's ecliptic longitude (radians)
    let lambda = deg_to_rad(l0 + c);

    // Obliquity of the ecliptic (radians)
    let epsilon = deg_to_rad(23.439291 - 0.013004 * t);

    // Ecliptic to equatorial conversion
    let ra_rad = (epsilon.cos() * lambda.sin()).atan2(lambda.cos());
    let dec_rad = safe_asin(epsilon.sin() * lambda.sin());

    let ra_hours = normalize_hours(rad_to_deg(ra_rad) / 15.0);
    let dec_degrees = rad_to_deg(dec_rad);

    (ra_hours, dec_degrees)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coordinates::time::JD_J2000;

    #[test]
    fn test_sun_at_vernal_equinox() {
        // Around March 20, 2024: JD ~2460388.5
        // Sun Dec should be near 0 degrees
        let jd = 2_460_388.5;
        let (_, dec) = compute_sun_position(jd);
        assert!(
            dec.abs() < 2.0,
            "Sun Dec near vernal equinox should be near 0, got {dec}"
        );
    }

    #[test]
    fn test_sun_at_summer_solstice() {
        // Around June 21, 2024: JD ~2460481.5
        // Sun Dec should be near +23.4 degrees
        let jd = 2_460_481.5;
        let (_, dec) = compute_sun_position(jd);
        assert!(
            (dec - 23.4).abs() < 1.0,
            "Sun Dec near summer solstice should be ~+23.4, got {dec}"
        );
    }

    #[test]
    fn test_sun_at_winter_solstice() {
        // Around Dec 21, 2024: JD ~2460665.5
        // Sun Dec should be near -23.4 degrees
        let jd = 2_460_665.5;
        let (_, dec) = compute_sun_position(jd);
        assert!(
            (dec - (-23.4)).abs() < 1.0,
            "Sun Dec near winter solstice should be ~-23.4, got {dec}"
        );
    }

    #[test]
    fn test_sun_ra_range() {
        for day_offset in 0..365 {
            let jd = JD_J2000 + day_offset as f64;
            let (ra, _) = compute_sun_position(jd);
            assert!(
                ra >= 0.0 && ra < 24.0,
                "Sun RA out of range: {ra} at offset {day_offset}"
            );
        }
    }

    #[test]
    fn test_sun_dec_range() {
        for day_offset in 0..365 {
            let jd = JD_J2000 + day_offset as f64;
            let (_, dec) = compute_sun_position(jd);
            assert!(
                dec.abs() < 23.5,
                "Sun Dec out of range: {dec} at offset {day_offset}"
            );
        }
    }

    #[test]
    fn test_sun_at_j2000() {
        let (ra, dec) = compute_sun_position(JD_J2000);
        assert!(
            ra > 18.0 && ra < 19.5,
            "Sun RA at J2000 expected ~18.75, got {ra}"
        );
        assert!(
            dec < -20.0 && dec > -24.0,
            "Sun Dec at J2000 expected ~-23, got {dec}"
        );
    }
}
