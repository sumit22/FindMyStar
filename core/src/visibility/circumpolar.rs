/// Checks if an object is circumpolar (never sets) at a given latitude.
///
/// An object is circumpolar when its declination is close enough to the
/// elevated pole that it never dips below the horizon.
///
/// # Returns
/// - `Some(true)` if circumpolar (always visible)
/// - `Some(false)` if never visible
/// - `None` if the object rises and sets normally
pub fn check_circumpolar(dec_deg: f64, lat_deg: f64) -> Option<bool> {
    let lat_abs = lat_deg.abs();
    let threshold = 90.0 - lat_abs;

    if (lat_deg >= 0.0 && dec_deg > threshold) || (lat_deg < 0.0 && dec_deg < -threshold) {
        Some(true) // Always visible
    } else if (lat_deg >= 0.0 && dec_deg < -threshold) || (lat_deg < 0.0 && dec_deg > threshold) {
        Some(false) // Never visible
    } else {
        None // Rises and sets
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_polaris_circumpolar_north() {
        assert_eq!(check_circumpolar(89.26, 45.0), Some(true));
        assert_eq!(check_circumpolar(89.26, 10.0), Some(true));
    }

    #[test]
    fn test_polaris_never_visible_south() {
        assert_eq!(check_circumpolar(89.26, -45.0), Some(false));
    }

    #[test]
    fn test_sirius_rises_and_sets() {
        assert_eq!(check_circumpolar(-16.72, 40.0), None);
    }

    #[test]
    fn test_equator_nothing_circumpolar() {
        // At equator, no star with dec != +/-90 is circumpolar
        assert_eq!(check_circumpolar(45.0, 0.0), None);
        assert_eq!(check_circumpolar(-45.0, 0.0), None);
    }

    #[test]
    fn test_pole_everything_visible_or_not() {
        // At north pole, everything with positive dec is circumpolar
        assert_eq!(check_circumpolar(10.0, 90.0), Some(true));
        assert_eq!(check_circumpolar(-10.0, 90.0), Some(false));
    }
}
