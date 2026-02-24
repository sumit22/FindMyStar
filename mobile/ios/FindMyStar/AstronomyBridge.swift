import Foundation

/// iOS native bridge for the Rust core engine.
/// Links to libfindmystar_core.a via the bridging header.
///
/// Two computation paths:
/// - Engine path (Sun/Moon/Planets): ffi_compute_tracking_object / ffi_compute_rise_set_object
/// - RA/Dec path (Stars/Deep-sky): ffi_compute_tracking_radec / ffi_compute_rise_set
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
    var ra: Double = 0
    var dec: Double = 0
    let err = ffi_compute_position(Int32(objectType), UInt32(objectId), jd, &ra, &dec)
    if err == 0 {
      resolve(["ra": ra, "dec": dec])
    } else {
      reject("CORE_ERROR", "compute_position failed with code \(err)", nil)
    }
  }

  // Engine path: objectType/objectId → alt/az/direction
  @objc func computeTracking(_ objectType: Int, objectId: Int, lat: Double, lon: Double, unixMs: Double,
                              resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_tracking_object(Int32(objectType), UInt32(objectId), lat, lon, unixMs)
    if result.error_code == 0 {
      resolve([
        "altitude": result.altitude,
        "azimuth": result.azimuth,
        "dirX": result.dir_x,
        "dirY": result.dir_y,
        "dirZ": result.dir_z,
      ])
    } else {
      reject("CORE_ERROR", "compute_tracking_object failed with code \(result.error_code)", nil)
    }
  }

  // RA/Dec path: raw coordinates → alt/az/direction
  @objc func computeTrackingRaDec(_ ra: Double, dec: Double, lat: Double, lon: Double, unixMs: Double,
                                   resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_tracking_radec(ra, dec, lat, lon, unixMs)
    resolve([
      "altitude": result.altitude,
      "azimuth": result.azimuth,
      "dirX": result.dir_x,
      "dirY": result.dir_y,
      "dirZ": result.dir_z,
    ])
  }

  // Engine path: objectType/objectId → rise/set times
  @objc func computeRiseSet(_ objectType: Int, objectId: Int, lat: Double, lon: Double, startMs: Double,
                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_rise_set_object(Int32(objectType), UInt32(objectId), lat, lon, startMs)
    resolve(["status": result.status, "riseMs": result.rise_ms, "setMs": result.set_ms])
  }

  // RA/Dec path: raw coordinates → rise/set times
  @objc func computeRiseSetRaDec(_ ra: Double, dec: Double, lat: Double, lon: Double, startMs: Double,
                                  resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let result = ffi_compute_rise_set(ra, dec, lat, lon, startMs)
    resolve(["status": result.status, "riseMs": result.rise_ms, "setMs": result.set_ms])
  }

  @objc func altAzToVector3(_ altitude: Double, azimuth: Double,
                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    var x: Double = 0, y: Double = 0, z: Double = 0
    ffi_altaz_to_vector3(altitude, azimuth, &x, &y, &z)
    resolve(["x": x, "y": y, "z": z])
  }

  @objc func angularDistance(_ x1: Double, y1: Double, z1: Double, x2: Double, y2: Double, z2: Double,
                             resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(ffi_angular_distance(x1, y1, z1, x2, y2, z2))
  }

  @objc func classifyTwilight(_ sunAltitude: Double,
                               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(ffi_classify_twilight(sunAltitude))
  }

  @objc func createEntitlement(_ planType: Int, validUntilMs: Double, deviceId: String,
                                resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let deviceData = deviceId.data(using: .utf8) else {
      reject("CORE_ERROR", "Invalid device ID encoding", nil)
      return
    }
    var outBuf = [UInt8](repeating: 0, count: 57)
    let result = deviceData.withUnsafeBytes { devicePtr -> Int32 in
      let baseAddr = devicePtr.baseAddress!.assumingMemoryBound(to: UInt8.self)
      return ffi_create_entitlement(UInt8(planType), UInt64(validUntilMs), baseAddr, Int32(deviceData.count), &outBuf, 57)
    }
    if result == 0 {
      resolve(Data(outBuf).base64EncodedString())
    } else {
      reject("CORE_ERROR", "create_entitlement failed with code \(result)", nil)
    }
  }

  @objc func checkEntitlement(_ payloadBase64: String, deviceId: String, nowMs: Double,
                               resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    guard let payloadData = Data(base64Encoded: payloadBase64) else {
      reject("CORE_ERROR", "Invalid base64 payload", nil)
      return
    }
    guard let deviceData = deviceId.data(using: .utf8) else {
      reject("CORE_ERROR", "Invalid device ID encoding", nil)
      return
    }
    let result = payloadData.withUnsafeBytes { payloadPtr -> Int32 in
      let pBase = payloadPtr.baseAddress!.assumingMemoryBound(to: UInt8.self)
      return deviceData.withUnsafeBytes { devicePtr -> Int32 in
        let dBase = devicePtr.baseAddress!.assumingMemoryBound(to: UInt8.self)
        return ffi_check_entitlement(pBase, Int32(payloadData.count), dBase, Int32(deviceData.count), UInt64(nowMs))
      }
    }
    resolve(result)
  }

  @objc func coreVersion(_ resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let ptr = ffi_core_version()
    resolve(String(cString: ptr!))
  }
}
