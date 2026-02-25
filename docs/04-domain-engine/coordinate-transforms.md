# Coordinate System Transformations

## 1. Coordinate Systems Used

FindMyStar works with four coordinate systems. Every transformation between them is a pure function implemented in `coordinates/transforms.rs`.

### 1.1 Equatorial Coordinates (RA, Dec)

The **equatorial system** is fixed relative to the celestial sphere and is the native output of ephemeris calculations.

- **Right Ascension (RA)**: 0 to 24 hours, measured eastward along the celestial equator from the vernal equinox.
- **Declination (Dec)**: -90 to +90 degrees, measured north (+) or south (-) from the celestial equator.

Equatorial coordinates are independent of the observer's location. A star's RA/Dec changes only due to precession and proper motion (both negligible over short time spans).

### 1.2 Horizontal Coordinates (Alt, Az)

The **horizontal system** is relative to the observer's local horizon.

- **Altitude (Alt)**: -90 to +90 degrees. 0 = horizon, +90 = zenith, negative = below horizon.
- **Azimuth (Az)**: 0 to 360 degrees. 0 = North, 90 = East, 180 = South, 270 = West.

Horizontal coordinates depend on the observer's geographic location and the current time (because Earth rotates).

### 1.3 Cartesian Coordinates (x, y, z)

A **3D unit vector** in a right-handed Earth-frame coordinate system:

- **X = East**: positive toward geographic East
- **Y = Up**: positive toward the zenith
- **Z = North**: positive toward geographic North

This frame is used for angular distance calculations and for interfacing with device sensor data.

### 1.4 Device Frame

The **device frame** is defined by the phone's orientation quaternion as reported by the IMU sensor fusion algorithm. The camera's forward direction is mapped to a 3D vector in the same East-Up-North frame, enabling comparison with celestial target vectors.

---

## 2. RA/Dec to Alt/Az

