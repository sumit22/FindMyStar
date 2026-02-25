/// A single star entry from the embedded Hipparcos catalog.
#[derive(Clone, Debug)]
pub struct StarEntry {
    pub hip_id: u32,
    pub ra_j2000: f64,   // Right Ascension at J2000.0 (hours)
    pub dec_j2000: f64,  // Declination at J2000.0 (degrees)
    pub magnitude: f32,  // Apparent visual magnitude
    pub pm_ra_mas: f64,  // Proper motion in RA: μα*cos(δ) (mas/yr, Hipparcos convention)
    pub pm_dec_mas: f64, // Proper motion in Dec: μδ (mas/yr)
    pub common_name: Option<&'static str>,
}

/// Embedded catalog of bright stars (magnitude < 5.0), sorted by HIP ID for binary search.
/// This is a representative subset; the full ~500 star catalog will be in the SQLite database.
/// The engine uses this for fast lookup when computing positions with precession + proper motion.
/// Proper motion values from Hipparcos (van Leeuwen 2007).
static BRIGHT_STARS: &[StarEntry] = &[
    StarEntry {
        hip_id: 677,
        ra_j2000: 0.1396,
        dec_j2000: 29.0905,
        magnitude: 2.06,
        pm_ra_mas: 137.46,
        pm_dec_mas: -163.44,
        common_name: Some("Alpheratz"),
    },
    StarEntry {
        hip_id: 1067,
        ra_j2000: 0.2209,
        dec_j2000: 15.1836,
        magnitude: 2.83,
        pm_ra_mas: 0.49,
        pm_dec_mas: -10.73,
        common_name: None,
    },
    StarEntry {
        hip_id: 2081,
        ra_j2000: 0.4381,
        dec_j2000: -77.2544,
        magnitude: 2.80,
        pm_ra_mas: 233.05,
        pm_dec_mas: -356.30,
        common_name: None,
    },
    StarEntry {
        hip_id: 3179,
        ra_j2000: 0.6752,
        dec_j2000: 56.5373,
        magnitude: 2.23,
        pm_ra_mas: 49.13,
        pm_dec_mas: -31.60,
        common_name: Some("Schedar"),
    },
    StarEntry {
        hip_id: 3419,
        ra_j2000: 0.7265,
        dec_j2000: -17.9867,
        magnitude: 2.04,
        pm_ra_mas: 232.55,
        pm_dec_mas: 32.00,
        common_name: Some("Diphda"),
    },
    StarEntry {
        hip_id: 5447,
        ra_j2000: 1.1620,
        dec_j2000: 35.6206,
        magnitude: 2.07,
        pm_ra_mas: 175.90,
        pm_dec_mas: -112.20,
        common_name: Some("Mirach"),
    },
    StarEntry {
        hip_id: 7588,
        ra_j2000: 1.6285,
        dec_j2000: -10.1822,
        magnitude: 2.53,
        pm_ra_mas: 87.00,
        pm_dec_mas: -38.24,
        common_name: None,
    },
    StarEntry {
        hip_id: 9884,
        ra_j2000: 2.1195,
        dec_j2000: 23.4624,
        magnitude: 2.00,
        pm_ra_mas: 188.55,
        pm_dec_mas: -148.08,
        common_name: Some("Hamal"),
    },
    StarEntry {
        hip_id: 11767,
        ra_j2000: 2.5301,
        dec_j2000: 89.2641,
        magnitude: 2.02,
        pm_ra_mas: 44.48,
        pm_dec_mas: -11.85,
        common_name: Some("Polaris"),
    },
    StarEntry {
        hip_id: 13847,
        ra_j2000: 2.9710,
        dec_j2000: 42.3297,
        magnitude: 2.09,
        pm_ra_mas: -52.89,
        pm_dec_mas: 21.98,
        common_name: Some("Mirfak"),
    },
    StarEntry {
        hip_id: 14576,
        ra_j2000: 3.1362,
        dec_j2000: 40.9556,
        magnitude: 1.79,
        pm_ra_mas: 2.99,
        pm_dec_mas: -1.66,
        common_name: Some("Algol"),
    },
    StarEntry {
        hip_id: 15863,
        ra_j2000: 3.4054,
        dec_j2000: 49.8613,
        magnitude: 1.80,
        pm_ra_mas: 23.75,
        pm_dec_mas: -26.23,
        common_name: None,
    },
    StarEntry {
        hip_id: 21421,
        ra_j2000: 4.5987,
        dec_j2000: 16.5093,
        magnitude: 0.85,
        pm_ra_mas: 63.45,
        pm_dec_mas: -188.94,
        common_name: Some("Aldebaran"),
    },
    StarEntry {
        hip_id: 24436,
        ra_j2000: 5.2423,
        dec_j2000: -8.2017,
        magnitude: 0.12,
        pm_ra_mas: 1.31,
        pm_dec_mas: 0.50,
        common_name: Some("Rigel"),
    },
    StarEntry {
        hip_id: 24608,
        ra_j2000: 5.2788,
        dec_j2000: 45.9990,
        magnitude: 1.65,
        pm_ra_mas: 75.25,
        pm_dec_mas: -426.89,
        common_name: Some("Capella"),
    },
    StarEntry {
        hip_id: 25336,
        ra_j2000: 5.4188,
        dec_j2000: -1.2019,
        magnitude: 1.70,
        pm_ra_mas: -8.11,
        pm_dec_mas: -12.88,
        common_name: Some("Bellatrix"),
    },
    StarEntry {
        hip_id: 25930,
        ra_j2000: 5.5335,
        dec_j2000: -17.8225,
        magnitude: 2.06,
        pm_ra_mas: 0.64,
        pm_dec_mas: -0.69,
        common_name: None,
    },
    StarEntry {
        hip_id: 26311,
        ra_j2000: 5.6032,
        dec_j2000: -1.9420,
        magnitude: 2.23,
        pm_ra_mas: 1.44,
        pm_dec_mas: -0.78,
        common_name: Some("Alnilam"),
    },
    StarEntry {
        hip_id: 27989,
        ra_j2000: 5.9195,
        dec_j2000: 7.4070,
        magnitude: 0.50,
        pm_ra_mas: 27.54,
        pm_dec_mas: 11.30,
        common_name: Some("Betelgeuse"),
    },
    StarEntry {
        hip_id: 30438,
        ra_j2000: 6.3991,
        dec_j2000: -52.6957,
        magnitude: -0.74,
        pm_ra_mas: 19.93,
        pm_dec_mas: 23.24,
        common_name: Some("Canopus"),
    },
    StarEntry {
        hip_id: 32349,
        ra_j2000: 6.7525,
        dec_j2000: -16.7161,
        magnitude: -1.46,
        pm_ra_mas: -546.01,
        pm_dec_mas: -1223.07,
        common_name: Some("Sirius"),
    },
    StarEntry {
        hip_id: 33579,
        ra_j2000: 6.9771,
        dec_j2000: -28.9722,
        magnitude: 1.50,
        pm_ra_mas: 3.24,
        pm_dec_mas: 1.33,
        common_name: Some("Adhara"),
    },
    StarEntry {
        hip_id: 36850,
        ra_j2000: 7.5770,
        dec_j2000: 31.8884,
        magnitude: 1.14,
        pm_ra_mas: -191.45,
        pm_dec_mas: -145.19,
        common_name: Some("Pollux"),
    },
    StarEntry {
        hip_id: 37279,
        ra_j2000: 7.6553,
        dec_j2000: 5.2250,
        magnitude: 0.34,
        pm_ra_mas: -714.59,
        pm_dec_mas: -1036.80,
        common_name: Some("Procyon"),
    },
    StarEntry {
        hip_id: 49669,
        ra_j2000: 10.1395,
        dec_j2000: 11.9672,
        magnitude: 1.35,
        pm_ra_mas: -248.73,
        pm_dec_mas: 5.59,
        common_name: Some("Regulus"),
    },
    StarEntry {
        hip_id: 54061,
        ra_j2000: 11.0621,
        dec_j2000: 61.7509,
        magnitude: 1.79,
        pm_ra_mas: -134.11,
        pm_dec_mas: -34.70,
        common_name: Some("Dubhe"),
    },
    StarEntry {
        hip_id: 57632,
        ra_j2000: 11.8177,
        dec_j2000: 14.5719,
        magnitude: 2.14,
        pm_ra_mas: -497.68,
        pm_dec_mas: -114.67,
        common_name: Some("Denebola"),
    },
    StarEntry {
        hip_id: 65474,
        ra_j2000: 13.4199,
        dec_j2000: -11.1614,
        magnitude: 0.97,
        pm_ra_mas: -42.35,
        pm_dec_mas: -30.67,
        common_name: Some("Spica"),
    },
    StarEntry {
        hip_id: 67301,
        ra_j2000: 13.7923,
        dec_j2000: 49.3133,
        magnitude: 1.86,
        pm_ra_mas: -121.17,
        pm_dec_mas: -14.91,
        common_name: Some("Mizar"),
    },
    StarEntry {
        hip_id: 69673,
        ra_j2000: 14.2610,
        dec_j2000: 19.1824,
        magnitude: -0.05,
        pm_ra_mas: -1093.39,
        pm_dec_mas: -2000.06,
        common_name: Some("Arcturus"),
    },
    StarEntry {
        hip_id: 71683,
        ra_j2000: 14.6600,
        dec_j2000: -60.8354,
        magnitude: -0.01,
        pm_ra_mas: -3679.25,
        pm_dec_mas: 473.67,
        common_name: Some("Alpha Centauri"),
    },
    StarEntry {
        hip_id: 80763,
        ra_j2000: 16.4901,
        dec_j2000: -26.4320,
        magnitude: 0.96,
        pm_ra_mas: -12.11,
        pm_dec_mas: -23.30,
        common_name: Some("Antares"),
    },
    StarEntry {
        hip_id: 86032,
        ra_j2000: 17.5822,
        dec_j2000: -37.1038,
        magnitude: 1.63,
        pm_ra_mas: 108.07,
        pm_dec_mas: -221.57,
        common_name: Some("Sargas"),
    },
    StarEntry {
        hip_id: 91262,
        ra_j2000: 18.6156,
        dec_j2000: 38.7837,
        magnitude: 0.03,
        pm_ra_mas: 200.94,
        pm_dec_mas: 286.23,
        common_name: Some("Vega"),
    },
    StarEntry {
        hip_id: 97649,
        ra_j2000: 19.8464,
        dec_j2000: 8.8684,
        magnitude: 0.77,
        pm_ra_mas: 536.23,
        pm_dec_mas: 385.29,
        common_name: Some("Altair"),
    },
    StarEntry {
        hip_id: 102098,
        ra_j2000: 20.6905,
        dec_j2000: 45.2803,
        magnitude: 1.25,
        pm_ra_mas: 2.01,
        pm_dec_mas: 1.85,
        common_name: Some("Deneb"),
    },
    StarEntry {
        hip_id: 107315,
        ra_j2000: 21.7364,
        dec_j2000: -16.1274,
        magnitude: 1.74,
        pm_ra_mas: 26.92,
        pm_dec_mas: 0.44,
        common_name: None,
    },
    StarEntry {
        hip_id: 109268,
        ra_j2000: 22.1370,
        dec_j2000: -46.9611,
        magnitude: 1.16,
        pm_ra_mas: 126.69,
        pm_dec_mas: -147.47,
        common_name: Some("Fomalhaut"),
    },
    StarEntry {
        hip_id: 113368,
        ra_j2000: 22.9607,
        dec_j2000: -29.6222,
        magnitude: 1.17,
        pm_ra_mas: 328.95,
        pm_dec_mas: -164.67,
        common_name: None,
    },
];

