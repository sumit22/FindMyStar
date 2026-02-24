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

export function start(): void {
  if (accelSub) {
    return; // already running
  }

  // Set update intervals
  AccNative?.setUpdateInterval(UPDATE_INTERVAL_MS);
  GyroNative?.setUpdateInterval(UPDATE_INTERVAL_MS);
  MagNative?.setUpdateInterval(UPDATE_INTERVAL_MS);

  if (AccNative) {
    const emitter = new NativeEventEmitter(AccNative);
    accelSub = emitter.addListener(
      'RNSensorsAccelerometer',
      (data: { x: number; y: number; z: number; timestamp: number }) => {
        SensorFusion.feedAccelerometer(data);
      },
    );
    AccNative.startUpdates();
  }

  if (GyroNative) {
    const emitter = new NativeEventEmitter(GyroNative);
    gyroSub = emitter.addListener(
      'RNSensorsGyroscope',
      (data: { x: number; y: number; z: number; timestamp: number }) => {
        SensorFusion.feedGyroscope(data);
      },
    );
    GyroNative.startUpdates();
  }

  if (MagNative) {
    const emitter = new NativeEventEmitter(MagNative);
    magSub = emitter.addListener(
      'RNSensorsMagnetometer',
      (data: { x: number; y: number; z: number; timestamp: number }) => {
        SensorFusion.feedMagnetometer(data);
      },
    );
    MagNative.startUpdates();
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
}
