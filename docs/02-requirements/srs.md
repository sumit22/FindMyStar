# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose

This Software Requirements Specification (SRS) defines functional and non-functional requirements for the **FindMyStar** offline celestial object tracking and visibility alert application.

This document serves as:
- Contractual basis for development
- Validation criteria for testing
- Reference for stakeholders
- Foundation for architecture design

### 1.2 Scope

The system shall provide a mobile application that enables users to:
1. Search celestial objects from a pre-loaded catalog
2. Receive real-time AR guidance to locate objects
3. Determine object visibility from their location
4. Schedule local notifications for optimal viewing

The system operates **completely offline** with **no backend infrastructure**.

#### In Scope
- ✅ Sun, Moon, 8 major planets
- ✅ 100-500 brightest stars (Hipparcos catalog)
- ✅ ~110 Messier objects (deep-sky)
- ✅ Real-time AR guidance
- ✅ Rise/set calculation
- ✅ Local SQLite storage
- ✅ OS-level notifications

#### Out of Scope
- ❌ Telescope motor control
- ❌ Plate solving / image alignment
- ❌ Astrophotography processing
- ❌ Cloud services / backend
- ❌ Social features
- ❌ User accounts
- ❌ Live satellite updates (Phase 2+)

### 1.3 Document Organization

1. **Introduction** - Purpose, scope, definitions
2. **Overall Description** - Product perspective, user classes, operating environment
3. **Functional Requirements** - Detailed requirements (FR-1 to FR-16)
4. **Non-Functional Requirements** - Performance, security, reliability
5. **Constraints** - Technical and business limitations
6. **Glossary** - Terminology and abbreviations

---

## 2. Overall Description

### 2.1 Product Perspective

FindMyStar is a **self-contained mobile application** with:
- **Deterministic core** - Pure mathematical astronomy engine
- **Offline-first architecture** - No cloud dependency
- **Modular design** - Domain logic separated from UI
- **Layered structure** - Presentation → Application → Domain → Data

The application integrates with:
- Device GPS (location)
- Device IMU (device orientation via gyroscope, magnetometer, accelerometer)
- Device system time
- OS notification system

### 2.2 User Classes

| User Class | Percentage | Characteristics | Use Cases |
|------------|-----------|-----------------|-----------|
| Casual Stargazer | 40% | New to astronomy, wants to identify stars | Find bright planets, popular stars |
| Hobby Astronomer | 50% | Experienced, regular observer | Precision pointing, rise/set alerts |
| Night Sky Enthusiast | 10% | Educational interest | Learn constellations, explore objects |

### 2.3 Operating Environment

**Supported Platforms:**
- Android 10+ (ARCore)
- iOS 14+ (ARKit)

**Device Requirements:**
- GPS capability
- 6-axis IMU (gyroscope + accelerometer)
- Magnetometer (for orientation)
- 50MB free storage
- 2GB RAM minimum

**Network:**
- No network connectivity required
- Offline operation guaranteed

---

## 3. Functional Requirements

### 3.1 Object Search

**FR-1: User shall search object by name**
- User enters partial or full object name
- System performs case-insensitive substring search
- Results displayed within 100ms
- Examples: "Saturn", "Pol", "Andromeda", "M31"

**FR-2: System shall retrieve object metadata**
- Object type (planet, star, nebula, galaxy)
- Right Ascension (RA)
- Declination (Dec)
- Apparent magnitude
- Current altitude and azimuth

**FR-3: System shall handle search edge cases**
- Unknown object → "No results found"
- Partial matches → Suggest similar names
- Typos → Fuzzy matching (optional Phase 2)

### 3.2 Real-Time Object Tracking

**FR-4: System shall compute object position in real-time**
- Update frequency: ≥30 FPS
- Latency: <15ms from sensor to display
- Uses device time + location + device orientation

**FR-5: System shall compute angular error**
- Angular difference between device direction and object direction
- Accuracy: ±1° under good conditions
- Metric: degrees (0° = perfect alignment)