This is the most frequently called transformation in the engine: it converts an object's catalog position to its apparent position in the observer's sky. Documented in [algorithms.md, Section 3.1](./algorithms.md#31-radec-to-altitudeazimuth).

### 2.1 Algorithm

```
Input:
  RA       Right Ascension (hours, 0-24)
  Dec      Declination (degrees, -90 to +90)
  lat      Observer latitude (degrees, -90 to +90, North positive)
  lon      Observer longitude (degrees, -180 to +180, East positive)
  time_ms  Current time (milliseconds since Unix epoch)

Output:
  Alt      Altitude (degrees, -90 to +90)
  Az       Azimuth (degrees, 0-360, North = 0)

Steps:

1. Convert all angles to radians:
   RA_rad  = RA * pi / 12
   Dec_rad = Dec * pi / 180
   lat_rad = lat * pi / 180

2. Compute Local Sidereal Time:
   JD       = unix_to_jd(time_ms)
   GMST     = compute_gmst(JD)          // hours
   LST      = GMST + (lon / 15.0)       // hours
   LST_rad  = LST * pi / 12

3. Compute Hour Angle:
   HA_rad = LST_rad - RA_rad

4. Compute altitude:
   sin_alt = sin(lat_rad) * sin(Dec_rad)
           + cos(lat_rad) * cos(Dec_rad) * cos(HA_rad)
   Alt_rad = asin( clamp(sin_alt, -1.0, 1.0) )

5. Compute azimuth:
   Y = -sin(HA_rad)
   X = cos(HA_rad) * sin(lat_rad) - tan(Dec_rad) * cos(lat_rad)
   Az_rad = atan2(Y, X)
   Az_deg = Az_rad * 180 / pi
   Az_deg = Az_deg mod 360       // normalize to [0, 360)
```

### 2.2 Rust Implementation

```rust
pub fn ra_dec_to_altaz(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    time_ms: i64,
) -> (f64, f64) {
    let ra_rad = ra_hours * std::f64::consts::PI / 12.0;
    let dec_rad = dec_deg.to_radians();
    let lat_rad = lat_deg.to_radians();

    let jd = unix_to_jd(time_ms);
    let gmst = compute_gmst(jd);
    let lst = gmst + lon_deg / 15.0;
    let lst_rad = lst * std::f64::consts::PI / 12.0;

    let ha_rad = lst_rad - ra_rad;

    // Altitude
    let sin_alt = lat_rad.sin() * dec_rad.sin()
                + lat_rad.cos() * dec_rad.cos() * ha_rad.cos();
    let alt_rad = clamp(sin_alt, -1.0, 1.0).asin();

    // Azimuth
    let y = -ha_rad.sin();
    let x = ha_rad.cos() * lat_rad.sin() - dec_rad.tan() * lat_rad.cos();
    let az_rad = y.atan2(x);
    let az_deg = normalize_degrees(az_rad.to_degrees());

    (alt_rad.to_degrees(), az_deg)
}
```

### 2.3 Key Conventions

- **Azimuth origin**: 0 degrees = geographic North. This matches the convention used by device magnetometers and is the most common convention in navigation and amateur astronomy.
- **Hour Angle sign**: Positive HA means the object is west of the meridian (past transit); negative HA means the object is east (approaching transit).
- **Clamping**: The `sin_alt` value is clamped to [-1, 1] before passing to `asin` to prevent NaN from floating-point drift.

---

## 3. Alt/Az to 3D Unit Vector

This conversion maps horizontal coordinates to a Cartesian unit vector for angular distance and guidance computations. Documented in [algorithms.md, Section 3.2](./algorithms.md#32-altitudeazimuth-to-3d-unit-vector).

### 3.1 Algorithm

```
Input:
  Alt  Altitude (degrees)
  Az   Azimuth (degrees)

Output:
  v = (x, y, z) unit vector in East-Up-North frame

Formula:
  alt_rad = Alt * pi / 180
  az_rad  = Az * pi / 180

  x = cos(alt_rad) * sin(az_rad)    // East component
  y = sin(alt_rad)                   // Up component
  z = cos(alt_rad) * cos(az_rad)    // North component
```

### 3.2 Rust Implementation

```rust
pub fn altaz_to_vector3(alt_deg: f64, az_deg: f64) -> Vector3 {
    let alt_rad = alt_deg.to_radians();
    let az_rad = az_deg.to_radians();

    Vector3 {
        x: alt_rad.cos() * az_rad.sin(),
        y: alt_rad.sin(),
        z: alt_rad.cos() * az_rad.cos(),
    }
}
```

### 3.3 Verification

For any valid input, the output vector has unit magnitude:

```
|v| = sqrt(x^2 + y^2 + z^2)
    = sqrt(cos^2(alt)*sin^2(az) + sin^2(alt) + cos^2(alt)*cos^2(az))
    = sqrt(cos^2(alt)*(sin^2(az) + cos^2(az)) + sin^2(alt))
    = sqrt(cos^2(alt) + sin^2(alt))
    = 1.0
```

The output is already normalized by construction. No explicit normalization is needed.

---

## 4. Device Frame Transformation

### 4.1 Sensor Fusion World Frame vs. Core Engine Frame

The sensor fusion service (SensorFusionService) produces an orientation quaternion from accelerometer, gyroscope, and magnetometer data using a complementary filter. The quaternion's world frame is **ENU (East-North-Up)**, which is the standard convention for tilt-compensated compass orientation from Euler angles:

- **X = East** (positive toward geographic East)
- **Y = North** (positive toward geographic North)
- **Z = Up** (positive toward zenith)

The Rust core engine uses **EUN (East-Up-North)** for its Vector3 type (see section 1.3):

- **X = East**
- **Y = Up**
- **Z = North**

These two frames differ by a swap of the Y and Z axes. **Directly comparing vectors from the sensor fusion with vectors from the core engine produces incorrect angular distances** (typically ~90° off). This is the most critical coordinate mismatch in the system.

### 4.2 Extracting Device Heading and Elevation

Rather than rotating a body-frame vector through the quaternion and mapping between ENU/EUN, the tracking service extracts **heading** and **elevation** as scalar angles from the quaternion. These are frame-independent and verified correct through physical testing.

**Device heading** (compass bearing of the back camera):

The ZYX Euler decomposition of the sensor quaternion gives the yaw angle, which represents the heading of the phone's X axis (right side). When held upright in portrait mode, the back camera (-Z body axis) points 90° counterclockwise from the X axis, so:

```
yawRad = atan2(2 * (q.w * q.z + q.x * q.y), 1 - 2 * (q.y² + q.z²))
deviceHeading = (270 - yawRad * 180 / π + 360) mod 360
```

Result: degrees clockwise from North (0 = North, 90 = East, 180 = South, 270 = West).

**Device elevation** (tilt of back camera above horizon):

The -Z body axis rotated by the sensor quaternion has components `[x_enu, y_enu, z_enu]` in the ENU frame. The Z component (Up in ENU) gives the vertical component of the camera direction:

```
upComponent = 2 * (q.x² + q.y²) - 1
deviceElevation = asin(clamp(upComponent, -1, 1)) * 180 / π
```

Result: degrees above horizon (0 = level, +90 = straight up, -90 = straight down).

### 4.3 Building the Device Direction Vector

To compute angular distance between the device's pointing direction and the target, both vectors must be in the **same coordinate frame** (EUN). Instead of transforming the quaternion output from ENU to EUN (error-prone axis swaps), the device direction is reconstructed from the already-correct heading and elevation using the same `altaz_to_vector3` formula the core engine uses:

```typescript
const headRad = deviceHeading * Math.PI / 180;
const elevRad = deviceElevation * Math.PI / 180;
const deviceDir: Vector3 = {
  x: Math.cos(elevRad) * Math.sin(headRad),  // East
  y: Math.sin(elevRad),                       // Up
  z: Math.cos(elevRad) * Math.cos(headRad),   // North
};
```

This guarantees both `deviceDir` and `tracking.direction` (from the Rust core) are in EUN, and `angularDistance(deviceDir, tracking.direction)` produces the correct result.

### 4.4 Why Not Direct Quaternion Rotation?

The naive approach — rotating `[0, 0, -1]` by the quaternion to get a world-frame vector — produces a vector in the **sensor's ENU frame**, not the core's EUN frame:

```
// This gives ENU, NOT EUN:
deviceDir_enu = Q * [0, 0, -1] * Q*
  x = -2*(q.x*q.z + q.w*q.y)   // East  ✓
  y = -2*(q.y*q.z - q.w*q.x)   // North ✗ (core expects Up)
  z =  2*(q.x² + q.y²) - 1     // Up    ✗ (core expects North)
```

Passing this ENU vector to `Core.angularDistance()` alongside the core's EUN target vector results in a Y/Z swap that produces wildly incorrect angular distances (often ~90° regardless of actual alignment). The heading/elevation reconstruction approach in §4.3 avoids this entirely.

### 4.5 Target in Device Frame

To determine the direction the user should move their phone to reach the target:

```rust
pub fn target_in_device_frame(
    v_target: &Vector3,
    q_device: &Quaternion,
) -> Vector3 {
    // Inverse rotation: Q^(-1) * v * Q
    let q_inv = q_device.conjugate();
    q_inv.rotate_vector(v_target)
}
```

The resulting vector's components tell the guidance system:
- `v_device.x > 0` -- target is to the **right** of camera center
- `v_device.y > 0` -- target is **above** camera center
- `v_device.z < 0` -- target is **in front** of the camera (correct hemisphere)

---

## 5. Precision Considerations

### 5.1 Radians Throughout

All intermediate trigonometric calculations use radians. Degree-to-radian conversion happens at the input boundary; radian-to-degree conversion happens at the output boundary. This avoids repeated conversion and reduces accumulated rounding error.

### 5.2 f64 Precision

IEEE 754 `f64` provides approximately 15-16 significant decimal digits. For angular computations:

| Value | Precision | Angular Resolution |
|-------|-----------|-------------------|
| 1 radian | 15 digits | ~0.000000003 arcseconds |
| 360 degrees | 13 digits | ~0.00000004 arcseconds |
| 24 hours RA | 14 digits | ~0.0000000005 arcseconds |

This far exceeds the required accuracy. The limiting factor is never floating-point precision but rather the simplifications in the astronomical models.

### 5.3 Clamping for Domain Safety

The `asin` and `acos` functions have domain [-1, 1]. Due to floating-point arithmetic, intermediate results can slightly exceed this range (e.g., 1.0000000000000002). All inputs to `asin`/`acos` are clamped:

```rust
fn safe_asin(x: f64) -> f64 {
    x.clamp(-1.0, 1.0).asin()
}

fn safe_acos(x: f64) -> f64 {
    x.clamp(-1.0, 1.0).acos()
}
```

---

## 6. Worked Example

Compute the position of Sirius as seen from New York City on 2024-01-15 at 22:00 UTC.

**Given**:
- Sirius: RA = 6.7525 hours, Dec = -16.7161 degrees
- New York: lat = 40.7128 N, lon = -74.0060 W
- Time: 2024-01-15 22:00:00 UTC = 1705359600000 ms

**Step 1**: Convert to Julian Date

```
JD = 1705359600000 / 1000 / 86400 + 2440587.5 = 2460324.41667
```

**Step 2**: Compute GMST

```
T = (2460324.41667 - 2451545.0) / 36525.0 = 0.24016
GMST = 18.697374558 + 24.06570982441908 * (2460324.41667 - 2444239.1) + ...
GMST ≈ 7.95 hours (after normalization)
```

**Step 3**: Compute LST

```
LST = 7.95 + (-74.006 / 15.0) = 7.95 - 4.934 = 3.016 hours
```

**Step 4**: Compute Hour Angle

```
HA = 3.016 - 6.7525 = -3.7365 hours = -56.048 degrees
HA_rad = -0.9783
```

**Step 5**: Compute Altitude

```
sin(Alt) = sin(40.713°) * sin(-16.716°)
         + cos(40.713°) * cos(-16.716°) * cos(-56.048°)
         = 0.6521 * (-0.2876) + 0.7581 * 0.9577 * 0.5576
         = -0.1876 + 0.4049
         = 0.2173
Alt = asin(0.2173) = 12.55°
```

**Step 6**: Compute Azimuth

```
Y = -sin(-56.048°) = 0.8295
X = cos(-56.048°)*sin(40.713°) - tan(-16.716°)*cos(40.713°)
  = 0.5576 * 0.6521 - (-0.3002) * 0.7581
  = 0.3636 + 0.2275 = 0.5911
Az = atan2(0.8295, 0.5911) = 54.5° (northeast)
```

**Step 7**: Convert to 3D vector

```
v = (cos(12.55°) * sin(54.5°), sin(12.55°), cos(12.55°) * cos(54.5°))
  = (0.795, 0.217, 0.567)
```

**Result**: Sirius is at altitude 12.6 degrees, azimuth 54.5 degrees (ENE), about 12.6 degrees above the horizon in the northeast sky.

---

## 7. Cross-References

- **[Core Astronomical Algorithms, Section 3](./algorithms.md#3-celestial-coordinate-transformations)** -- Original pseudocode for RA/Dec to Alt/Az and Alt/Az to Vector3
- **[Vector Mathematics](./vector-math.md)** -- 3D vector operations, quaternion math, and angular distance
- **[Ephemeris Computation](./ephemeris.md)** -- Source of RA/Dec inputs for coordinate transforms
- **[Error Bounds, Section 2](./error-bounds.md)** -- Error propagation through the coordinate transform chain

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
