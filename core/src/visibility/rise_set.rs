use crate::coordinates::time::unix_to_jd;
use crate::coordinates::transforms::ra_dec_to_altaz;
use crate::math::utils::deg_to_rad;

/// Result of a rise/set calculation.
#[derive(Clone, Debug, PartialEq)]
pub enum RiseSetResult {
    /// Object rises and sets. Times in Unix ms.
    RisesAndSets { rise_ms: f64, set_ms: f64 },
    /// Object is always above the horizon (circumpolar).
    AlwaysVisible,
    /// Object is always below the horizon.
    NeverVisible,
}

/// Standard atmospheric refraction correction at the horizon (degrees).
const REFRACTION_AT_HORIZON: f64 = -0.5667;

/// Computes rise/set times analytically for objects with fixed RA/Dec (stars, deep-sky).
///
/// Uses the hour angle formula: cos(H0) = (sin(h0) - sin(lat)*sin(dec)) / (cos(lat)*cos(dec))
/// where h0 is the altitude threshold (default: -0.5667° for atmospheric refraction).
///
/// # Arguments
/// * `ra_hours` - Right Ascension in hours (0-24)
/// * `dec_deg` - Declination in degrees (-90 to +90)
/// * `lat_deg` - Observer latitude in degrees
/// * `lon_deg` - Observer longitude in degrees
/// * `start_unix_ms` - Search start time (Unix ms)
/// * `altitude_threshold` - Minimum altitude in degrees (default: REFRACTION_AT_HORIZON)
pub fn compute_rise_set_analytical(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    start_unix_ms: f64,
    altitude_threshold: Option<f64>,
) -> RiseSetResult {
    let h0 = altitude_threshold.unwrap_or(REFRACTION_AT_HORIZON);
    let lat_rad = deg_to_rad(lat_deg);
    let dec_rad = deg_to_rad(dec_deg);
    let h0_rad = deg_to_rad(h0);

    let cos_h0 = (h0_rad.sin() - lat_rad.sin() * dec_rad.sin()) / (lat_rad.cos() * dec_rad.cos());

    if cos_h0 < -1.0 {
        return RiseSetResult::AlwaysVisible;
    }
    if cos_h0 > 1.0 {
        return RiseSetResult::NeverVisible;
    }

    let h0_hours = cos_h0.acos().to_degrees() / 15.0;

    // Compute LST at start time to find next rise/set
    let jd = unix_to_jd(start_unix_ms);
    let lst = crate::coordinates::sidereal::compute_lst(jd, lon_deg);

    // Transit time in LST
    let transit_lst = ra_hours;

    // Rise and set in LST
    let rise_lst = transit_lst - h0_hours;
    let set_lst = transit_lst + h0_hours;

    // Convert LST to hours from now
    let rise_diff = ((rise_lst - lst) % 24.0 + 24.0) % 24.0;
    let set_diff = ((set_lst - lst) % 24.0 + 24.0) % 24.0;

    // Convert hours to Unix ms
    let ms_per_sidereal_hour = 3_600_000.0 / 1.00273790935;
    let rise_ms = start_unix_ms + rise_diff * ms_per_sidereal_hour;
    let set_ms = start_unix_ms + set_diff * ms_per_sidereal_hour;

    RiseSetResult::RisesAndSets { rise_ms, set_ms }
}

/// Computes rise time iteratively for objects with changing RA/Dec (planets, Sun, Moon).
///
/// Scans forward in 5-minute steps over 48 hours, then refines with binary search.
///
/// # Returns
/// `Some(rise_unix_ms)` or `None` if no rise found in 48 hours.
pub fn compute_rise_iterative(
    compute_position: impl Fn(f64) -> (f64, f64),
    lat_deg: f64,
    lon_deg: f64,
    start_unix_ms: f64,
    altitude_threshold: f64,
) -> Option<f64> {
    let step_ms = 5.0 * 60_000.0; // 5 minutes
    let end_ms = start_unix_ms + 48.0 * 3_600_000.0; // 48 hours

    let mut t = start_unix_ms;

    // Check initial state
    let (ra, dec) = compute_position(t);
    let (alt, _) = ra_dec_to_altaz(ra, dec, lat_deg, lon_deg, t);
    let mut prev_below = alt < altitude_threshold;
    t += step_ms;

    while t < end_ms {
        let (ra, dec) = compute_position(t);
        let (alt, _) = ra_dec_to_altaz(ra, dec, lat_deg, lon_deg, t);

        if prev_below && alt >= altitude_threshold {
            // Object just rose - refine with binary search
            return Some(binary_search_rise(
                &compute_position,
                lat_deg,
                lon_deg,
                t - step_ms,
                t,
                altitude_threshold,
            ));
        }

        prev_below = alt < altitude_threshold;
        t += step_ms;
    }

    None // No rise in 48 hours
}

fn binary_search_rise(
    compute_position: &impl Fn(f64) -> (f64, f64),
    lat_deg: f64,
    lon_deg: f64,
    mut t1: f64,
    mut t2: f64,
    threshold: f64,
) -> f64 {
    for _ in 0..20 {
        if (t2 - t1) < 60_000.0 {
            break;
        } // 1 minute precision
        let mid = (t1 + t2) / 2.0;
        let (ra, dec) = compute_position(mid);
        let (alt, _) = ra_dec_to_altaz(ra, dec, lat_deg, lon_deg, mid);
        if alt >= threshold {
            t2 = mid;
        } else {
            t1 = mid;
        }
    }
    (t1 + t2) / 2.0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_polaris_circumpolar_at_high_lat() {
        // Polaris (Dec ~89.26) should be circumpolar at lat > 1°
        let result =
            compute_rise_set_analytical(2.53, 89.26, 45.0, -74.0, 1_704_067_200_000.0, None);
        assert_eq!(result, RiseSetResult::AlwaysVisible);
    }

    #[test]
    fn test_canopus_never_visible_from_nyc() {
        // Canopus (Dec ~-52.7) should never be visible from NYC (lat ~40.7)
        let result =
            compute_rise_set_analytical(6.40, -52.7, 40.7, -74.0, 1_704_067_200_000.0, None);
        assert_eq!(result, RiseSetResult::NeverVisible);
    }

    #[test]
    fn test_sirius_rises_and_sets() {
        // Sirius (Dec ~-16.7) should rise and set from most mid-latitudes
        let result =
            compute_rise_set_analytical(6.75, -16.72, 40.7, -74.0, 1_704_067_200_000.0, None);
        match result {
            RiseSetResult::RisesAndSets { rise_ms, set_ms } => {
                assert!(rise_ms > 0.0);
                assert!(set_ms > 0.0);
            }
            _ => panic!("Sirius should rise and set from NYC"),
        }
    }

    #[test]
    fn test_iterative_rise_finds_result() {
        // Use a simple fixed-position function (like a star)
        let result = compute_rise_iterative(
            |_t| (6.75, -16.72), // Sirius-like
            40.7,
            -74.0,
            1_704_067_200_000.0, // 2024-01-01
            0.0,                 // horizon
        );
        assert!(
            result.is_some(),
            "Should find a rise time for Sirius-like object"
        );
    }
}