**FR-6: System shall render directional guidance**
- On-screen arrow pointing toward object
- Arrow color changes with proximity:
  - Red: >5° away
  - Yellow: 1-5° away
  - Green: <1° away

**FR-7: System shall indicate target lock state**
- When angular error < 0.5°: Display "TARGET LOCKED"
- Maintain lock for 2+ seconds
- Visual + optional audio feedback

### 3.3 Visibility Computation

**FR-8: System shall compute current altitude**
- Altitude = angle above horizon (-90° to +90°)
- Consider observer location (lat/lon)
- Consider current time (UTC)
- Result in ≤10ms

**FR-9: System shall determine visibility status**
- If altitude > 0° and not below sun visibility threshold
  - Status: "Visible now"
- Else if object reaches altitude > 0° within 48h
  - Status: "Rises at [TIME]"
  - Show angular altitude at culmination

**FR-10: System shall filter by sun brightness**
- Object not visible if Sun altitude > -6° (civil twilight)
- Only notify when Sun altitude < -6°
- Prevents notifications during daylight

**FR-11: System shall handle circumpolar objects**
- Detect if object never sets
- Condition: latitude > 90° - declination
- Display: "Always visible from your location"

**FR-12: System shall detect never-visible objects**
- Detect if object never rises
- Display: "Not visible from your location"
- Suggest next visible date if < 1 year

### 3.4 Rise/Set Calculation

**FR-13: System shall compute rise time for stars**
- Use analytical solution (Hour Angle formula)
- Return: Rise time in local timezone
- Accuracy: ±2 minutes
- Handle edge cases (circumpolar, never-visible)

**FR-14: System shall compute rise time for planets**
- Use iterative scan (5-minute intervals)
- Scan forward 48 hours from now
- Return: First crossing of altitude threshold
- Accuracy: ±5 minutes

**FR-15: System shall compute optimal altitude**
- For each object, find time of culmination (max altitude)
- Return: Time + altitude value
- Enable "best viewing time" recommendation

### 3.5 Alarm Scheduling

**FR-16: User shall set visibility alarm**
- Select object from search results
- Choose alarm type:
  - "Notify when visible" (one-time)
  - "Daily alert" (recurring)
- Confirmation: "Alert set for [DATE TIME]"

**FR-17: System shall schedule OS notification**
- Use Android: AlarmManager / WorkManager
- Use iOS: UNUserNotificationCenter
- Scheduled for computed rise time
- Notification includes object name + rising direction

**FR-18: System shall recompute alarms daily**
- Background task at midnight (device-local time)
- Update all tracked objects' next visible times
- Reschedule OS notifications
- Handle timezone changes

**FR-19: System shall display alarm management UI**
- List all active alarms
- Show next notification time
- Delete alarm on-demand
- Edit alarm threshold altitude

### 3.6 User Interface

**FR-20: System shall provide search screen**
- Text input field
- Search results list (name, type, magnitude)
- Tap to view details

**FR-21: System shall provide AR tracking screen**
- Live camera preview
- Directional arrow overlay
- Angular distance indicator
- Target lock indicator
- "Lock" / "Unlock" button

**FR-22: System shall provide object info screen**
- Object metadata (name, type, magnitude, distance)
- Current altitude + azimuth
- Rise/set times today
- Max altitude + culmination time
- "Set Alert" button

**FR-23: System shall provide alarm management**
- List of tracked objects with alerts
- Next notification time for each
- Delete/edit functionality

---

## 4. Non-Functional Requirements

### 4.1 Performance

**NFR-1: Position Computation**
- RA/Dec → Alt/Az transformation: <10ms
- 3D vector operations: <5ms
- Angular error calculation: <5ms
- Target achieved: 30+ FPS AR updates

**NFR-2: Alarm Computation**
- Rise/set time calculation: <500ms
- Circumpolar detection: <100ms
- Batch alarm recalculation (100 objects): <5s

