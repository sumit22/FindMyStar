use crate::coordinates::transforms::{altaz_to_vector3, ra_dec_to_altaz};
use crate::entitlement;
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

/// FFI result for object tracking: altitude, azimuth, and direction vector.
/// Used by iOS bridge for computeTracking / computeTrackingRaDec.
#[repr(C)]
pub struct FfiObjectTrackingResult {
    pub altitude: f64,
    pub azimuth: f64,
    pub dir_x: f64,
    pub dir_y: f64,
    pub dir_z: f64,
    pub error_code: i32,
}

// Error codes
const OK: i32 = 0;
const ERR_INVALID_INPUT: i32 = -1;
const ERR_NOT_FOUND: i32 = -2;

/// Computes altitude and azimuth for an equatorial position.
#[no_mangle]
pub extern "C" fn ffi_ra_dec_to_altaz(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    unix_ms: f64,
) -> FfiAltAz {
    let (alt, az) = ra_dec_to_altaz(ra_hours, dec_deg, lat_deg, lon_deg, unix_ms);
    FfiAltAz {
        altitude: alt,
        azimuth: az,
        error_code: OK,
    }
}

/// Computes the position of a celestial object.
/// object_type: 0=Sun, 1=Moon, 2=Planet, 3=Star
/// object_id: planet_id (1-7) or hip_id for stars
/// Returns RA in hours via out_ra, Dec in degrees via out_dec.
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn ffi_compute_position(
    object_type: i32,
    object_id: u32,
    unix_ms: f64,
    out_ra: *mut f64,
    out_dec: *mut f64,
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
            if !out_ra.is_null() {
                *out_ra = ra;
            }
            if !out_dec.is_null() {
                *out_dec = dec;
            }
            OK
        },
        None => ERR_NOT_FOUND,
    }
}

/// Computes tracking direction from device quaternion to target vector.
#[no_mangle]
pub extern "C" fn ffi_compute_tracking(
    target_x: f64,
    target_y: f64,
    target_z: f64,
    qw: f64,
    qx: f64,
    qy: f64,
    qz: f64,
) -> FfiTrackingResult {
    let target = Vector3::new(target_x, target_y, target_z);
    let q_device = Quaternion::new(qw, qx, qy, qz);
    let (direction, distance) = compute_direction(&target, &q_device);
    FfiTrackingResult {
        direction_deg: direction,
        distance_deg: distance,
        error_code: OK,
    }
}

/// Computes rise/set times for a fixed-coordinate object (star/deep-sky).
#[no_mangle]
pub extern "C" fn ffi_compute_rise_set(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    start_unix_ms: f64,
) -> FfiRiseSetResult {
    match compute_rise_set_analytical(ra_hours, dec_deg, lat_deg, lon_deg, start_unix_ms, None) {
        RiseSetResult::RisesAndSets { rise_ms, set_ms } => FfiRiseSetResult {
            rise_ms,
            set_ms,
            status: 0,
        },
        RiseSetResult::AlwaysVisible => FfiRiseSetResult {
            rise_ms: 0.0,
            set_ms: 0.0,
            status: 1,
        },
        RiseSetResult::NeverVisible => FfiRiseSetResult {
            rise_ms: 0.0,
            set_ms: 0.0,
            status: 2,
        },
    }
}

