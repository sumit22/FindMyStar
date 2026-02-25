/**
 * SensorBindings - Wires native sensor modules to SensorFusionService.
 *
 * Uses the native modules from react-native-sensors directly via
 * NativeEventEmitter, bypassing the RxJS layer that breaks Metro.
 */

import { NativeEventEmitter, NativeModules } from 'react-native';
import type { EmitterSubscription } from 'react-native';
import * as SensorFusion from './SensorFusionService';

const {
  RNSensorsAccelerometer: AccNative,
  RNSensorsGyroscope: GyroNative,
  RNSensorsMagnetometer: MagNative,
} = NativeModules;

const UPDATE_INTERVAL_MS = 33; // ~30 Hz

let accelSub: EmitterSubscription | null = null;
let gyroSub: EmitterSubscription | null = null;
let magSub: EmitterSubscription | null = null;

/** Sensor availability flags — populated after start(). */
let sensorStatus = { accel: false, gyro: false, mag: false };

/** Returns which sensors are actively providing data. */
export function getSensorStatus(): { accel: boolean; gyro: boolean; mag: boolean } {
  return { ...sensorStatus };
}

/** Checks if the minimum required native sensor modules are available. */
export function hasMinimumSensors(): boolean {
  return AccNative != null && GyroNative != null;
}

/** Validates a sensor reading. Rejects NaN, Infinity, and extreme values. */
function isValidReading(data: { x: number; y: number; z: number; timestamp: number }): boolean {
  return (
    Number.isFinite(data.x) &&
    Number.isFinite(data.y) &&
    Number.isFinite(data.z) &&
    Number.isFinite(data.timestamp) &&
    data.timestamp > 0 &&
    Math.abs(data.x) < 1000 &&
    Math.abs(data.y) < 1000 &&
    Math.abs(data.z) < 1000
  );
}

export function start(): void {
  if (accelSub) {
    return; // already running
  }

  sensorStatus = { accel: false, gyro: false, mag: false };

  // Set update intervals
  AccNative?.setUpdateInterval(UPDATE_INTERVAL_MS);
  GyroNative?.setUpdateInterval(UPDATE_INTERVAL_MS);
  MagNative?.setUpdateInterval(UPDATE_INTERVAL_MS);

  if (AccNative) {
    try {
      const emitter = new NativeEventEmitter(AccNative);
      accelSub = emitter.addListener(
        'RNSensorsAccelerometer',
        (data: { x: number; y: number; z: number; timestamp: number }) => {
          if (isValidReading(data)) {
            sensorStatus.accel = true;
            SensorFusion.feedAccelerometer(data);
          }
        },
      );
      AccNative.startUpdates();
    } catch (e) {
      console.warn('[SensorBindings] Accelerometer unavailable:', e);
    }
  } else {
    console.warn('[SensorBindings] Accelerometer native module not found');
  }

  if (GyroNative) {
    try {
      const emitter = new NativeEventEmitter(GyroNative);
      gyroSub = emitter.addListener(
        'RNSensorsGyroscope',
        (data: { x: number; y: number; z: number; timestamp: number }) => {
          if (isValidReading(data)) {
            sensorStatus.gyro = true;
            SensorFusion.feedGyroscope(data);
          }
        },
      );
      GyroNative.startUpdates();
    } catch (e) {
      console.warn('[SensorBindings] Gyroscope unavailable:', e);
    }
  } else {
    console.warn('[SensorBindings] Gyroscope native module not found');
  }

  if (MagNative) {
    try {
      const emitter = new NativeEventEmitter(MagNative);
      magSub = emitter.addListener(
        'RNSensorsMagnetometer',
        (data: { x: number; y: number; z: number; timestamp: number }) => {
          if (isValidReading(data)) {
            sensorStatus.mag = true;
            SensorFusion.feedMagnetometer(data);
          }
        },
      );
      MagNative.startUpdates();
    } catch (e) {
      console.warn('[SensorBindings] Magnetometer unavailable:', e);
    }
  } else {
    console.warn('[SensorBindings] Magnetometer native module not found');
  }
}

export function stop(): void {
  accelSub?.remove();
  gyroSub?.remove();
  magSub?.remove();
  accelSub = null;
  gyroSub = null;
  magSub = null;

  AccNative?.stopUpdates();
  GyroNative?.stopUpdates();
  MagNative?.stopUpdates();

  sensorStatus = { accel: false, gyro: false, mag: false };
}
