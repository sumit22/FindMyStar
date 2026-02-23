# Core Astronomical Algorithms

## 1. Time Conversion

### 1.1 Unix Timestamp to Julian Date

```
Input: time_ms (milliseconds since Unix epoch 1970-01-01)
Output: JD (Julian Date)

Algorithm:
  seconds = time_ms / 1000
  days_since_epoch = seconds / 86400
  JD = days_since_epoch + 2440587.5
```

**Example**:
- Unix time 0 (1970-01-01 00:00:00) → JD 2440587.5
- 2024-01-01 00:00:00 → JD 2460310.5

**Precision**: Double-precision floating point (f64), ~1 microsecond accuracy

---

## 2. Sidereal Time

### 2.1 Greenwich Mean Sidereal Time (GMST)

Local Sidereal Time is proportional to Earth's rotation angle. Essential for converting RA/Dec to horizontal coordinates.

```
Input: JD (Julian Date)
Output: GMST (in hours, 0-24)

Algorithm:
  T = (JD - 2451545.0) / 36525.0  // Julian centuries since J2000.0
  
  GMST_hours = 18.697374558 
             + 24.06570982441908 * (JD - 2444239.1)
             + 0.093104 * T^2
             + 6.2e-6 * T^3
  
  GMST_normalized = GMST_hours mod 24
```

**Important Constants**:
- J2000.0 epoch: JD 2451545.0
- Earth rotation rate: 1.00273790935 rotations/sidereal day

---

### 2.2 Local Sidereal Time (LST)

```
Input: GMST (Greenwich Mean Sidereal Time, hours)
       longitude (decimal degrees, East = positive)
Output: LST (Local Sidereal Time, hours 0-24)

Algorithm:
  LST_hours = GMST + (longitude / 15.0)  // Convert degrees to hours
  LST_normalized = LST_hours mod 24
```

**Conversion**: 1 hour = 15 degrees of longitude

---

## 3. Celestial Coordinate Transformations

### 3.1 RA/Dec to Altitude/Azimuth

Converts celestial equatorial coordinates to horizontal coordinates.

```
Input:
  RA (Right Ascension, hours 0-24)
  Dec (Declination, degrees -90 to +90)
  lat (Observer latitude, degrees -90 to +90)
  lon (Observer longitude, degrees -180 to +180)
  time_ms (Current time in milliseconds since Unix epoch)

Output:
  Alt (Altitude, degrees -90 to +90)
  Az (Azimuth, degrees 0-360, from North)

Algorithm:

1. Convert RA to hours → RA_radians = RA * π / 12
   Convert Dec to radians = Dec * π / 180
   Convert lat to radians = lat * π / 180

2. Compute Local Sidereal Time (LST)
   JD = compute_julian_date(time_ms)
   GMST = compute_gmst(JD)
   LST = GMST + (lon / 15.0)
   LST_radians = LST * π / 12

3. Compute Hour Angle (HA)
   HA_radians = LST_radians - RA_radians
   
4. Compute Altitude
   sin(Alt) = sin(lat_rad) * sin(Dec_rad) 
            + cos(lat_rad) * cos(Dec_rad) * cos(HA_rad)
   Alt = asin(...)  // In radians, convert to degrees

5. Compute Azimuth
   Y = -sin(HA_rad)
   X = cos(HA_rad) * sin(lat_rad) - tan(Dec_rad) * cos(lat_rad)
   Az = atan2(Y, X)  // In radians, normalize to 0-360°
```

