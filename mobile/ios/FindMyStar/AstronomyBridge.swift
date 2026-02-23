import Foundation

/// iOS native bridge for the Rust core engine.
/// Links to libfindmystar_core.a via the bridging header.
@objc(FindMyStarCore)
class AstronomyBridge: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { false }

  @objc func raDecToAltAz(_ ra: Double, dec: Double, lat: Double, lon: Double, unixMs: Double,
                           resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_ra_dec_to_altaz(ra, dec, lat, lon, unixMs)
    resolve(["altitude": result.altitude, "azimuth": result.azimuth])
  }

  @objc func computePosition(_ objectType: Int, objectId: Int, jd: Double,
                              resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_position(Int32(objectType), UInt32(objectId), jd)
    resolve(["ra": result.ra, "dec": result.dec])
  }

  @objc func computeTracking(_ objectType: Int, objectId: Int, lat: Double, lon: Double, unixMs: Double,
                              resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_tracking(Int32(objectType), UInt32(objectId), lat, lon, unixMs)
    resolve([
      "altitude": result.alt_az.altitude,
      "azimuth": result.alt_az.azimuth,
      "dirX": result.dir_x,
      "dirY": result.dir_y,
      "dirZ": result.dir_z,
    ])
  }

  @objc func computeRiseSet(_ objectType: Int, objectId: Int, lat: Double, lon: Double, startMs: Double,
                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_rise_set(Int32(objectType), UInt32(objectId), lat, lon, startMs)
    resolve(["status": result.status, "riseMs": result.rise_ms, "setMs": result.set_ms])
  }

  @objc func altAzToVector3(_ altitude: Double, azimuth: Double,
                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_altaz_to_vector3(altitude, azimuth)
    resolve(["x": result.x, "y": result.y, "z": result.z])
  }

  @objc func angularDistance(_ x1: Double, y1: Double, z1: Double, x2: Double, y2: Double, z2: Double,
                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(ffi_angular_distance(x1, y1, z1, x2, y2, z2))
  }

  @objc func classifyTwilight(_ sunAltitude: Double,
                               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(ffi_classify_twilight(sunAltitude))
  }

  @objc func coreVersion(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let ptr = ffi_core_version()
    resolve(String(cString: ptr!))
  }
}
