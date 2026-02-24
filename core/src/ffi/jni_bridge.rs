/// JNI bridge for Android - maps Kotlin `external fun` declarations in
/// `com.findmystar.AstronomyBridgeModule` to internal Rust computation functions.
///
/// Safety: All functions use helper macros to catch panics and convert JNI
/// errors into null returns (which Kotlin sees as exceptions), avoiding
/// process abort from `panic = "abort"`.
use jni::objects::{JByteArray, JClass, JString};
use jni::sys::{jbyteArray, jdouble, jdoubleArray, jint, jlong, jstring};
use jni::JNIEnv;

use crate::coordinates::time::unix_to_jd;
use crate::coordinates::transforms::{altaz_to_vector3, ra_dec_to_altaz};
use crate::entitlement;
use crate::ephemeris::{compute_position, ObjectType};
use crate::math::utils::angular_distance;
use crate::math::Vector3;
use crate::visibility::rise_set::{compute_rise_set_analytical, RiseSetResult};
use crate::visibility::twilight::classify_twilight;

fn map_object_type(object_type: jint, object_id: jint) -> Option<ObjectType> {
    if object_id < 0 && (object_type == 2 || object_type == 3) {
        return None; // Reject negative IDs for Planet/Star
    }
    match object_type {
        0 => Some(ObjectType::Sun),
        1 => Some(ObjectType::Moon),
        2 => Some(ObjectType::Planet(object_id as u32)),
        3 => Some(ObjectType::Star(object_id as u32)),
        _ => None,
    }
}

/// Helper: create a jdoubleArray and populate it, returning null on failure.
/// This avoids .unwrap() which would abort the process with panic="abort".
fn make_double_array(env: &mut JNIEnv, values: &[f64]) -> jdoubleArray {
    let arr = match env.new_double_array(values.len() as i32) {
        Ok(a) => a,
        Err(_) => return std::ptr::null_mut(),
    };
    if env.set_double_array_region(&arr, 0, values).is_err() {
        return std::ptr::null_mut();
    }
    arr.into_raw()
}

/// nativeRaDecToAltAz(ra, dec, lat, lon, unixMs) -> [altitude, azimuth]
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeRaDecToAltAz(
    mut env: JNIEnv,
    _class: JClass,
    ra: jdouble,
    dec: jdouble,
    lat: jdouble,
    lon: jdouble,
    unix_ms: jdouble,
) -> jdoubleArray {
    let (alt, az) = ra_dec_to_altaz(ra, dec, lat, lon, unix_ms);
    make_double_array(&mut env, &[alt, az])
}

/// nativeComputePosition(objectType, objectId, jd) -> [ra, dec]
/// Returns [NaN, NaN] for invalid object type/id to signal error.
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeComputePosition(
    mut env: JNIEnv,
    _class: JClass,
    object_type: jint,
    object_id: jint,
    jd: jdouble,
) -> jdoubleArray {
    let obj = map_object_type(object_type, object_id);
    let (ra, dec) = obj
        .and_then(|o| compute_position(o, jd))
        .unwrap_or((f64::NAN, f64::NAN));
    make_double_array(&mut env, &[ra, dec])
}

/// nativeComputeTracking(objectType, objectId, lat, lon, unixMs) -> [altitude, azimuth, dirX, dirY, dirZ]
/// Returns [NaN, NaN, 0, 0, 0] for invalid object type/id to signal error.
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeComputeTracking(
    mut env: JNIEnv,
    _class: JClass,
    object_type: jint,
    object_id: jint,
    lat: jdouble,
    lon: jdouble,
    unix_ms: jdouble,
) -> jdoubleArray {
    let obj = map_object_type(object_type, object_id);
    let jd = unix_to_jd(unix_ms);
    let (alt, az, dir) = match obj.and_then(|o| compute_position(o, jd)) {
        Some((ra, dec)) => {
            let (alt, az) = ra_dec_to_altaz(ra, dec, lat, lon, unix_ms);
            let v = altaz_to_vector3(alt, az);
            (alt, az, v)
        }
        None => (f64::NAN, f64::NAN, Vector3::new(0.0, 0.0, 0.0)),
    };
    make_double_array(&mut env, &[alt, az, dir.x, dir.y, dir.z])
}

/// nativeComputeRiseSet(objectType, objectId, lat, lon, startMs) -> [status, riseMs, setMs]
/// status: 0=rises/sets, 1=always visible, 2=never visible, -1=error
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeComputeRiseSet(
    mut env: JNIEnv,
    _class: JClass,
    object_type: jint,
    object_id: jint,
    lat: jdouble,
    lon: jdouble,
    start_ms: jdouble,
) -> jdoubleArray {
    let obj = map_object_type(object_type, object_id);
    let jd = unix_to_jd(start_ms);
    let (status, rise_ms, set_ms) = match obj.and_then(|o| compute_position(o, jd)) {
        Some((ra, dec)) => match compute_rise_set_analytical(ra, dec, lat, lon, start_ms, None) {
            RiseSetResult::RisesAndSets { rise_ms, set_ms } => (0.0, rise_ms, set_ms),
            RiseSetResult::AlwaysVisible => (1.0, 0.0, 0.0),
            RiseSetResult::NeverVisible => (2.0, 0.0, 0.0),
        },
        None => (-1.0, 0.0, 0.0),
    };
    make_double_array(&mut env, &[status, rise_ms, set_ms])
}

