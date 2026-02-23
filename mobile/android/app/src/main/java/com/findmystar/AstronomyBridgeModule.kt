package com.findmystar

import com.facebook.react.bridge.*

/**
 * Android native bridge module for the Rust core engine.
 * Loads libfindmystar_core.so via JNI and exposes FFI functions to React Native.
 */
class AstronomyBridgeModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        init {
            System.loadLibrary("findmystar_core")
        }
    }

    override fun getName() = "FindMyStarCore"

    // JNI declarations mapping to core/src/ffi/exports.rs
    private external fun nativeRaDecToAltAz(ra: Double, dec: Double, lat: Double, lon: Double, unixMs: Double): DoubleArray
    private external fun nativeComputePosition(objectType: Int, objectId: Int, jd: Double): DoubleArray
    private external fun nativeComputeTracking(objectType: Int, objectId: Int, lat: Double, lon: Double, unixMs: Double): DoubleArray
    private external fun nativeComputeRiseSet(objectType: Int, objectId: Int, lat: Double, lon: Double, startMs: Double): DoubleArray
    private external fun nativeAltAzToVector3(alt: Double, az: Double): DoubleArray
    private external fun nativeAngularDistance(x1: Double, y1: Double, z1: Double, x2: Double, y2: Double, z2: Double): Double
    private external fun nativeClassifyTwilight(sunAlt: Double): Int
    private external fun nativeCoreVersion(): String

    @ReactMethod
    fun raDecToAltAz(ra: Double, dec: Double, lat: Double, lon: Double, unixMs: Double, promise: Promise) {
        try {
            val result = nativeRaDecToAltAz(ra, dec, lat, lon, unixMs)
            val map = Arguments.createMap()
            map.putDouble("altitude", result[0])
            map.putDouble("azimuth", result[1])
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun computePosition(objectType: Int, objectId: Int, jd: Double, promise: Promise) {
        try {
            val result = nativeComputePosition(objectType, objectId, jd)
            val map = Arguments.createMap()
            map.putDouble("ra", result[0])
            map.putDouble("dec", result[1])
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun computeTracking(objectType: Int, objectId: Int, lat: Double, lon: Double, unixMs: Double, promise: Promise) {
        try {
            val result = nativeComputeTracking(objectType, objectId, lat, lon, unixMs)
            val map = Arguments.createMap()
            map.putDouble("altitude", result[0])
            map.putDouble("azimuth", result[1])
            map.putDouble("dirX", result[2])
            map.putDouble("dirY", result[3])
            map.putDouble("dirZ", result[4])
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun computeRiseSet(objectType: Int, objectId: Int, lat: Double, lon: Double, startMs: Double, promise: Promise) {
        try {
            val result = nativeComputeRiseSet(objectType, objectId, lat, lon, startMs)
            val map = Arguments.createMap()
            map.putInt("status", result[0].toInt())
            map.putDouble("riseMs", result[1])
            map.putDouble("setMs", result[2])
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun altAzToVector3(altitude: Double, azimuth: Double, promise: Promise) {
        try {
            val result = nativeAltAzToVector3(altitude, azimuth)
            val map = Arguments.createMap()
            map.putDouble("x", result[0])
            map.putDouble("y", result[1])
            map.putDouble("z", result[2])
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun angularDistance(x1: Double, y1: Double, z1: Double, x2: Double, y2: Double, z2: Double, promise: Promise) {
        try {
            promise.resolve(nativeAngularDistance(x1, y1, z1, x2, y2, z2))
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun classifyTwilight(sunAltitude: Double, promise: Promise) {
        try {
            promise.resolve(nativeClassifyTwilight(sunAltitude))
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun coreVersion(promise: Promise) {
        try {
            promise.resolve(nativeCoreVersion())
        } catch (e: Exception) {
            promise.reject("CORE_ERROR", e.message)
        }
    }
}