**Key Points**:
- All intermediate calculations in radians
- Hour Angle can be negative (object hasn't risen)
- Azimuth: 0° = North, 90° = East, 180° = South, 270° = West

---

### 3.2 Altitude/Azimuth to 3D Unit Vector

Converts horizontal coordinates to unit vector in Earth frame.

```
Input:
  Alt (Altitude, degrees)
  Az (Azimuth, degrees)

Output:
  v = [x, y, z] (3D unit vector)

Algorithm:
  Alt_rad = Alt * π / 180
  Az_rad = Az * π / 180
  
  x = cos(Alt_rad) * sin(Az_rad)  // East component
  y = sin(Alt_rad)                // Up component
  z = cos(Alt_rad) * cos(Az_rad)  // North component
  
  v = normalize([x, y, z])  // Ensure unit length
```

**Coordinate System**:
- X = East
- Y = Up (zenith)
- Z = North
- Right-handed system

---

## 4. Angular Distance

### 4.1 Angular Error Between Two Unit Vectors

Computes angle between device orientation and target direction.

```
Input:
  v_target (3D unit vector pointing to object)
  v_camera (3D unit vector pointing along camera axis)

Output:
  angle (angular distance, degrees 0-180)

Algorithm:
  dot_product = v_target · v_camera
  
  // Clamp to [-1, 1] to handle floating point errors
  dot_product = clamp(dot_product, -1.0, 1.0)
  
  angle_rad = acos(dot_product)
  angle_deg = angle_rad * 180 / π
```

**Quality Check**: If |dot_product| > 1, floating point error occurred. Clamp and retry.

---

### 4.2 Direction Vector (Thrust Vector)

Finds which way to move camera to align with target.

```
Input:
  v_target (3D unit vector to target)
  Q_device (quaternion representing device orientation)

Output:
  direction (relative target direction in camera coordinates)
  
Algorithm:
  // Transform target vector into device frame
  v_rel = inverse(Q_device) * v_target
  
  // Extract components
  right_deviation = v_rel.x    // Positive = move right
  up_deviation = v_rel.y       // Positive = move up
  distance_away = -v_rel.z     // Positive = object ahead but offset
  
  // Compute guidance
  if distance_away > 0:
    angle = atan2(sqrt(right_deviation^2 + up_deviation^2), distance_away)
    direction_angle = atan2(right_deviation, up_deviation)
    
  return { direction: direction_angle, distance: angle }
```

---

## 5. Rise/Set Time Calculation

### 5.1 Analytical Solution (for Fixed Stars)

Uses closed-form Hour Angle formula.

```
Input:
  Dec (Declination, degrees)
  lat (Observer latitude, degrees)
  
Output:
  H0 (Hour Angle at rise/set, hours)
  OR
  "Always Visible" / "Never Visible"

Algorithm:

1. Check if object can rise/set:
   cos(H0) = -tan(lat_rad) * tan(Dec_rad)
   
   if |cos(H0)| > 1:
     if Dec > 0 and lat > 0:
       return "Always Visible" (circumpolar)
     else:
       return "Never Visible"

2. If object can rise/set:
   H0 = acos(cos(H0))  // In radians
   H0_hours = H0 * 12 / π  // Convert to hours
   
3. Compute rise/set times in LST:
   Rise_LST = RA - H0_hours
   Set_LST = RA + H0_hours
   
4. Convert LST to UTC:
   UTC = LST - (longitude / 15)
   
5. Return rise/set times in user's local timezone
```

**Special Cases**:
- `|cos(H0)| > 1` with positive declination = circumpolar (never sets)
- `|cos(H0)| > 1` with negative declination = never visible
- `cos(H0) = 1` = rise and set at same point (equinox)

---

### 5.2 Iterative Solution (for Planets)

Planets have changing RA/Dec, so iterative scan is more robust.

```
Input:
  object_id (planet identifier)
  location (lat, lon)
  start_time (UTC milliseconds)
  altitude_threshold (degrees, default 0°)

Output:
  rise_time (UTC milliseconds)
  OR "No rise in next 48 hours"

Algorithm:

current_time = start_time
end_time = start_time + 48 hours

while current_time < end_time:
  RA_Dec = get_ephemeris(object_id, current_time)
  Alt = compute_altitude(RA_Dec, location, current_time)
  
  if Alt >= altitude_threshold:
    // Object is above threshold, refine rise time
    return interpolate_rise_time(current_time - 5min, current_time)
  
  current_time += 5 minutes

return "No rise in 48 hours"


sub interpolate_rise_time(t1, t2):
  // Binary search for exact crossing
  while (t2 - t1) > 1 minute:
    t_mid = (t1 + t2) / 2
    Alt_mid = compute_altitude(get_ephemeris(object_id, t_mid), location, t_mid)
    
    if Alt_mid >= threshold:
      t2 = t_mid
    else:
      t1 = t_mid
  
  return (t1 + t2) / 2
```

**Tuning**:
- Interval: 5 minutes (fast enough for planets)
- Scan duration: 48 hours (adequate for most objects)
- Interpolation: Binary search for sub-minute accuracy

---

## 6. Visibility Filtering

### 6.1 Sun Altitude Constraint

```
Input:
  time_utc (UTC milliseconds)
  location (lat, lon)

Output:
  sun_altitude (degrees)
  is_twilight (boolean)

Algorithm:

1. Compute Sun's RA/Dec at time_utc
   (Use same ephemeris engine as planets)

2. Compute Sun altitude
   sun_alt = compute_altitude(sun_ra, sun_dec, location, time_utc)

3. Check twilight conditions:
   civil_twilight = sun_alt > -6°
   nautical_twilight = sun_alt > -12°
   astronomical_twilight = sun_alt > -18°
   
4. Recommended viewing: sun_alt < -6° (after civil twilight)
```

**Constants**:
- Civil twilight: Sun 6° below horizon (naked eye limit)
- Nautical twilight: Sun 12° below horizon
- Astronomical twilight: Sun 18° below horizon

---

## 7. Ephemeris: Sun and Moon

### 7.1 Sun Position (Simplified)

```
Input: JD (Julian Date)
Output: RA, Dec

Algorithm (Mean Solar Position):

T = (JD - 2451545.0) / 36525.0  // Julian centuries
Lambda = 280.4664567 + 36000.76982779 * T + 0.0003032028 * T^2  // Ecliptic longitude

n = JD - 2451545.0
lambda = 280.4664567 + 36000.76982779 * (n / 36525.0)
D = 357.52910918 + 35999.05029094 * (n / 36525.0)  // Mean anomaly

lambda = lambda + 1.914602 * sin(D) + 0.019993 * sin(2*D) + 0.000029 * sin(3*D)

obliquity = 23.4393 - 0.0130 * (n / 36525.0)

RA = atan2(cos(obliquity) * sin(lambda), cos(lambda))
Dec = asin(sin(obliquity) * sin(lambda))

return RA, Dec
```

**Note**: This is simplified. For higher precision, use full VSOP87 model.

---

## 8. Quaternion Operations

### 8.1 Quaternion to Forward Vector

Converts device orientation quaternion to forward-looking vector.

```
Input:
  Q = (w, x, y, z) representing device orientation

Output:
  v_forward (3D unit vector pointing along camera axis)

Algorithm:
  // Quaternion rotation formula v' = Q * v * Q^(-1)
  // For forward vector [0, 0, 1] (Z-axis in device frame):
  
  x = 2 * (w*x - y*z)
  y = 2 * (w*y + x*z)
  z = 1 - 2 * (x^2 + y^2)
  
  v_forward = normalize([x, y, z])
```

---

### 8.2 Quaternion Multiplication

```
Input:
  Q1 = (w1, x1, y1, z1)
  Q2 = (w2, x2, y2, z2)

Output:
  Q_result = Q1 * Q2

Algorithm:
  w = w1*w2 - x1*x2 - y1*y2 - z1*z2
  x = w1*x2 + x1*w2 + y1*z2 - z1*y2
  y = w1*y2 - x1*z2 + y1*w2 + z1*x2
  z = w1*z2 + x1*y2 - y1*x2 + z1*w2
  
  return (w, x, y, z)
```

---

## 9. Circular Coordinate Wrapping

### 9.1 Normalize Azimuth (0-360°)

```
Input: az (azimuth in degrees, any range)
Output: az_normalized (0-360°)

Algorithm:
  az_mod = az mod 360
  if az_mod < 0:
    az_mod = az_mod + 360
  return az_mod
```

---

## 10. Error Bounds and Validation

### 10.1 Altitude Accuracy

```
Expected accuracy: ±0.5° to ±1.0°

Sources of error:
- Atmospheric refraction: ±0.5° (especially at horizon)
- Device IMU: ±0.5° to ±2.0° (depends on sensor quality)
- Time error: ±15 seconds → ±0.1° altitude change
- Position error: ±100m → negligible for fixed stars

Validation:
- Polaris should be near observer's latitude altitude
  expected_alt ≈ lat, error < 1°
- Sun should match official ephemeris data
  error < 5 arcminutes
```

---

**Algorithm Document Status**: Complete  
**Version**: 1.0  
**Last Updated**: February 2026