/// nativeComputeTrackingRaDec(ra, dec, lat, lon, unixMs) -> [altitude, azimuth, dirX, dirY, dirZ]
/// Same as nativeComputeTracking but takes raw RA/Dec (hours, degrees) instead of objectType/objectId.
/// Used for stars and deep-sky objects whose coordinates come from the database.
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeComputeTrackingRaDec(
    mut env: JNIEnv,
    _class: JClass,
    ra: jdouble,
    dec: jdouble,
    lat: jdouble,
    lon: jdouble,
    unix_ms: jdouble,
) -> jdoubleArray {
    let (alt, az) = ra_dec_to_altaz(ra, dec, lat, lon, unix_ms);
    let v = altaz_to_vector3(alt, az);
    make_double_array(&mut env, &[alt, az, v.x, v.y, v.z])
}

/// nativeComputeRiseSetRaDec(ra, dec, lat, lon, startMs) -> [status, riseMs, setMs]
/// Same as nativeComputeRiseSet but takes raw RA/Dec (hours, degrees) instead of objectType/objectId.
/// Used for stars and deep-sky objects whose coordinates come from the database.
/// status: 0=rises/sets, 1=always visible, 2=never visible
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeComputeRiseSetRaDec(
    mut env: JNIEnv,
    _class: JClass,
    ra: jdouble,
    dec: jdouble,
    lat: jdouble,
    lon: jdouble,
    start_ms: jdouble,
) -> jdoubleArray {
    let (status, rise_ms, set_ms) =
        match compute_rise_set_analytical(ra, dec, lat, lon, start_ms, None) {
            RiseSetResult::RisesAndSets { rise_ms, set_ms } => (0.0, rise_ms, set_ms),
            RiseSetResult::AlwaysVisible => (1.0, 0.0, 0.0),
            RiseSetResult::NeverVisible => (2.0, 0.0, 0.0),
        };
    make_double_array(&mut env, &[status, rise_ms, set_ms])
}

/// nativeAltAzToVector3(alt, az) -> [x, y, z]
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeAltAzToVector3(
    mut env: JNIEnv,
    _class: JClass,
    alt: jdouble,
    az: jdouble,
) -> jdoubleArray {
    let v = altaz_to_vector3(alt, az);
    make_double_array(&mut env, &[v.x, v.y, v.z])
}

/// nativeAngularDistance(x1, y1, z1, x2, y2, z2) -> double
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeAngularDistance(
    _env: JNIEnv,
    _class: JClass,
    x1: jdouble,
    y1: jdouble,
    z1: jdouble,
    x2: jdouble,
    y2: jdouble,
    z2: jdouble,
) -> jdouble {
    let v1 = Vector3::new(x1, y1, z1);
    let v2 = Vector3::new(x2, y2, z2);
    angular_distance(&v1, &v2)
}

/// nativeClassifyTwilight(sunAlt) -> int
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeClassifyTwilight(
    _env: JNIEnv,
    _class: JClass,
    sun_alt: jdouble,
) -> jint {
    match classify_twilight(sun_alt) {
        crate::visibility::twilight::TwilightState::Day => 0,
        crate::visibility::twilight::TwilightState::CivilTwilight => 1,
        crate::visibility::twilight::TwilightState::NauticalTwilight => 2,
        crate::visibility::twilight::TwilightState::AstronomicalTwilight => 3,
        crate::visibility::twilight::TwilightState::Night => 4,
    }
}

/// nativeCreateEntitlement(planType, validUntilMs, deviceId) -> byte[57]
/// Creates an HMAC-signed entitlement blob bound to the given device.
/// Returns null on invalid plan type.
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeCreateEntitlement(
    mut env: JNIEnv,
    _class: JClass,
    plan_type: jint,
    valid_until_ms: jlong,
    device_id: JString,
) -> jbyteArray {
    // Get device ID string
    let device_str = match env.get_string(&device_id) {
        Ok(s) => s,
        Err(_) => return std::ptr::null_mut(),
    };
    let device_bytes = device_str.to_bytes();
    let device_hash = entitlement::hash_device_id(device_bytes);

    match entitlement::create_entitlement(plan_type as u8, valid_until_ms as u64, &device_hash) {
        Some(blob) => {
            let arr = match env.new_byte_array(blob.len() as i32) {
                Ok(a) => a,
                Err(_) => return std::ptr::null_mut(),
            };
            // Convert u8 slice to i8 slice for JNI
            let signed: Vec<i8> = blob.iter().map(|&b| b as i8).collect();
            if env.set_byte_array_region(&arr, 0, &signed).is_err() {
                return std::ptr::null_mut();
            }
            arr.into_raw()
        }
        None => std::ptr::null_mut(),
    }
}

/// nativeCheckEntitlement(payload, deviceId, nowMs) -> int
/// Verifies the entitlement blob against the device and checks pro status.
/// Returns: 1=pro active, 0=not pro, -1=invalid signature/device, -2=invalid input
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeCheckEntitlement(
    mut env: JNIEnv,
    _class: JClass,
    payload: JByteArray,
    device_id: JString,
    now_ms: jlong,
) -> jint {
    // Get payload bytes
    let payload_bytes = match env.convert_byte_array(&payload) {
        Ok(b) => b,
        Err(_) => return -2,
    };

    // Get device ID string
    let device_str = match env.get_string(&device_id) {
        Ok(s) => s,
        Err(_) => return -2,
    };
    let device_bytes = device_str.to_bytes();
    let device_hash = entitlement::hash_device_id(device_bytes);

    match entitlement::verify_and_decode(&payload_bytes, &device_hash) {
        Some(ent) => {
            if entitlement::is_pro(&ent, now_ms as u64) {
                1
            } else {
                0
            }
        }
        None => -1,
    }
}

/// nativeCoreVersion() -> String
#[no_mangle]
pub extern "system" fn Java_com_findmystar_AstronomyBridgeModule_nativeCoreVersion(
    env: JNIEnv,
    _class: JClass,
) -> jstring {
    match env.new_string("0.1.0") {
        Ok(s) => s.into_raw(),
        Err(_) => std::ptr::null_mut(),
    }
}
