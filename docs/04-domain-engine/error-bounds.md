# Error Bounds & Accuracy Analysis

## 1. Error Budget

The total angular error between where FindMyStar tells the user to point and where the object actually appears in the sky is the **sum of component errors** from multiple independent sources. Understanding this error budget is essential for setting user expectations and prioritizing accuracy improvements.

```
Total Error = Algorithmic Error
            + Time Error
            + Position Error
            + Sensor Error
            + Atmospheric Error
```

In the worst case (all errors additive, object near the horizon), the total error can reach approximately 2-3 degrees. In the best case (premium device, object near zenith), it is under 1 degree.

| Error Source | Typical Magnitude | Worst Case | Controllable? |
|-------------|-------------------|------------|--------------|
| Algorithmic | 0.08 degrees (5 arcmin) | 1.0 degrees (Moon) | Yes (better models) |
| Time | 0.004 degrees | 0.1 degrees | Partially (NTP sync) |
| Position (GPS) | Negligible | Negligible | No |
| Sensor (IMU) | 0.5-2.0 degrees | 5.0 degrees | Partially (calibration) |
| Atmospheric | 0.0 degrees (zenith) | 0.5 degrees (horizon) | No (not modeled in MVP) |

The IMU sensor error is the **dominant contributor** by a factor of 10 to 100 over all other sources. This means that improving algorithmic accuracy beyond the current level provides negligible practical benefit for the AR guidance use case.

---

## 2. Error Sources

### 2.1 Algorithmic Error

Algorithmic error arises from using simplified mathematical models instead of full-precision theories.

**Sun position (simplified model)**:
- Error vs full VSOP87: +/-5 arcminutes (0.083 degrees)
- Error vs JPL Horizons: +/-5 arcminutes
- Maximum error occurs near perihelion (early January) due to higher eccentricity terms

**Moon position (low-precision model)**:
- Error vs ELP2000: +/-1 degree (60 arcminutes)
- The Moon is the least accurate object in the catalog
- Acceptable because the Moon's apparent diameter is 0.5 degrees, making it easy to find even with 1-degree error

**Planet positions (VSOP87 truncated)**:
- Inner planets (Mercury, Venus, Mars): +/-1-2 arcminutes
- Outer planets (Jupiter through Neptune): +/-3-5 arcminutes
- Error increases for planets at large heliocentric distance due to fewer retained series terms

**Star positions (catalog)**:
- Catalog accuracy: < 1 arcsecond (Hipparcos)
- Precession correction error: < 1 arcminute over 25 years
- Effectively zero algorithmic error for the star catalog

**Coordinate transform error**:
- Sidereal time polynomial: < 0.1 second of time
- RA/Dec to Alt/Az: dominated by sidereal time error, < 0.025 degrees

### 2.2 Time Error

Device clock skew propagates through the sidereal time computation into the Hour Angle, which directly affects the computed altitude and azimuth.

```
Propagation chain:
  Time error (dt)
  -> LST error = dt * (1.00274 / 3600) hours
  -> Hour Angle error = LST error
  -> Altitude error ~ cos(Dec) * cos(HA) * dHA * cos(lat)  (depends on geometry)
  -> Azimuth error ~ sin(HA) * dHA / cos(Alt)              (depends on geometry)
```

**Quantitative analysis**:

| Clock Error | LST Error | Max Alt Error | Max Az Error |
|------------|-----------|---------------|--------------|
| 1 second | 0.0003 hours | 0.004 degrees | 0.008 degrees |
| 15 seconds | 0.004 hours | 0.06 degrees | 0.12 degrees |
| 1 minute | 0.017 hours | 0.25 degrees | 0.5 degrees |
| 5 minutes | 0.084 hours | 1.3 degrees | 2.5 degrees |

Modern smartphones maintain clock accuracy within +/-15 seconds via NTP synchronization. If the device has not synced recently (e.g., after airplane mode), the error could reach minutes.

**Mitigation**: The application layer checks `SystemClock.elapsedRealtime()` against the last known NTP sync. If the gap exceeds 24 hours, a warning is displayed: "Clock may be inaccurate. Connect to the internet to sync."

### 2.3 Position Error (GPS)

GPS accuracy on modern smartphones is typically +/-5-10 meters. The effect on astronomical calculations is negligible:

```
Position error of 10 meters:
  - Latitude change: 10 / 111,320 = 0.00009 degrees
  - Effect on altitude: sin(0.00009°) ≈ 0.0000016 degrees
  - Completely negligible
```

Even a GPS error of 1 kilometer produces only 0.009 degrees of latitude error, which translates to less than 0.01 degrees of altitude error. GPS accuracy is never a limiting factor.

### 2.4 Sensor Error (IMU)

The device's Inertial Measurement Unit (gyroscope, accelerometer, magnetometer) is the **dominant error source**. The orientation quaternion provided by the OS sensor fusion algorithm has inherent noise and bias.

**Gyroscope**:
- Drift: 0.01-0.1 degrees per second (without magnetometer correction)
- Noise: +/-0.01 degrees per sample at 100 Hz
- Corrected by sensor fusion with accelerometer and magnetometer