/// Computes alt/az/direction for an engine-path object (Sun/Moon/Planet/Star by ID).
/// object_type: 0=Sun, 1=Moon, 2=Planet, 3=Star
#[no_mangle]
pub extern "C" fn ffi_compute_tracking_object(
    object_type: i32,
    object_id: u32,
    lat_deg: f64,
    lon_deg: f64,
    unix_ms: f64,
) -> FfiObjectTrackingResult {
    let obj = match object_type {
        0 => ObjectType::Sun,
        1 => ObjectType::Moon,
        2 => ObjectType::Planet(object_id),
        3 => ObjectType::Star(object_id),
        _ => {
            return FfiObjectTrackingResult {
                altitude: f64::NAN,
                azimuth: f64::NAN,
                dir_x: 0.0,
                dir_y: 0.0,
                dir_z: 0.0,
                error_code: ERR_INVALID_INPUT,
            }
        }
    };

    let jd = crate::coordinates::time::unix_to_jd(unix_ms);
    match compute_position(obj, jd) {
        Some((ra, dec)) => {
            let (alt, az) = ra_dec_to_altaz(ra, dec, lat_deg, lon_deg, unix_ms);
            let v = altaz_to_vector3(alt, az);
            FfiObjectTrackingResult {
                altitude: alt,
                azimuth: az,
                dir_x: v.x,
                dir_y: v.y,
                dir_z: v.z,
                error_code: OK,
            }
        }
        None => FfiObjectTrackingResult {
            altitude: f64::NAN,
            azimuth: f64::NAN,
            dir_x: 0.0,
            dir_y: 0.0,
            dir_z: 0.0,
            error_code: ERR_NOT_FOUND,
        },
    }
}

/// Computes alt/az/direction from raw RA/Dec (hours, degrees).
/// Used for stars and deep-sky objects whose coordinates come from the database.
#[no_mangle]
pub extern "C" fn ffi_compute_tracking_radec(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    unix_ms: f64,
) -> FfiObjectTrackingResult {
    let (alt, az) = ra_dec_to_altaz(ra_hours, dec_deg, lat_deg, lon_deg, unix_ms);
    let v = altaz_to_vector3(alt, az);
    FfiObjectTrackingResult {
        altitude: alt,
        azimuth: az,
        dir_x: v.x,
        dir_y: v.y,
        dir_z: v.z,
        error_code: OK,
    }
}

/// Computes rise/set times for an engine-path object (Sun/Moon/Planet/Star by ID).
/// object_type: 0=Sun, 1=Moon, 2=Planet, 3=Star
#[no_mangle]
pub extern "C" fn ffi_compute_rise_set_object(
    object_type: i32,
    object_id: u32,
    lat_deg: f64,
    lon_deg: f64,
    start_unix_ms: f64,
) -> FfiRiseSetResult {
    let obj = match object_type {
        0 => ObjectType::Sun,
        1 => ObjectType::Moon,
        2 => ObjectType::Planet(object_id),
        3 => ObjectType::Star(object_id),
        _ => {
            return FfiRiseSetResult {
                rise_ms: 0.0,
                set_ms: 0.0,
                status: ERR_INVALID_INPUT,
            }
        }
    };

    let jd = crate::coordinates::time::unix_to_jd(start_unix_ms);
    match compute_position(obj, jd) {
        Some((ra, dec)) => {
            match compute_rise_set_analytical(ra, dec, lat_deg, lon_deg, start_unix_ms, None) {
                RiseSetResult::RisesAndSets { rise_ms, set_ms } => FfiRiseSetResult {
                    rise_ms,
                    set_ms,
                    status: 0,
                },
                RiseSetResult::AlwaysVisible => FfiRiseSetResult {
                    rise_ms: 0.0,
                    set_ms: 0.0,
                    status: 1,
                },
                RiseSetResult::NeverVisible => FfiRiseSetResult {
                    rise_ms: 0.0,
                    set_ms: 0.0,
                    status: 2,
                },
            }
        }
        None => FfiRiseSetResult {
            rise_ms: 0.0,
            set_ms: 0.0,
            status: ERR_NOT_FOUND,
        },
    }
}

/// Converts altitude/azimuth to a unit vector in East-Up-North frame.
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn ffi_altaz_to_vector3(
    alt_deg: f64,
    az_deg: f64,
    out_x: *mut f64,
    out_y: *mut f64,
    out_z: *mut f64,
) -> i32 {
    let v = altaz_to_vector3(alt_deg, az_deg);
    unsafe {
        if !out_x.is_null() {
            *out_x = v.x;
        }
        if !out_y.is_null() {
            *out_y = v.y;
        }
        if !out_z.is_null() {
            *out_z = v.z;
        }
    }
    OK
}

