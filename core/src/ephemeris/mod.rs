pub mod sun;
pub mod moon;
pub mod planets;
pub mod stars;

use planets::Planet;

/// Object type for ephemeris dispatch.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum ObjectType {
    Sun,
    Moon,
    Planet(u32),  // planet_id 1-7
    Star(u32),    // hip_id
}

/// Computes the position (RA hours, Dec degrees) for any celestial object.
///
/// Routes to the appropriate sub-module based on object type.
/// Returns `None` if the object cannot be found (e.g., unknown star HIP ID).
pub fn compute_position(object: ObjectType, jd: f64) -> Option<(f64, f64)> {
    match object {
        ObjectType::Sun => Some(sun::compute_sun_position(jd)),
        ObjectType::Moon => Some(moon::compute_moon_position(jd)),
        ObjectType::Planet(id) => {
            Planet::from_id(id).map(|p| planets::compute_planet_position(p, jd))
        }
        ObjectType::Star(hip_id) => stars::compute_star_position(hip_id, jd),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::coordinates::time::JD_J2000;

    #[test]
    fn test_dispatch_sun() {
        let result = compute_position(ObjectType::Sun, JD_J2000);
        assert!(result.is_some());
        let (ra, dec) = result.unwrap();
        assert!(ra >= 0.0 && ra < 24.0);
        assert!(dec.abs() < 24.0);
    }

    #[test]
    fn test_dispatch_moon() {
        let result = compute_position(ObjectType::Moon, JD_J2000);
        assert!(result.is_some());
    }

    #[test]
    fn test_dispatch_planet() {
        let result = compute_position(ObjectType::Planet(4), JD_J2000); // Jupiter
        assert!(result.is_some());
    }

    #[test]
    fn test_dispatch_invalid_planet() {
        assert!(compute_position(ObjectType::Planet(0), JD_J2000).is_none());
        assert!(compute_position(ObjectType::Planet(8), JD_J2000).is_none());
    }

    #[test]
    fn test_dispatch_star() {
        let result = compute_position(ObjectType::Star(32349), JD_J2000); // Sirius
        assert!(result.is_some());
    }

    #[test]
    fn test_dispatch_unknown_star() {
        assert!(compute_position(ObjectType::Star(999999), JD_J2000).is_none());
    }
}
