/**
 * SensorFusionService - Provides device orientation as quaternion.
 *
 * Uses a complementary filter fusing accelerometer/magnetometer (2%) with
 * gyroscope (98%) for smooth, drift-free orientation tracking at 30+ Hz.
 *
 * Note: Actual sensor access requires react-native-sensors or equivalent.
 * This module defines the interface and filter logic; sensor bindings are
 * injected at initialization to keep this testable.
 */

export interface Quaternion {
  w: number;
  x: number;
  y: number;
  z: number;
}

export interface SensorData {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

type OrientationCallback = (q: Quaternion) => void;

const GYRO_WEIGHT = 0.98;
const ACCEL_WEIGHT = 1.0 - GYRO_WEIGHT;

let running = false;
let currentOrientation: Quaternion = { w: 1, x: 0, y: 0, z: 0 };
let listeners: OrientationCallback[] = [];
let animFrameId: number | null = null;
let lastGyroTimestamp = 0;

// Accumulated sensor readings (latest)
let latestAccel: SensorData | null = null;
let latestGyro: SensorData | null = null;
let latestMag: SensorData | null = null;

function normalize(q: Quaternion): Quaternion {
  const mag = Math.sqrt(q.w * q.w + q.x * q.x + q.y * q.y + q.z * q.z);
  if (mag < 1e-10) return { w: 1, x: 0, y: 0, z: 0 };
  return { w: q.w / mag, x: q.x / mag, y: q.y / mag, z: q.z / mag };
}

function multiplyQuat(a: Quaternion, b: Quaternion): Quaternion {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

function slerp(a: Quaternion, b: Quaternion, t: number): Quaternion {
  let dot = a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z;
  if (dot < 0) {
    b = { w: -b.w, x: -b.x, y: -b.y, z: -b.z };
    dot = -dot;
  }
  if (dot > 0.9995) {
    return normalize({
      w: a.w + t * (b.w - a.w),
      x: a.x + t * (b.x - a.x),
      y: a.y + t * (b.y - a.y),
      z: a.z + t * (b.z - a.z),
    });
  }
  const theta = Math.acos(dot);
  const sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - t) * theta) / sinTheta;
  const wb = Math.sin(t * theta) / sinTheta;
  return {
    w: wa * a.w + wb * b.w,
    x: wa * a.x + wb * b.x,
    y: wa * a.y + wb * b.y,
    z: wa * a.z + wb * b.z,
  };
}

function gyroIntegrate(q: Quaternion, gyro: SensorData, dt: number): Quaternion {
  const halfDt = dt * 0.5;
  const dq: Quaternion = {
    w: 1,
    x: gyro.x * halfDt,
    y: gyro.y * halfDt,
    z: gyro.z * halfDt,
  };
  return normalize(multiplyQuat(q, dq));
}

function accelMagToQuat(accel: SensorData, mag: SensorData): Quaternion {
  // Simplified tilt-compensated compass orientation
  const ax = accel.x, ay = accel.y, az = accel.z;
  const norm = Math.sqrt(ax * ax + ay * ay + az * az);
  if (norm < 1e-6) return currentOrientation;

  const pitch = Math.atan2(-ax, Math.sqrt(ay * ay + az * az));
  const roll = Math.atan2(ay, az);

  const mx = mag.x, my = mag.y, mz = mag.z;
  const xh = mx * Math.cos(pitch) + mz * Math.sin(pitch);
  const yh = mx * Math.sin(roll) * Math.sin(pitch) + my * Math.cos(roll) - mz * Math.sin(roll) * Math.cos(pitch);
  const yaw = Math.atan2(-yh, xh);

  // Euler to quaternion (ZYX convention)
  const cy = Math.cos(yaw * 0.5), sy = Math.sin(yaw * 0.5);
  const cp = Math.cos(pitch * 0.5), sp = Math.sin(pitch * 0.5);
  const cr = Math.cos(roll * 0.5), sr = Math.sin(roll * 0.5);

  return {
    w: cr * cp * cy + sr * sp * sy,
    x: sr * cp * cy - cr * sp * sy,
    y: cr * sp * cy + sr * cp * sy,
    z: cr * cp * sy - sr * sp * cy,
  };
}

function fusionLoop(): void {
  if (!running) return;

  if (latestGyro && lastGyroTimestamp > 0) {
    const dt = (latestGyro.timestamp - lastGyroTimestamp) / 1000;
    if (dt > 0 && dt < 1) {
      const gyroQ = gyroIntegrate(currentOrientation, latestGyro, dt);

      if (latestAccel && latestMag) {
        const absQ = accelMagToQuat(latestAccel, latestMag);
        currentOrientation = slerp(gyroQ, absQ, ACCEL_WEIGHT);
      } else {
        currentOrientation = gyroQ;
      }
    }
  }
  if (latestGyro) lastGyroTimestamp = latestGyro.timestamp;

  for (const cb of listeners) cb(currentOrientation);
  animFrameId = requestAnimationFrame(fusionLoop);
}

export function start(): void {
  if (running) return;
  running = true;
  lastGyroTimestamp = 0;
  animFrameId = requestAnimationFrame(fusionLoop);
}

export function stop(): void {
  running = false;
  if (animFrameId !== null) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

export function getOrientation(): Quaternion {
  return currentOrientation;
}

export function onOrientationUpdate(callback: OrientationCallback): () => void {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(cb => cb !== callback);
  };
}

// Sensor data injection (called by platform sensor subscriptions)
export function feedAccelerometer(data: SensorData): void { latestAccel = data; }
export function feedGyroscope(data: SensorData): void { latestGyro = data; }
export function feedMagnetometer(data: SensorData): void { latestMag = data; }
