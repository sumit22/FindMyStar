use crate::coordinates::sidereal::compute_lst;
use crate::coordinates::time::unix_to_jd;
use crate::math::utils::{deg_to_rad, normalize_degrees, rad_to_deg, safe_asin};
use crate::math::Vector3;

/// Converts equatorial coordinates (RA/Dec) to horizontal coordinates (Alt/Az)
/// for a given observer location and time.
///
/// # Arguments
/// * `ra_hours` - Right Ascension in hours (0.0 to 24.0)
/// * `dec_deg` - Declination in degrees (-90.0 to +90.0)
/// * `lat_deg` - Observer latitude in degrees (-90.0 to +90.0)
/// * `lon_deg` - Observer longitude in degrees (-180.0 to +180.0)
/// * `unix_ms` - Unix timestamp in milliseconds
///
/// # Returns
/// (altitude_deg, azimuth_deg) where altitude is -90 to +90 and azimuth is 0 to 360
/// (measured from North, clockwise: East=90, South=180, West=270).
pub fn ra_dec_to_altaz(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    unix_ms: f64,
) -> (f64, f64) {
    let jd = unix_to_jd(unix_ms);
    let lst = compute_lst(jd, lon_deg);

    // Hour Angle in degrees
    let ha_deg = (lst - ra_hours) * 15.0;
    let ha_rad = deg_to_rad(ha_deg);

    let dec_rad = deg_to_rad(dec_deg);
    let lat_rad = deg_to_rad(lat_deg);

    // Altitude
    let sin_alt = lat_rad.sin() * dec_rad.sin() + lat_rad.cos() * dec_rad.cos() * ha_rad.cos();
    let alt_rad = safe_asin(sin_alt);

    // Azimuth
    let cos_alt = alt_rad.cos();
    let sin_az = -(dec_rad.cos() * ha_rad.sin()) / cos_alt;
    let cos_az = (dec_rad.sin() - lat_rad.sin() * alt_rad.sin()) / (lat_rad.cos() * cos_alt);
    let az_rad = sin_az.atan2(cos_az);

    let alt_deg = rad_to_deg(alt_rad);
    let az_deg = normalize_degrees(rad_to_deg(az_rad));

    (alt_deg, az_deg)
}

/// Converts horizontal coordinates (altitude/azimuth) to a unit Vector3
/// in the East-Up-North (EUN) reference frame.
///
/// Convention: East = +X, Up = +Y, North = +Z.
pub fn altaz_to_vector3(alt_deg: f64, az_deg: f64) -> Vector3 {
    let alt_rad = deg_to_rad(alt_deg);
    let az_rad = deg_to_rad(az_deg);

    Vector3::new(
        alt_rad.cos() * az_rad.sin(), // East (X)
        alt_rad.sin(),                 // Up (Y)
        alt_rad.cos() * az_rad.cos(), // North (Z)
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    const EPSILON: f64 = 0.5; // 0.5 degree tolerance for astronomical calculations
    const TIGHT_EPSILON: f64 = 1e-10;

    #[test]
    fn test_altaz_to_vector3_east() {
        let v = altaz_to_vector3(0.0, 90.0);
        assert!((v.x - 1.0).abs() < TIGHT_EPSILON);
        assert!(v.y.abs() < TIGHT_EPSILON);
        assert!(v.z.abs() < TIGHT_EPSILON);
    }

    #[test]
    fn test_altaz_to_vector3_zenith() {
        let v = altaz_to_vector3(90.0, 0.0);
        assert!(v.x.abs() < TIGHT_EPSILON);
        assert!((v.y - 1.0).abs() < TIGHT_EPSILON);
        assert!(v.z.abs() < TIGHT_EPSILON);
    }

    #[test]
    fn test_altaz_to_vector3_north() {
        let v = altaz_to_vector3(0.0, 0.0);
        assert!(v.x.abs() < TIGHT_EPSILON);
        assert!(v.y.abs() < TIGHT_EPSILON);
        assert!((v.z - 1.0).abs() < TIGHT_EPSILON);
    }

    #[test]
    fn test_altaz_to_vector3_unit_magnitude() {
        let test_cases = [
            (0.0, 0.0),
            (45.0, 90.0),
            (30.0, 270.0),
            (89.0, 180.0),
            (-10.0, 45.0),
        ];
        for (alt, az) in test_cases {
            let v = altaz_to_vector3(alt, az);
            assert!(
                (v.magnitude() - 1.0).abs() < TIGHT_EPSILON,
                "Non-unit vector for alt={alt}, az={az}: mag={}",
                v.magnitude()
            );
        }
    }

    #[test]
    fn test_ra_dec_to_altaz_zenith_object() {
        // An object at the zenith: RA=LST, Dec=latitude
        // NYC: lat=40.7128, lon=-74.006
        // Use a specific time and compute what RA would be at zenith
        let lat = 40.7128;
        let lon = -74.006;
        let unix_ms = 1_704_067_200_000.0; // 2024-01-01 00:00 UTC

        // Compute LST at this moment
        let jd = crate::coordinates::time::unix_to_jd(unix_ms);
        let lst = crate::coordinates::sidereal::compute_lst(jd, lon);

        // Object at RA=LST, Dec=lat should be near zenith
        let (alt, _) = ra_dec_to_altaz(lst, lat, lat, lon, unix_ms);
        assert!(
            (alt - 90.0).abs() < EPSILON,
            "Object at zenith should have alt ~90, got {alt}"
        );
    }

    #[test]
    fn test_ra_dec_to_altaz_azimuth_range() {
        // Azimuth should always be in [0, 360)
        let test_ras = [0.0, 6.0, 12.0, 18.0, 23.99];
        let unix_ms = 1_704_067_200_000.0;
        for ra in test_ras {
            let (_, az) = ra_dec_to_altaz(ra, 20.0, 40.0, -74.0, unix_ms);
            assert!(
                az >= 0.0 && az < 360.0,
                "Azimuth {az} out of range for RA={ra}"
            );
        }
    }
}