**Accelerometer**:
- Static accuracy: +/-0.1 degrees (determines "down" direction)
- Dynamic accuracy: degrades with motion (user's hand shaking)

**Magnetometer**:
- Static accuracy: +/-1-5 degrees (determines "north" direction)
- Highly sensitive to: nearby metal, magnets, electronic devices, building structure
- **The primary source of azimuth error**

**Combined sensor fusion accuracy**:

| Condition | Pitch/Roll Error | Heading (Azimuth) Error |
|-----------|-----------------|----------------------|
| Stationary, calibrated | +/-0.3 degrees | +/-1.0 degrees |
| Stationary, uncalibrated | +/-0.5 degrees | +/-5.0 degrees |
| Slow movement | +/-0.5 degrees | +/-2.0 degrees |
| Fast movement | +/-1.0 degrees | +/-3.0 degrees |
| Near interference | +/-1.0 degrees | +/-10.0 degrees |

### 2.5 Atmospheric Refraction

The atmosphere bends starlight, making objects appear higher than their true geometric position. This effect is strongest at the horizon and zero at the zenith.

```
Refraction (approximate, Meeus):
  R = 1.02 / tan(Alt + 10.3 / (Alt + 5.11))   (arcminutes)
```

| True Altitude | Refraction | Apparent Altitude |
|--------------|-----------|-------------------|
| 90 degrees | 0.0' | 90.0 degrees |
| 45 degrees | 1.0' | 45.017 degrees |
| 10 degrees | 5.3' | 10.088 degrees |
| 5 degrees | 9.9' | 5.165 degrees |
| 1 degree | 24.6' | 1.41 degrees |
| 0 degrees (horizon) | 34.5' | 0.575 degrees |

FindMyStar does **not** model refraction in the MVP. The maximum error of 0.575 degrees at the horizon is within the IMU noise floor for most devices. Refraction modeling is planned for Phase 2.

---

## 3. Error Propagation

### 3.1 Computation Chain

Errors propagate through the following chain, with each step potentially amplifying the input error:

```
Unix Time (ms)
  |  +/- 15 seconds
  v
Julian Date
  |  error preserved (linear conversion)
  v
GMST / LST
  |  error amplified by 1.00274x (sidereal rate)
  v
Hour Angle
  |  error preserved (subtraction)
  v
Altitude / Azimuth
  |  error depends on geometry (see below)
  v
3D Unit Vector
  |  error preserved (trigonometric mapping)
  v
Angular Distance to Target
  |  combined with IMU error (root-sum-square)
  v
Guidance Arrow Direction
```

### 3.2 Geometric Amplification

The conversion from Hour Angle error to Altitude/Azimuth error depends on the object's position in the sky:

**Altitude error** is minimized when the object is near the meridian (HA near 0) and maximized when the object is near the horizon:

```
dAlt/dHA = -cos(lat) * cos(Dec) * sin(HA) / cos(Alt)
```

**Azimuth error** is amplified near the zenith (small cos(Alt) denominator) and minimized at the horizon:

```
dAz/dHA ~ 1 / cos(Alt)
```

This means objects near the zenith have larger azimuth uncertainty, while objects near the horizon have larger altitude uncertainty.

### 3.3 Worst-Case Scenario

The worst case occurs when:
- Device clock is 15 seconds off
- IMU is uncalibrated (5-degree azimuth error)
- Object is near the horizon (refraction ~0.5 degrees)
- Magnetometer interference present

**Total worst-case error**: approximately 5-6 degrees. At this level, the AR arrow still points in the correct general direction, and the user can find the object visually within a few degrees of the indicated direction.

---

## 4. Per-Object Accuracy

| Object Type | Position Accuracy | Rise/Set Accuracy | Alt/Az Accuracy | Limiting Factor |
|-------------|-------------------|-------------------|-----------------|-----------------|
| Sun | +/-5 arcmin | +/-3 min | +/-0.1 degrees | Simplified model |
| Moon | +/-1 degree | +/-10 min | +/-1.0 degrees | Low-precision model |
| Mercury | +/-2 arcmin | +/-5 min | +/-0.05 degrees | Rapid motion |
| Venus | +/-1 arcmin | +/-3 min | +/-0.03 degrees | Well-modeled |
| Mars | +/-2 arcmin | +/-5 min | +/-0.05 degrees | Eccentricity |
| Jupiter | +/-3 arcmin | +/-5 min | +/-0.08 degrees | Truncated series |
| Saturn | +/-5 arcmin | +/-5 min | +/-0.1 degrees | Truncated series |
| Uranus | +/-5 arcmin | +/-5 min | +/-0.1 degrees | Fewer terms |
| Neptune | +/-5 arcmin | +/-5 min | +/-0.1 degrees | Fewer terms |
| Bright stars | < 1 arcmin | +/-2 min | +/-0.02 degrees | Catalog precision |
| Messier objects | < 1 arcmin | +/-2 min | +/-0.02 degrees | Catalog precision |

Note: Alt/Az accuracy figures above exclude IMU error. With IMU error included, all objects have effectively the same accuracy (dominated by the +/-0.5-2 degree IMU contribution).

---

## 5. Device-Dependent Accuracy

The practical accuracy of FindMyStar's AR guidance depends heavily on the user's device hardware:

### 5.1 Device Tiers

| Tier | Example Devices | IMU Quality | Expected Accuracy | Notes |
|------|----------------|-------------|-------------------|-------|
| Premium | iPhone 14 Pro, Samsung S24 Ultra | Excellent | +/-0.5 degrees | Best magnetometer, calibrated |
| High | iPhone 12, Samsung S23, Pixel 8 | Very good | +/-0.8 degrees | Good magnetometer |
| Mid-range | Samsung A54, Pixel 7a, OnePlus Nord | Good | +/-1.0-1.5 degrees | Adequate magnetometer |
| Budget | Redmi Note 12, Samsung A14 | Fair | +/-2.0-3.0 degrees | Noisy magnetometer |
| Entry-level | Sub-$150 devices | Poor | +/-3.0-5.0 degrees | May lack magnetometer |

### 5.2 Minimum Device Requirements

For a usable AR guidance experience, the engine requires:
- **6-axis IMU**: gyroscope + accelerometer (mandatory)
- **Magnetometer**: for absolute heading reference (strongly recommended)
- **Sensor fusion API**: Android Rotation Vector or iOS CMMotionManager

Devices without a magnetometer can still use the engine, but azimuth accuracy degrades significantly (gyroscope drift of several degrees per minute without magnetic correction).

---

## 6. Mitigation Strategies

### 6.1 Magnetometer Calibration Prompt

When the application detects high magnetic interference (indicated by low magnetometer accuracy reported by the OS), it displays a calibration prompt:

```
"Compass needs calibration. Move your phone in a figure-8 pattern."
```

The prompt is triggered when:
- Android: `SensorManager.SENSOR_STATUS_ACCURACY_LOW` or `UNRELIABLE`
- iOS: `CMCalibratedMagneticField.accuracy == .uncalibrated`

### 6.2 Time Sync Warning

When the device clock has not been synchronized via NTP for more than 24 hours:

```
"Clock may be inaccurate. Connect to the internet to sync your device time."
```

This is informational only; all calculations proceed with the available time.

### 6.3 Low-Altitude Warning

When an object is below 10 degrees altitude, atmospheric refraction and horizon obstructions reduce practical accuracy:

```
"[Object] is very low on the horizon. Accuracy may be reduced."
```

### 6.4 Manual Star Alignment (Phase 2)

A future enhancement will allow the user to manually identify a known bright star (e.g., "Point your camera at Sirius and tap"). The engine then computes the offset between the expected and observed position, deriving a correction quaternion that compensates for systematic magnetometer bias.

```
Q_corrected = Q_offset * Q_device

where Q_offset = Q_expected * Q_observed^(-1)
```

This can reduce the effective IMU error from +/-2 degrees to +/-0.5 degrees on devices with poor magnetometers.

---

## 7. Comparison with Competitors

| Metric | FindMyStar (MVP) | SkySafari 7 | Stellarium Mobile | Star Walk 2 |
|--------|-----------------|-------------|-------------------|-------------|
| Sun/Planet position | +/-5 arcmin | +/-1 arcmin | +/-1 arcmin | +/-5 arcmin |
| Star position | < 1 arcmin | < 1 arcsec | < 1 arcsec | < 1 arcmin |
| AR pointing (typical) | +/-1 degree | +/-1 degree | +/-1.5 degrees | +/-2 degrees |
| AR pointing (worst) | +/-5 degrees | +/-5 degrees | +/-5 degrees | +/-5 degrees |
| Rise/set time | +/-3 min | +/-1 min | +/-1 min | +/-5 min |
| Offline operation | Full | Partial | Partial | Partial |

FindMyStar's algorithmic accuracy is comparable to competitors for the practical AR use case, where IMU error dominates. The accuracy gap in ephemeris (5 arcmin vs 1 arcmin) is invisible to the user because it is overwhelmed by the sensor noise floor.

FindMyStar differentiates on **full offline operation** and **rise/set alert scheduling**, not on sub-arcminute positional accuracy.

---

## 8. Cross-References

- **[Core Astronomical Algorithms, Section 10](./algorithms.md#10-error-bounds-and-validation)** -- Summary error bounds table
- **[Validation Strategy](./validation.md)** -- How accuracy is measured and verified
- **[Ephemeris Computation](./ephemeris.md)** -- Algorithm details and accuracy per object type
- **[SRS, NFR-8](../02-requirements/srs.md)** -- "Position accuracy shall be within 1 degree"
- **[SRS, NFR-9](../02-requirements/srs.md)** -- "Rise/set accuracy shall be within 5 minutes"
- **[SRS, NFR-10](../02-requirements/srs.md)** -- "AR guidance shall achieve target lock within 1 degree"

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