/// Looks up a star by HIP ID using binary search.
///
/// Returns `None` if the star is not in the embedded catalog.
pub fn lookup_star(hip_id: u32) -> Option<&'static StarEntry> {
    BRIGHT_STARS
        .binary_search_by_key(&hip_id, |s| s.hip_id)
        .ok()
        .map(|idx| &BRIGHT_STARS[idx])
}

/// Applies precession correction to J2000.0 coordinates for the given Julian Date.
///
/// Uses Meeus approximate precession formula (Algorithm 21.1):
///   Δα = (m + n·sin(α)·tan(δ)) · years   [seconds of time / year]
///   Δδ = n'·cos(α) · years                [arcseconds / year]
/// where m ≈ 3.075 s/yr, n ≈ 1.336 s/yr, n' = 15·n ≈ 20.04 "/yr.
///
/// # Returns
/// `(ra_hours, dec_degrees)` corrected for precession from J2000.0 to the target epoch.
pub fn apply_precession(ra_j2000: f64, dec_j2000: f64, jd: f64) -> (f64, f64) {
    let years = (jd - 2_451_545.0) / 365.25;

    let ra_rad = ra_j2000 * std::f64::consts::PI / 12.0;
    let dec_rad = dec_j2000 * std::f64::consts::PI / 180.0;

    // Precession rates from Meeus Algorithm 21.1.
    // m and n are in seconds of time per year; convert to hours: /3600.
    // n' = 20.04 arcseconds per year; convert to degrees: /3600.
    let d_ra = (3.075 + 1.336 * ra_rad.sin() * dec_rad.tan()) * years / 3600.0;
    let d_dec = (20.04 * ra_rad.cos()) * years / 3600.0;

    let ra_now = crate::math::utils::normalize_hours(ra_j2000 + d_ra);
    let dec_now = (dec_j2000 + d_dec).clamp(-90.0, 90.0);

    (ra_now, dec_now)
}