/// Returns the angular distance in degrees between two unit vectors.
#[no_mangle]
pub extern "C" fn ffi_angular_distance(
    x1: f64,
    y1: f64,
    z1: f64,
    x2: f64,
    y2: f64,
    z2: f64,
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

/// Creates a signed entitlement blob (57 bytes) bound to a device.
///
/// - `plan_type`: 0=Free, 1=Lifetime, 2=Subscription
/// - `valid_until_ms`: expiry in unix ms (0 = no expiry for Lifetime)
/// - `device_id_ptr`/`device_id_len`: raw device identifier bytes (hashed internally)
/// - `out_buf`: output buffer (must be >= 57 bytes)
/// - `buf_len`: size of output buffer
///
/// Returns 0 on success, -1 on invalid plan type, -2 on buffer too small, -3 on null pointer.
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn ffi_create_entitlement(
    plan_type: u8,
    valid_until_ms: u64,
    device_id_ptr: *const u8,
    device_id_len: i32,
    out_buf: *mut u8,
    buf_len: i32,
) -> i32 {
    if device_id_ptr.is_null() || out_buf.is_null() {
        return -3;
    }
    if (buf_len as usize) < entitlement::ENTITLEMENT_SIZE {
        return ERR_NOT_FOUND; // -2 = buffer too small
    }
    let device_id = unsafe { core::slice::from_raw_parts(device_id_ptr, device_id_len as usize) };
    let device_hash = entitlement::hash_device_id(device_id);

    match entitlement::create_entitlement(plan_type, valid_until_ms, &device_hash) {
        Some(blob) => {
            unsafe {
                core::ptr::copy_nonoverlapping(blob.as_ptr(), out_buf, blob.len());
            }
            OK
        }
        None => ERR_INVALID_INPUT,
    }
}

/// Verifies an entitlement blob and checks if pro is active.
///
/// - `buf`/`buf_len`: the 57-byte entitlement blob
/// - `device_id_ptr`/`device_id_len`: current device identifier (hashed internally)
/// - `now_ms`: current unix time in milliseconds
///
/// Returns: 1 = pro active, 0 = not pro (expired/Free), -1 = invalid signature or device mismatch, -2 = invalid input
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn ffi_check_entitlement(
    buf: *const u8,
    buf_len: i32,
    device_id_ptr: *const u8,
    device_id_len: i32,
    now_ms: u64,
) -> i32 {
    if buf.is_null() || device_id_ptr.is_null() {
        return ERR_NOT_FOUND; // -2
    }
    let payload = unsafe { core::slice::from_raw_parts(buf, buf_len as usize) };
    let device_id = unsafe { core::slice::from_raw_parts(device_id_ptr, device_id_len as usize) };
    let device_hash = entitlement::hash_device_id(device_id);

    match entitlement::verify_and_decode(payload, &device_hash) {
        Some(ent) => {
            if entitlement::is_pro(&ent, now_ms) {
                1
            } else {
                0
            }
        }
        None => ERR_INVALID_INPUT, // -1 = invalid signature or device mismatch
    }
}

/// Hashes a device identifier into a 16-byte truncated SHA-256.
/// Useful for platform layers that need the device hash for display or debugging.
///
/// Returns 0 on success, -1 on null pointer, -2 on output buffer too small.
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn ffi_hash_device_id(
    device_id_ptr: *const u8,
    device_id_len: i32,
    out_buf: *mut u8,
    buf_len: i32,
) -> i32 {
    if device_id_ptr.is_null() || out_buf.is_null() {
        return ERR_INVALID_INPUT;
    }
    if (buf_len as usize) < entitlement::DEVICE_HASH_SIZE {
        return ERR_NOT_FOUND;
    }
    let device_id = unsafe { core::slice::from_raw_parts(device_id_ptr, device_id_len as usize) };
    let hash = entitlement::hash_device_id(device_id);
    unsafe {
        core::ptr::copy_nonoverlapping(hash.as_ptr(), out_buf, hash.len());
    }
    OK
}

/// Returns the engine version string.
#[no_mangle]
pub extern "C" fn ffi_core_version() -> *const u8 {
    c"0.1.0".as_ptr().cast()
}
