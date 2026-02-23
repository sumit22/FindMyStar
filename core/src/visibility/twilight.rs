/// Twilight classification based on Sun altitude.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum TwilightState {
    Day,                  // Sun above horizon
    CivilTwilight,        // Sun 0° to -6°
    NauticalTwilight,     // Sun -6° to -12°
    AstronomicalTwilight, // Sun -12° to -18°
    Night,                // Sun below -18°
}

/// Classifies the twilight state based on Sun altitude in degrees.
pub fn classify_twilight(sun_alt_deg: f64) -> TwilightState {
    if sun_alt_deg > 0.0 {
        TwilightState::Day
    } else if sun_alt_deg > -6.0 {
        TwilightState::CivilTwilight
    } else if sun_alt_deg > -12.0 {
        TwilightState::NauticalTwilight
    } else if sun_alt_deg > -18.0 {
        TwilightState::AstronomicalTwilight
    } else {
        TwilightState::Night
    }
}

/// Returns whether a celestial object is observable given its altitude
/// and the current Sun altitude. Objects need darkness to be visible.
///
/// Rules:
/// - Stars/deep-sky: observable when Sun below -6° (civil twilight ended)
/// - Moon: always observable when above horizon
/// - Planets: observable when Sun below 0° (after sunset)
pub fn is_observable(object_alt_deg: f64, sun_alt_deg: f64, is_solar_system: bool) -> bool {
    if object_alt_deg <= 0.0 {
        return false; // Below horizon
    }
    if is_solar_system {
        sun_alt_deg <= 0.0 // Planets/Moon visible after sunset
    } else {
        sun_alt_deg <= -6.0 // Stars/deep-sky need civil twilight to end
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_day() {
        assert_eq!(classify_twilight(10.0), TwilightState::Day);
        assert_eq!(classify_twilight(0.1), TwilightState::Day);
    }

    #[test]
    fn test_classify_civil() {
        assert_eq!(classify_twilight(-3.0), TwilightState::CivilTwilight);
    }

    #[test]
    fn test_classify_nautical() {
        assert_eq!(classify_twilight(-9.0), TwilightState::NauticalTwilight);
    }

    #[test]
    fn test_classify_astronomical() {
        assert_eq!(
            classify_twilight(-15.0),
            TwilightState::AstronomicalTwilight
        );
    }

    #[test]
    fn test_classify_night() {
        assert_eq!(classify_twilight(-20.0), TwilightState::Night);
        assert_eq!(classify_twilight(-90.0), TwilightState::Night);
    }

    #[test]
    fn test_observable_star_at_night() {
        assert!(is_observable(30.0, -10.0, false));
    }

    #[test]
    fn test_star_not_observable_during_day() {
        assert!(!is_observable(30.0, 10.0, false));
    }

    #[test]
    fn test_star_not_observable_during_civil_twilight() {
        assert!(!is_observable(30.0, -3.0, false));
    }

    #[test]
    fn test_planet_observable_after_sunset() {
        assert!(is_observable(20.0, -2.0, true));
    }

    #[test]
    fn test_object_below_horizon() {
        assert!(!is_observable(-5.0, -20.0, false));
    }
}