/// Applies precession + proper motion to J2000.0 coordinates.
///
/// `pm_ra_mas`: proper motion in RA (μα*cos(δ)) in mas/yr (Hipparcos convention)
/// `pm_dec_mas`: proper motion in Dec (μδ) in mas/yr
///
/// # Returns
/// `(ra_hours, dec_degrees)` corrected for both effects.
pub fn apply_precession_and_pm(
    ra_j2000: f64,
    dec_j2000: f64,
    pm_ra_mas: f64,
    pm_dec_mas: f64,
    jd: f64,
) -> (f64, f64) {
    let years = (jd - 2_451_545.0) / 365.25;

    // Apply proper motion to J2000 coordinates first.
    // pm_ra_mas = μα*cos(δ), so actual ΔRA = pm_ra / cos(δ).
    // Convert: mas → arcsec (/1000) → time-seconds (/15) → hours (/3600).
    let dec_rad = dec_j2000 * std::f64::consts::PI / 180.0;
    let cos_dec = dec_rad.cos();
    let pm_d_ra = if cos_dec.abs() > 1e-10 {
        pm_ra_mas / cos_dec * years / 1000.0 / 15.0 / 3600.0
    } else {
        0.0 // Near pole: proper motion in RA is undefined
    };
    let pm_d_dec = pm_dec_mas * years / 1000.0 / 3600.0;

    let ra_pm = ra_j2000 + pm_d_ra;
    let dec_pm = dec_j2000 + pm_d_dec;

    // Then apply precession to the proper-motion-corrected coordinates
    apply_precession(ra_pm, dec_pm, jd)
}

