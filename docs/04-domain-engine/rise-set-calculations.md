# Rise/Set Time Calculations

## 1. Overview

Rise/set calculations determine **when** a celestial object crosses the observer's horizon. FindMyStar uses two distinct approaches depending on whether the object's equatorial coordinates change appreciably over the computation window.

| Approach | Used For | Method | Accuracy | Performance |
|----------|----------|--------|----------|-------------|
| **Analytical** | Fixed stars, Messier objects | Closed-form Hour Angle formula | +/-2 minutes | < 1 ms |
| **Iterative** | Sun, Moon, planets | 5-minute scan + binary search | +/-5 minutes | < 50 ms |

The analytical solution is exact for objects with constant RA/Dec. It fails gracefully for circumpolar and never-visible objects. The iterative solution handles objects whose RA/Dec changes over the course of a day (primarily the Moon, which moves ~13 degrees per day).

Both approaches are documented in [algorithms.md, Section 5](./algorithms.md#5-riseset-time-calculation).

---

## 2. Analytical Solution (Stars and Deep-Sky Objects)

### 2.1 Hour Angle at Rise/Set

When an object crosses the horizon (altitude = 0 degrees), its Hour Angle `H0` satisfies:

```
cos(H0) = -tan(lat) * tan(Dec)
```

This is derived from the altitude formula by setting `sin(Alt) = 0`:

```
sin(Alt) = sin(lat) * sin(Dec) + cos(lat) * cos(Dec) * cos(H)

Setting Alt = 0:
0 = sin(lat) * sin(Dec) + cos(lat) * cos(Dec) * cos(H0)

Solving for cos(H0):
cos(H0) = -sin(lat) * sin(Dec) / (cos(lat) * cos(Dec))
         = -tan(lat) * tan(Dec)
```

### 2.2 Standard Altitude Correction

In practice, "rise" and "set" are defined as the moment the object's **center** is at the standard altitude, which accounts for atmospheric refraction at the horizon:

| Object | Standard Altitude | Reason |
|--------|-------------------|--------|
| Stars / Planets | -0.5667 degrees | Average atmospheric refraction at horizon |
| Sun | -0.8333 degrees | Refraction + solar semi-diameter |
| Moon | +0.125 degrees | Refraction - lunar semi-diameter (Moon is large) |

The corrected formula becomes:

```
cos(H0) = (sin(h0) - sin(lat) * sin(Dec)) / (cos(lat) * cos(Dec))
```

where `h0` is the standard altitude for the object type.

### 2.3 Full Algorithm

```
Input:
  RA       Right Ascension (hours, 0-24)
  Dec      Declination (degrees, -90 to +90)
  lat      Observer latitude (degrees)
  lon      Observer longitude (degrees)
  time_ms  Reference time (Unix ms, used to determine the date)
  h0       Standard altitude (degrees, default -0.5667)

Output:
  One of:
    (rise_time_ms, set_time_ms)   -- normal rise/set
    CIRCUMPOLAR                    -- always above horizon
    NEVER_VISIBLE                  -- always below horizon

Algorithm:

1. Compute cos(H0):
   cos_H0 = (sin(h0_rad) - sin(lat_rad) * sin(Dec_rad))
           / (cos(lat_rad) * cos(Dec_rad))

2. Check special cases:
   if cos_H0 < -1.0:
     return CIRCUMPOLAR      // Object never sets
   if cos_H0 > 1.0:
     return NEVER_VISIBLE    // Object never rises

3. Compute Hour Angle at rise/set:
   H0 = acos(cos_H0)              // radians, always positive
   H0_hours = H0 * 12.0 / pi     // convert to hours

4. Compute rise and set in LST:
   Rise_LST = RA - H0_hours       // hours
   Set_LST  = RA + H0_hours       // hours

5. Convert LST to UTC:
   // Determine GMST at 0h UTC on the reference date
   JD_0h = floor(unix_to_jd(time_ms) + 0.5) - 0.5
   GMST_0h = compute_gmst(JD_0h)

   Rise_GMST = Rise_LST - (lon / 15.0)
   Rise_UT = Rise_GMST - GMST_0h
   Rise_UT = normalize_hours(Rise_UT / 1.00273790935)  // sidereal to solar

   Set_GMST = Set_LST - (lon / 15.0)
   Set_UT = Set_GMST - GMST_0h
   Set_UT = normalize_hours(Set_UT / 1.00273790935)

6. Convert to Unix milliseconds:
   rise_time_ms = JD_0h_to_unix(JD_0h) + Rise_UT * 3600000
   set_time_ms  = JD_0h_to_unix(JD_0h) + Set_UT * 3600000

7. If rise_time_ms < time_ms (already past):
   rise_time_ms += 86400000    // advance by 1 sidereal day
```

### 2.4 Rust Implementation

```rust
pub enum RiseSetResult {
    Normal { rise_ms: i64, set_ms: i64 },
    Circumpolar,
    NeverVisible,
}

pub fn compute_rise_set(
    ra_hours: f64,
    dec_deg: f64,
    lat_deg: f64,
    lon_deg: f64,
    time_ms: i64,
    h0_deg: f64,
) -> RiseSetResult {
    let lat_rad = lat_deg.to_radians();
    let dec_rad = dec_deg.to_radians();
    let h0_rad = h0_deg.to_radians();

    let cos_h0 = (h0_rad.sin() - lat_rad.sin() * dec_rad.sin())
               / (lat_rad.cos() * dec_rad.cos());

    if cos_h0 < -1.0 {
        return RiseSetResult::Circumpolar;
    }
    if cos_h0 > 1.0 {
        return RiseSetResult::NeverVisible;
    }

    let h0 = cos_h0.acos();
    let h0_hours = h0 * 12.0 / std::f64::consts::PI;

    let rise_lst = ra_hours - h0_hours;
    let set_lst = ra_hours + h0_hours;

    // ... LST to UTC conversion (see full implementation)

    RiseSetResult::Normal { rise_ms, set_ms }
}
```

---

## 3. Iterative Solution (Planets and Moving Objects)

### 3.1 Why Iteration Is Needed

The analytical solution assumes constant RA/Dec. This is an excellent approximation for stars (proper motion < 0.01 arcsecond per day) but breaks down for:

- **Moon**: moves ~13 degrees per day (RA changes by ~50 minutes/day)
- **Sun**: moves ~1 degree per day
- **Mercury/Venus**: can move up to 1.5 degrees per day near greatest elongation
- **Mars near opposition**: moves ~0.5 degrees per day

For these objects, the engine scans altitude over a 48-hour window and uses binary search to refine the exact horizon-crossing time.

### 3.2 Algorithm

```
Input:
  object_id        Planet/Sun/Moon identifier
  lat, lon         Observer location (degrees)
  start_time_ms    Beginning of search window (Unix ms)
  h0_deg           Standard altitude (degrees, default -0.5667)

Output:
  One of:
    (rise_time_ms, set_time_ms)   -- next rise and set
    ALWAYS_ABOVE                   -- above h0 for entire 48-hour window
    ALWAYS_BELOW                   -- below h0 for entire 48-hour window

Algorithm:

1. Initialize:
   step = 300000           // 5-minute intervals (ms)
   end_time = start_time_ms + 172800000   // 48 hours
   prev_alt = compute_altitude(object_id, lat, lon, start_time_ms)
   rise_found = false
   set_found = false

2. Scan for horizon crossings:
   t = start_time_ms + step
   while t <= end_time:
     (ra, dec) = compute_ephemeris(object_id, t)
     alt = compute_altitude(ra, dec, lat, lon, t)

     // Detect rising: previous below h0, current above h0
     if prev_alt < h0_deg and alt >= h0_deg and not rise_found:
       rise_time_ms = binary_search_crossing(t - step, t, RISING)
       rise_found = true

     // Detect setting: previous above h0, current below h0
     if prev_alt >= h0_deg and alt < h0_deg and not set_found and rise_found:
       set_time_ms = binary_search_crossing(t - step, t, SETTING)
       set_found = true

     if rise_found and set_found:
       return Normal { rise_ms, set_ms }

     prev_alt = alt
     t += step

3. If no crossing found:
   if prev_alt >= h0_deg: return ALWAYS_ABOVE
   else: return ALWAYS_BELOW
```

### 3.3 Binary Search Refinement

```
function binary_search_crossing(t1, t2, direction):
  // Precondition: crossing occurs between t1 and t2
  // direction: RISING or SETTING

  while (t2 - t1) > 60000:    // refine to 1-minute accuracy
    t_mid = (t1 + t2) / 2
    (ra, dec) = compute_ephemeris(object_id, t_mid)
    alt_mid = compute_altitude(ra, dec, lat, lon, t_mid)

    if direction == RISING:
      if alt_mid < h0_deg:
        t1 = t_mid       // crossing is after midpoint
      else:
        t2 = t_mid       // crossing is before midpoint
    else:  // SETTING
      if alt_mid >= h0_deg:
        t1 = t_mid
      else:
        t2 = t_mid

  return (t1 + t2) / 2
```

### 3.4 Performance

The iterative approach requires at most:
- Scan: 48 hours / 5 minutes = 576 altitude evaluations
- Binary search: log2(300000 / 60000) = ~3 iterations per crossing, each requiring one ephemeris + altitude evaluation

Total: ~580 evaluations. At ~50 microseconds each (ephemeris + transform), the total time is approximately 30 ms.

---

## 4. Circumpolar Detection

An object is **circumpolar** (never sets) when its declination and the observer's latitude satisfy:

```
|Dec| > 90° - |lat|    (same hemisphere)
```

More precisely:

| Condition | Observer Northern Hemisphere | Observer Southern Hemisphere |
|-----------|---------------------------|---------------------------|
| **Circumpolar** (never sets) | Dec > 90 - lat | Dec < -(90 - |lat|) |
| **Never visible** (never rises) | Dec < -(90 - lat) | Dec > 90 - |lat| |
| **Normal** (rises and sets) | All other cases | All other cases |

### 4.1 Examples

| Star | Dec | Observer Lat | Result |
|------|-----|-------------|--------|
| Polaris | +89.3 | +40 N | Circumpolar (89.3 > 50) |
| Polaris | +89.3 | -40 S | Never visible (89.3 > 50) |
| Sirius | -16.7 | +40 N | Normal (-16.7 between -50 and +50) |
| Acrux | -63.1 | +40 N | Never visible (-63.1 < -50) |
| Acrux | -63.1 | -40 S | Circumpolar (63.1 > 50) |

### 4.2 User Messaging

| Detection Result | User-Facing Message | Icon |
|-----------------|---------------------|------|
| Circumpolar | "Always visible from your location" | Circle with checkmark |
| Never visible | "Not visible from your location" | Circle with X |
| Below horizon now | "Rises at [time]" | Clock with arrow |
| Above horizon now | "Currently visible until [time]" | Eye icon |

---

## 5. Never-Visible Detection

An object is never visible when its maximum possible altitude is below the horizon. The maximum altitude occurs at meridian transit:

```
Alt_max = 90° - |lat - Dec|
```

If `Alt_max < h0` (standard altitude), the object never rises above the threshold. This is equivalent to the circumpolar condition for the opposite hemisphere.

The engine checks this before attempting any rise/set computation to avoid unnecessary work.

---

## 6. Sun Altitude Constraint

Objects are only meaningfully observable when the sky is sufficiently dark. The engine classifies observation conditions based on the Sun's altitude:

### 6.1 Twilight Definitions

| Twilight Type | Sun Altitude | Sky Condition | Observable Objects |
|---------------|-------------|---------------|-------------------|
| Daylight | > 0 | Full daylight | Sun, Moon only |
| Civil twilight | 0 to -6 | Bright, horizon visible | Moon, Venus, Jupiter |
| Nautical twilight | -6 to -12 | Dim, stars emerging | Bright stars, planets |
| Astronomical twilight | -12 to -18 | Dark, faint stars visible | All naked-eye objects |
| Full night | < -18 | Fully dark | All objects, deep sky |

### 6.2 Recommended Viewing Filter

FindMyStar defaults to civil twilight (`sun_alt < -6 degrees`) as the minimum darkness threshold for the "next visible" calculation. This means:

```rust
pub fn is_observable(object_alt: f64, sun_alt: f64) -> bool {
    object_alt > 0.0 && sun_alt < -6.0
}
```

For deep-sky objects (Messier catalog), the engine uses astronomical twilight (`sun_alt < -18 degrees`) because these objects require darker skies.

### 6.3 Integration with Rise/Set

When computing "next visible time," the engine combines the object's rise/set with the Sun's altitude:

```
1. Compute object rise time (analytical or iterative)
2. Compute Sun's altitude at object rise time
3. If sun_alt >= -6° at rise time:
   a. Scan forward from rise time until sun_alt < -6°
   b. Return that time as "first observable"
4. If object sets before sun_alt < -6°:
   Return "Not observable tonight"
```

---

## 7. Culmination (Transit)

### 7.1 Maximum Altitude

An object reaches its maximum altitude when it crosses the observer's meridian (Hour Angle = 0). The maximum altitude is:

```
Alt_max = 90° - |lat - Dec|       (for Dec and lat in same hemisphere)
Alt_max = 90° - (lat + |Dec|)     (for Dec and lat in opposite hemispheres)
```

Simplified:

```
Alt_max = 90° - |lat - Dec|
```

This value is always valid and is used to determine the "best viewing" altitude.

### 7.2 Transit Time

The object transits when LST = RA:

```
Transit_LST = RA
Transit_GMST = Transit_LST - (lon / 15.0)
Transit_UT = (Transit_GMST - GMST_0h) / 1.00273790935
```

### 7.3 Best Viewing Time Recommendation

The engine returns the transit time as the "Best Viewing Time" in the object info panel:

```rust
pub struct VisibilityInfo {
    pub rise_time_ms: Option<i64>,
    pub set_time_ms: Option<i64>,
    pub transit_time_ms: Option<i64>,
    pub max_altitude_deg: f64,
    pub status: VisibilityStatus,
}
```

If the transit occurs during daylight, the engine returns the time when the object is both above the horizon and the sky is dark enough, whichever is closer to transit.

---

## 8. Edge Cases

| Scenario | Detection | Handling | User Message |
|----------|-----------|----------|--------------|
| Object at exactly 0 altitude | `alt == h0` within epsilon | Treated as "rising" | "On the horizon now" |
| Observer at North Pole | `lat = 90` | All objects with Dec > 0 are circumpolar | Normal messaging applies |
| Observer at equator | `lat = 0` | No circumpolar objects; all objects rise and set | Normal messaging applies |
| Object Dec = 0 | On celestial equator | Always rises and sets; H0 = 6 hours | "Rises at [time], sets 12h later" |
| Midnight Sun (polar) | Sun circumpolar | No astronomical darkness | "Sky too bright for observing" |
| Moon rise during day | Moon above horizon but sun also up | Filter by sun altitude | "Moon visible after sunset" |
| Planet in retrograde | RA changes direction | Iterative solver handles correctly | Normal messaging |
| Grazing circumpolar | `cos(H0)` near -1 | Very brief dip below horizon | Rise/set times very close together |

---

## 9. Cross-References

- **[Core Astronomical Algorithms, Section 5](./algorithms.md#5-riseset-time-calculation)** -- Original pseudocode for analytical and iterative solvers
- **[Core Astronomical Algorithms, Section 6](./algorithms.md#6-visibility-filtering)** -- Sun altitude constraint
- **[Ephemeris Computation](./ephemeris.md)** -- Source of RA/Dec for iterative solver
- **[Coordinate Transforms](./coordinate-transforms.md)** -- Altitude computation used by iterative scanner
- **[Validation Strategy](./validation.md)** -- Sunrise/sunset validation against USNO data
- **[Error Bounds](./error-bounds.md)** -- Rise/set time accuracy analysis

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
