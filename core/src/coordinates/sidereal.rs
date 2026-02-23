use crate::math::utils::normalize_hours;

/// Computes Greenwich Mean Sidereal Time (GMST) in hours for a given Julian Date.
///
/// Uses the IAU polynomial approximation. Result is normalized to [0, 24) hours.
pub fn compute_gmst(jd: f64) -> f64 {
    // Days since J2000.0
    let d = jd - 2_451_545.0;

    // Julian centuries since J2000.0
    let t = d / 36_525.0;

    // GMST in degrees (IAU formula)
    let gmst_deg = 280.460_618_37 + 360.985_647_366_29 * d + 0.000_387_933 * t * t
        - t * t * t / 38_710_000.0;

    // Convert to hours and normalize
    normalize_hours(gmst_deg / 15.0)
}

/// Computes Local Sidereal Time (LST) in hours for a given Julian Date and longitude.
///
/// LST = GMST + longitude/15, normalized to [0, 24).
pub fn compute_lst(jd: f64, longitude_deg: f64) -> f64 {
    let gmst = compute_gmst(jd);
    normalize_hours(gmst + longitude_deg / 15.0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coordinates::time::JD_J2000;

    #[test]
    fn test_gmst_at_j2000() {
        let gmst = compute_gmst(JD_J2000);
        // GMST at J2000.0 should be approximately 18.697 hours
        assert!(
            (gmst - 18.697).abs() < 0.01,
            "GMST at J2000.0 = {gmst}, expected ~18.697"
        );
    }

    #[test]
    fn test_gmst_range() {
        // Test that GMST is always in [0, 24)
        let test_jds = [2_451_545.0, 2_460_000.0, 2_440_587.5, 2_470_000.0];
        for jd in test_jds {
            let gmst = compute_gmst(jd);
            assert!(
                gmst >= 0.0 && gmst < 24.0,
                "GMST {gmst} out of range for JD {jd}"
            );
        }
    }

    #[test]
    fn test_lst_at_greenwich() {
        // At Greenwich (lon=0), LST should equal GMST
        let jd = JD_J2000;
        let gmst = compute_gmst(jd);
        let lst = compute_lst(jd, 0.0);
        assert!((lst - gmst).abs() < 1e-10);
    }

    #[test]
    fn test_lst_range() {
        // LST should always be in [0, 24)
        let test_cases = [
            (JD_J2000, 0.0),
            (JD_J2000, 180.0),
            (JD_J2000, -180.0),
            (JD_J2000, -77.0),  // Washington DC
            (JD_J2000, 139.69), // Tokyo
        ];
        for (jd, lon) in test_cases {
            let lst = compute_lst(jd, lon);
            assert!(
                lst >= 0.0 && lst < 24.0,
                "LST {lst} out of range for lon={lon}"
            );
        }
    }

    #[test]
    fn test_lst_east_is_ahead() {
        let jd = JD_J2000;
        let lst_greenwich = compute_lst(jd, 0.0);
        let lst_east = compute_lst(jd, 15.0); // 15° East = +1 hour
        let diff = (lst_east - lst_greenwich + 24.0) % 24.0;
        assert!(
            (diff - 1.0).abs() < 0.001,
            "15° East should be 1 hour ahead, got diff={diff}"
        );
    }
}
