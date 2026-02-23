use crate::coordinates::transforms::{altaz_to_vector3, ra_dec_to_altaz};
use crate::ephemeris::{compute_position, ObjectType};
use crate::math::utils::{angular_distance, compute_direction};
use crate::math::{Quaternion, Vector3};
use crate::visibility::rise_set::{compute_rise_set_analytical, RiseSetResult};
use crate::visibility::twilight::classify_twilight;

/// FFI result for altitude/azimuth computation.
#[repr(C)]
pub struct FfiAltAz {
    pub altitude: f64,
    pub azimuth: f64,
    pub error_code: i32,
}

/// FFI result for tracking direction computation.
#[repr(C)]
pub struct FfiTrackingResult {
    pub direction_deg: f64,
    pub distance_deg: f64,
    pub error_code: i32,
}

/// FFI result for rise/set times.
#[repr(C)]
pub struct FfiRiseSetResult {
    pub rise_ms: f64,
    pub set_ms: f64,
    pub status: i32, // 0=rises/sets, 1=always visible, 2=never visible, -1=error
}

// Error codes
const OK: i32 = 0;
const ERR_INVALID_INPUT: i32 = -1;
const ERR_NOT_FOUND: i32 = -2;

/// Computes altitude and azimuth for an equatorial position.
#[no_mangle]
pub extern "C" fn ffi_ra_dec_to_altaz(
    ra_hours: f64, dec_deg: f64, lat_deg: f64, lon_deg: f64, unix_ms: f64,
) -> FfiAltAz {
    let (alt, az) = ra_dec_to_altaz(ra_hours, dec_deg, lat_deg, lon_deg, unix_ms);
    FfiAltAz { altitude: alt, azimuth: az, error_code: OK }
}

/// Computes the position of a celestial object.
/// object_type: 0=Sun, 1=Moon, 2=Planet, 3=Star
/// object_id: planet_id (1-7) or hip_id for stars
/// Returns RA in hours via out_ra, Dec in degrees via out_dec.
#[no_mangle]
pub extern "C" fn ffi_compute_position(
    object_type: i32, object_id: u32, unix_ms: f64,
    out_ra: *mut f64, out_dec: *mut f64,
) -> i32 {
    let obj = match object_type {
        0 => ObjectType::Sun,
        1 => ObjectType::Moon,
        2 => ObjectType::Planet(object_id),
        3 => ObjectType::Star(object_id),
        _ => return ERR_INVALID_INPUT,
    };

    let jd = crate::coordinates::time::unix_to_jd(unix_ms);
    match compute_position(obj, jd) {
        Some((ra, dec)) => unsafe {
            if !out_ra.is_null() { *out_ra = ra; }
            if !out_dec.is_null() { *out_dec = dec; }
            OK
        },
        None => ERR_NOT_FOUND,
    }
}

/// Computes tracking direction from device quaternion to target vector.
#[no_mangle]
pub extern "C" fn ffi_compute_tracking(
    target_x: f64, target_y: f64, target_z: f64,
    qw: f64, qx: f64, qy: f64, qz: f64,
) -> FfiTrackingResult {
    let target = Vector3::new(target_x, target_y, target_z);
    let q_device = Quaternion::new(qw, qx, qy, qz);
    let (direction, distance) = compute_direction(&target, &q_device);
    FfiTrackingResult { direction_deg: direction, distance_deg: distance, error_code: OK }
}

/// Computes rise/set times for a fixed-coordinate object (star/deep-sky).
#[no_mangle]
pub extern "C" fn ffi_compute_rise_set(
    ra_hours: f64, dec_deg: f64, lat_deg: f64, lon_deg: f64, start_unix_ms: f64,
) -> FfiRiseSetResult {
    match compute_rise_set_analytical(ra_hours, dec_deg, lat_deg, lon_deg, start_unix_ms, None) {
        RiseSetResult::RisesAndSets { rise_ms, set_ms } => {
            FfiRiseSetResult { rise_ms, set_ms, status: 0 }
        }
        RiseSetResult::AlwaysVisible => {
            FfiRiseSetResult { rise_ms: 0.0, set_ms: 0.0, status: 1 }
        }
        RiseSetResult::NeverVisible => {
            FfiRiseSetResult { rise_ms: 0.0, set_ms: 0.0, status: 2 }
        }
    }
}

/// Converts altitude/azimuth to a unit vector in East-Up-North frame.
#[no_mangle]
pub extern "C" fn ffi_altaz_to_vector3(
    alt_deg: f64, az_deg: f64, out_x: *mut f64, out_y: *mut f64, out_z: *mut f64,
) -> i32 {
    let v = altaz_to_vector3(alt_deg, az_deg);
    unsafe {
        if !out_x.is_null() { *out_x = v.x; }
        if !out_y.is_null() { *out_y = v.y; }
        if !out_z.is_null() { *out_z = v.z; }
    }
    OK
}

/// Returns the angular distance in degrees between two unit vectors.
#[no_mangle]
pub extern "C" fn ffi_angular_distance(
    x1: f64, y1: f64, z1: f64, x2: f64, y2: f64, z2: f64,
) -> f64 {
    let v1 = Vector3::new(x1, y1, z1);
    let v2 = Vector3::new(x2, y2, z2);
    angular_distance(&v1, &v2)
}

/// Returns twilight classification for a given Sun altitude.
/// 0=Day, 1=CivilTwilight, 2=NauticalTwilight, 3=AstronomicalTwilight, 4=Night
#[no_mangle]
pub extern "C" fn ffi_classify_twilight(sun_alt_deg: f64) -> i32 {
    match classify_twilight(sun_alt_deg) {
        crate::visibility::twilight::TwilightState::Day => 0,
        crate::visibility::twilight::TwilightState::CivilTwilight => 1,
        crate::visibility::twilight::TwilightState::NauticalTwilight => 2,
        crate::visibility::twilight::TwilightState::AstronomicalTwilight => 3,
        crate::visibility::twilight::TwilightState::Night => 4,
    }
}

/// Returns the engine version string.
#[no_mangle]
pub extern "C" fn ffi_core_version() -> *const u8 {
    b"0.1.0\0".as_ptr()
}