**NFR-3: Memory Usage**
- App footprint: <100MB
- Catalog in memory: <50MB
- Runtime heap: <80MB

**NFR-4: Battery Efficiency**
- AR mode: <10% battery/hour
- Background mode: <1% battery/hour
- GPS update interval: 1 minute (configurable)

### 4.2 Reliability

**NFR-5: Offline Operation**
- Zero network dependency
- All features work without internet
- Graceful degradation if GPS unavailable

**NFR-6: Mathematical Correctness**
- Domain engine unit test coverage: >90%
- Validation against USNO/JPL ephemeris data
- Maximum positional error: ±1°

**NFR-7: Crash Rate**
- Production crash rate: <0.1%
- All exceptions handled gracefully
- Error recovery without user intervention

### 4.3 Accuracy Requirements

**NFR-8: Positional Accuracy**
- Horizontal accuracy: ±1° (phone IMU)
- Rise/set accuracy: ±2 minutes (stars), ±5 minutes (planets)
- Altitude accuracy: ±0.5°

**NFR-9: Time Accuracy**
- Requires system time accuracy within ±1 minute
- Display warning if device time heavily skewed
- Adjust for timezone changes automatically

**NFR-10: Attitude/Orientation**
- Quaternion-based orientation from IMU fusion
- Calibration prompt if magnetometer error > 10°
- Recovery: Manual star alignment (Phase 2)

### 4.4 Data Integrity

**NFR-11: SQLite Data Consistency**
- ACID compliance for tracked objects
- Corruption detection on startup
- Automatic recovery via schema reload

**NFR-12: Catalog Integrity**
- Pre-loaded catalog validation on install
- CRC check for catalog files
- Fallback to bundled backup if corruption

### 4.5 Usability

**NFR-13: UI Responsiveness**
- All UI interactions: <200ms response
- Smooth animations: 60 FPS
- Touch latency: <100ms

**NFR-14: Accessibility**
- Support for screen readers
- High contrast mode
- Text scaling support

---

## 5. Constraints

### 5.1 Technical Constraints

| Constraint | Details |
|-----------|---------|
| Offline Operation | No backend, all computation local |
| Data Persistence | SQLite only, no cloud sync |
| Platform | iOS 14+ and Android 10+ minimum |
| Device IMU | Requires modern sensors |
| App Size | <150MB (store requirement) |
| Catalog Size | <30MB for full feature set |

### 5.2 Accuracy Limitations

| Limitation | Reason | Workaround |
|-----------|--------|-----------|
| ±1° accurracy | Phone IMU is inherently noisy | Manual alignment in Phase 2 |
| Refraction errors | No atmospheric model | Add correction later |
| Magnetic interference | Metal structures affect compass | Calibration prompt |
| Time skew | User's device clock may be wrong | User-initiated sync |

### 5.3 Business Constraints

| Constraint | Details |
|-----------|---------|
| Monetization | App Store / Play Store only |
| Pricing | $2.99 - $6.99 or ₹499-799 |
| Maintenance | Solo developer viable |
| Support | Community + GitHub issues |

---

## 6. Glossary

| Term | Definition |
|------|-----------|
| **RA** | Right Ascension - celestial longitude (0-24h) |
| **Dec** | Declination - celestial latitude (-90° to +90°) |
| **Alt** | Altitude - angle above horizon (-90° to +90°) |
| **Az** | Azimuth - compass direction (0-360°) |
| **LST** | Local Sidereal Time - astronomical timescale |
| **JD** | Julian Date - continuous count of days |
| **IMU** | Inertial Measurement Unit (gyro + accel) |
| **Q_device** | Quaternion representing device orientation |
| **V_target** | 3D vector pointing toward celestial object |
| **H0** | Hour Angle at rise/set |
| **Circumpolar** | Object that never sets below horizon |
| **Ephemeris** | Table of celestial object positions over time |

---

**Document Status**: Approved  
**Version**: 1.0  
**Last Updated**: February 2026  
**Owner**: Product & Engineering Team