/// Computes a star's current position given its HIP ID and observation Julian Date.
///
/// Applies both proper motion and precession from J2000.0 to the target epoch.
/// Returns `None` if the star is not found in the embedded catalog.
pub fn compute_star_position(hip_id: u32, jd: f64) -> Option<(f64, f64)> {
    lookup_star(hip_id).map(|star| {
        apply_precession_and_pm(
            star.ra_j2000,
            star.dec_j2000,
            star.pm_ra_mas,
            star.pm_dec_mas,
            jd,
        )
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coordinates::time::JD_J2000;

    #[test]
    fn test_lookup_sirius() {
        let star = lookup_star(32349).expect("Sirius should be in catalog");
        assert_eq!(star.common_name, Some("Sirius"));
        assert!((star.magnitude - (-1.46)).abs() < 0.01);
        assert!((star.ra_j2000 - 6.7525).abs() < 0.001);
    }

    #[test]
    fn test_lookup_vega() {
        let star = lookup_star(91262).expect("Vega should be in catalog");
        assert_eq!(star.common_name, Some("Vega"));
        assert!((star.magnitude - 0.03).abs() < 0.01);
    }

    #[test]
    fn test_lookup_unknown() {
        assert!(lookup_star(999999).is_none());
    }

    #[test]
    fn test_precession_at_j2000() {
        // No precession at the reference epoch
        let (ra, dec) = apply_precession(6.7525, -16.7161, JD_J2000);
        assert!((ra - 6.7525).abs() < 1e-10);
        assert!((dec - (-16.7161)).abs() < 1e-10);
    }

    #[test]
    fn test_precession_drift() {
        // Over 25 years, precession should shift coordinates measurably.
        // For a star near RA=6.75h, Dec=-16.7°:
        //   Δα ≈ (3.075 + 1.336·sin·tan) * 25 / 3600 ≈ 0.019 hours
        //   Δδ ≈ 20.04·cos(ra) * 25 / 3600 ≈ -0.028 degrees
        let jd_2025 = JD_J2000 + 25.0 * 365.25;
        let (ra_now, dec_now) = apply_precession(6.7525, -16.7161, jd_2025);
        let ra_diff = (ra_now - 6.7525).abs();
        let dec_diff = (dec_now - (-16.7161)).abs();
        assert!(ra_diff > 0.01 && ra_diff < 0.05, "RA drift={ra_diff} hours");
        assert!(
            dec_diff > 0.01 && dec_diff < 0.1,
            "Dec drift={dec_diff} degrees"
        );
    }

    #[test]
    fn test_proper_motion_sirius() {
        // Sirius has large proper motion: pm_ra=-546 mas/yr, pm_dec=-1223 mas/yr
        // Over 26 years: Δδ ≈ -1223 * 26 / 1000 / 3600 ≈ -0.0088°
        let jd_2026 = JD_J2000 + 26.0 * 365.25;
        let (ra_pm, dec_pm) = apply_precession_and_pm(6.7525, -16.7161, -546.01, -1223.07, jd_2026);
        let (ra_no_pm, dec_no_pm) = apply_precession(6.7525, -16.7161, jd_2026);
        // With proper motion, Sirius should be further south (more negative dec)
        assert!(
            dec_pm < dec_no_pm,
            "Sirius pm_dec is negative, so dec_pm < dec_no_pm"
        );
        let dec_pm_effect = (dec_pm - dec_no_pm).abs();
        assert!(
            dec_pm_effect > 0.005 && dec_pm_effect < 0.02,
            "Dec proper motion effect over 26yr: {dec_pm_effect}°"
        );
        // RA proper motion effect should also be measurable
        let ra_pm_effect = (ra_pm - ra_no_pm).abs();
        assert!(
            ra_pm_effect > 0.0001,
            "RA proper motion effect: {ra_pm_effect} hours"
        );
    }

    #[test]
    fn test_compute_star_position_sirius() {
        let jd = JD_J2000 + 9000.0; // ~2024
        let (ra, dec) = compute_star_position(32349, jd).expect("Sirius should exist");
        assert!(ra >= 0.0 && ra < 24.0);
        assert!(
            dec > -20.0 && dec < -10.0,
            "Sirius Dec should be ~-16.7, got {dec}"
        );
    }

    #[test]
    fn test_compute_star_position_unknown() {
        assert!(compute_star_position(999999, JD_J2000).is_none());
    }

    #[test]
    fn test_catalog_sorted() {
        // Verify catalog is sorted by HIP ID (required for binary search)
        for window in BRIGHT_STARS.windows(2) {
            assert!(
                window[0].hip_id < window[1].hip_id,
                "Catalog not sorted: {} >= {}",
                window[0].hip_id,
                window[1].hip_id
            );
        }
    }

    #[test]
    fn test_polaris_position() {
        let star = lookup_star(11767).expect("Polaris should exist");
        assert_eq!(star.common_name, Some("Polaris"));
        // Polaris Dec should be very close to +90
        assert!(
            star.dec_j2000 > 89.0,
            "Polaris should be near pole, dec={}",
            star.dec_j2000
        );
    }
}
