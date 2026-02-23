/// A single star entry from the embedded Hipparcos catalog.
#[derive(Clone, Debug)]
pub struct StarEntry {
    pub hip_id: u32,
    pub ra_j2000: f64,  // Right Ascension at J2000.0 (hours)
    pub dec_j2000: f64,  // Declination at J2000.0 (degrees)
    pub magnitude: f32,  // Apparent visual magnitude
    pub common_name: Option<&'static str>,
}

/// Embedded catalog of bright stars (magnitude < 5.0), sorted by HIP ID for binary search.
/// This is a representative subset; the full ~500 star catalog will be in the SQLite database.
/// The engine uses this for fast lookup when computing positions with precession correction.
static BRIGHT_STARS: &[StarEntry] = &[
    StarEntry { hip_id: 677,   ra_j2000: 0.1396,  dec_j2000: 29.0905, magnitude: 2.06, common_name: Some("Alpheratz") },
    StarEntry { hip_id: 1067,  ra_j2000: 0.2209,  dec_j2000: 15.1836, magnitude: 2.83, common_name: None },
    StarEntry { hip_id: 2081,  ra_j2000: 0.4381,  dec_j2000: -77.2544, magnitude: 2.80, common_name: None },
    StarEntry { hip_id: 3179,  ra_j2000: 0.6752,  dec_j2000: 56.5373, magnitude: 2.23, common_name: Some("Schedar") },
    StarEntry { hip_id: 3419,  ra_j2000: 0.7265,  dec_j2000: -17.9867, magnitude: 2.04, common_name: Some("Diphda") },
    StarEntry { hip_id: 5447,  ra_j2000: 1.1620,  dec_j2000: 35.6206, magnitude: 2.07, common_name: Some("Mirach") },
    StarEntry { hip_id: 7588,  ra_j2000: 1.6285,  dec_j2000: -10.1822, magnitude: 2.53, common_name: None },
    StarEntry { hip_id: 9884,  ra_j2000: 2.1195,  dec_j2000: 23.4624, magnitude: 2.00, common_name: Some("Hamal") },
    StarEntry { hip_id: 11767, ra_j2000: 2.5301,  dec_j2000: 89.2641, magnitude: 2.02, common_name: Some("Polaris") },
    StarEntry { hip_id: 13847, ra_j2000: 2.9710,  dec_j2000: 42.3297, magnitude: 2.09, common_name: Some("Mirfak") },
    StarEntry { hip_id: 14576, ra_j2000: 3.1362,  dec_j2000: 40.9556, magnitude: 1.79, common_name: Some("Algol") },
    StarEntry { hip_id: 15863, ra_j2000: 3.4054,  dec_j2000: 49.8613, magnitude: 1.80, common_name: None },
    StarEntry { hip_id: 21421, ra_j2000: 4.5987,  dec_j2000: 16.5093, magnitude: 0.85, common_name: Some("Aldebaran") },
    StarEntry { hip_id: 24436, ra_j2000: 5.2423,  dec_j2000: -8.2017, magnitude: 0.12, common_name: Some("Rigel") },
    StarEntry { hip_id: 24608, ra_j2000: 5.2788,  dec_j2000: 45.9990, magnitude: 1.65, common_name: Some("Capella") },
    StarEntry { hip_id: 25336, ra_j2000: 5.4188,  dec_j2000: -1.2019, magnitude: 1.70, common_name: Some("Bellatrix") },
    StarEntry { hip_id: 25930, ra_j2000: 5.5335,  dec_j2000: -17.8225, magnitude: 2.06, common_name: None },
    StarEntry { hip_id: 26311, ra_j2000: 5.6032,  dec_j2000: -1.9420, magnitude: 2.23, common_name: Some("Alnilam") },
    StarEntry { hip_id: 27989, ra_j2000: 5.9195,  dec_j2000: 7.4070,  magnitude: 0.50, common_name: Some("Betelgeuse") },
    StarEntry { hip_id: 30438, ra_j2000: 6.3991,  dec_j2000: -52.6957, magnitude: -0.74, common_name: Some("Canopus") },
    StarEntry { hip_id: 32349, ra_j2000: 6.7525,  dec_j2000: -16.7161, magnitude: -1.46, common_name: Some("Sirius") },
    StarEntry { hip_id: 33579, ra_j2000: 6.9771,  dec_j2000: -28.9722, magnitude: 1.50, common_name: Some("Adhara") },
    StarEntry { hip_id: 36850, ra_j2000: 7.5770,  dec_j2000: 31.8884, magnitude: 1.14, common_name: Some("Pollux") },
    StarEntry { hip_id: 37279, ra_j2000: 7.6553,  dec_j2000: 5.2250,  magnitude: 0.34, common_name: Some("Procyon") },
    StarEntry { hip_id: 49669, ra_j2000: 10.1395, dec_j2000: 11.9672, magnitude: 1.35, common_name: Some("Regulus") },
    StarEntry { hip_id: 54061, ra_j2000: 11.0621, dec_j2000: 61.7509, magnitude: 1.79, common_name: Some("Dubhe") },
    StarEntry { hip_id: 57632, ra_j2000: 11.8177, dec_j2000: 14.5719, magnitude: 2.14, common_name: Some("Denebola") },
    StarEntry { hip_id: 65474, ra_j2000: 13.4199, dec_j2000: -11.1614, magnitude: 0.97, common_name: Some("Spica") },
    StarEntry { hip_id: 67301, ra_j2000: 13.7923, dec_j2000: 49.3133, magnitude: 1.86, common_name: Some("Mizar") },
    StarEntry { hip_id: 69673, ra_j2000: 14.2610, dec_j2000: 19.1824, magnitude: -0.05, common_name: Some("Arcturus") },
    StarEntry { hip_id: 71683, ra_j2000: 14.6600, dec_j2000: -60.8354, magnitude: -0.01, common_name: Some("Alpha Centauri") },
    StarEntry { hip_id: 80763, ra_j2000: 16.4901, dec_j2000: -26.4320, magnitude: 0.96, common_name: Some("Antares") },
    StarEntry { hip_id: 86032, ra_j2000: 17.5822, dec_j2000: -37.1038, magnitude: 1.63, common_name: Some("Sargas") },
    StarEntry { hip_id: 91262, ra_j2000: 18.6156, dec_j2000: 38.7837, magnitude: 0.03, common_name: Some("Vega") },
    StarEntry { hip_id: 97649, ra_j2000: 19.8464, dec_j2000: 8.8684,  magnitude: 0.77, common_name: Some("Altair") },
    StarEntry { hip_id: 102098, ra_j2000: 20.6905, dec_j2000: 45.2803, magnitude: 1.25, common_name: Some("Deneb") },
    StarEntry { hip_id: 107315, ra_j2000: 21.7364, dec_j2000: -16.1274, magnitude: 1.74, common_name: None },
    StarEntry { hip_id: 109268, ra_j2000: 22.1370, dec_j2000: -46.9611, magnitude: 1.16, common_name: Some("Fomalhaut") },
    StarEntry { hip_id: 113368, ra_j2000: 22.9607, dec_j2000: -29.6222, magnitude: 1.17, common_name: None },
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
/// # Returns
/// `(ra_hours, dec_degrees)` corrected for precession from J2000.0 to the target epoch.
pub fn apply_precession(ra_j2000: f64, dec_j2000: f64, jd: f64) -> (f64, f64) {
    let years = (jd - 2_451_545.0) / 365.25;

    let ra_rad = ra_j2000 * std::f64::consts::PI / 12.0;
    let dec_rad = dec_j2000 * std::f64::consts::PI / 180.0;

    // Simplified precession rates (arcseconds per year -> hours and degrees)
    let d_ra = (3.075 + 1.336 * ra_rad.sin() * dec_rad.tan()) * years / 3600.0 / 15.0;
    let d_dec = (20.04 * ra_rad.cos()) * years / 3600.0;

    let ra_now = crate::math::utils::normalize_hours(ra_j2000 + d_ra);
    let dec_now = (dec_j2000 + d_dec).clamp(-90.0, 90.0);

    (ra_now, dec_now)
}

/// Computes a star's current position given its HIP ID and observation Julian Date.
///
/// Returns `None` if the star is not found in the embedded catalog.
pub fn compute_star_position(hip_id: u32, jd: f64) -> Option<(f64, f64)> {
    lookup_star(hip_id).map(|star| apply_precession(star.ra_j2000, star.dec_j2000, jd))
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
        // Over 25 years, precession should shift by ~0.35 degrees
        let jd_2025 = JD_J2000 + 25.0 * 365.25;
        let (ra_now, dec_now) = apply_precession(6.7525, -16.7161, jd_2025);
        let ra_diff = (ra_now - 6.7525).abs();
        let dec_diff = (dec_now - (-16.7161)).abs();
        // Should be small but non-zero
        assert!(ra_diff > 0.0 && ra_diff < 0.1, "RA drift={ra_diff}");
        assert!(dec_diff > 0.0 && dec_diff < 0.5, "Dec drift={dec_diff}");
    }

    #[test]
    fn test_compute_star_position_sirius() {
        let jd = JD_J2000 + 9000.0; // ~2024
        let (ra, dec) = compute_star_position(32349, jd).expect("Sirius should exist");
        assert!(ra >= 0.0 && ra < 24.0);
        assert!(dec > -20.0 && dec < -10.0, "Sirius Dec should be ~-16.7, got {dec}");
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
        assert!(star.dec_j2000 > 89.0, "Polaris should be near pole, dec={}", star.dec_j2000);
    }
}
