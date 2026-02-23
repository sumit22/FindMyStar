# Glossary

## 1. Overview

This glossary provides comprehensive definitions for all domain-specific, technical, and application-specific terms used throughout the FindMyStar documentation. Terms are organized into three categories: astronomical, technical, and app-specific. Each entry includes a full definition, units where applicable, and cross-references to related terms and documentation.

For algorithmic details referenced here, see [Algorithms](../04-domain-engine/algorithms.md). For requirement context, see the [SRS](./srs.md).

---

## 2. Astronomical Terms

| Term | Full Name | Definition | Units | Related Terms |
|------|-----------|-----------|-------|---------------|
| **RA** | Right Ascension | The celestial equivalent of longitude. Measures the angular distance of an object eastward along the celestial equator from the vernal equinox (First Point of Aries). Expressed in hours, minutes, and seconds (0h to 24h), where 1 hour = 15 degrees. | Hours (0-24) | Dec, LST, Epoch |
| **Dec** | Declination | The celestial equivalent of latitude. Measures the angular distance of an object north or south of the celestial equator. Positive values indicate north of the equator; negative values indicate south. | Degrees (-90 to +90) | RA, Alt, Circumpolar |
| **Alt** | Altitude (Elevation) | The angular height of a celestial object above the observer's local horizon. An altitude of 0 degrees means the object is on the horizon; 90 degrees means it is directly overhead (at the zenith). Negative values indicate the object is below the horizon. | Degrees (-90 to +90) | Az, Zenith, Nadir |
| **Az** | Azimuth | The compass direction of a celestial object measured clockwise from true north along the observer's horizon. North = 0 degrees, East = 90 degrees, South = 180 degrees, West = 270 degrees. | Degrees (0-360) | Alt, Meridian |
| **LST** | Local Sidereal Time | A timekeeping system based on Earth's rotation relative to the stars (not the Sun). LST equals the Right Ascension of objects currently crossing the observer's local meridian. It advances approximately 3 minutes 56 seconds faster than solar time per day. Essential for converting RA/Dec to Alt/Az. | Hours (0-24) | GMST, RA, Meridian |
| **GMST** | Greenwich Mean Sidereal Time | The Local Sidereal Time at the Prime Meridian (0 degrees longitude). GMST is computed from the Julian Date and serves as the reference for computing LST at any longitude: LST = GMST + (longitude / 15). See [Algorithms Section 2.1](../04-domain-engine/algorithms.md#21-greenwich-mean-sidereal-time-gmst). | Hours (0-24) | LST, JD |
| **JD** | Julian Date | A continuous count of days (and fractions of a day) since the beginning of the Julian Period (January 1, 4713 BC, 12:00 noon UTC). Used in astronomy because it provides a uniform time scale without calendar irregularities. Unix epoch (1970-01-01 00:00 UTC) corresponds to JD 2440587.5. See [Algorithms Section 1.1](../04-domain-engine/algorithms.md#11-unix-timestamp-to-julian-date). | Days (fractional) | Epoch, GMST |
| **Epoch** | Reference Epoch | A specific point in time used as a reference for celestial coordinates. The current standard epoch is J2000.0, defined as January 1, 2000, 12:00 TT (Terrestrial Time), which corresponds to JD 2451545.0. Star catalog positions (RA/Dec) are given for this epoch. | N/A (date reference) | JD, RA, Dec |
| **Ephemeris** | Ephemeris (plural: Ephemerides) | A table or computational model that provides the positions of celestial objects (RA, Dec, or other coordinates) as a function of time. FindMyStar uses VSOP87 as the planetary ephemeris and the Hipparcos catalog for star positions. | N/A (data source) | VSOP87, Hipparcos |
| **Circumpolar** | Circumpolar Object | A celestial object that never sets below the observer's horizon due to the combination of the object's declination and the observer's latitude. Condition: the object's declination is greater than (90 degrees minus the observer's latitude) for northern observers. Example: Polaris is circumpolar for all Northern Hemisphere observers. See [Algorithms Section 5.1](../04-domain-engine/algorithms.md#51-analytical-solution-for-fixed-stars). | N/A (classification) | Dec, Alt, H0 |
| **Ecliptic** | Ecliptic Plane | The apparent path of the Sun across the celestial sphere over the course of a year, which corresponds to the plane of Earth's orbit around the Sun. The ecliptic is tilted approximately 23.44 degrees relative to the celestial equator (this tilt is called the obliquity). Planets are found near the ecliptic. | Degrees (tilt: ~23.44) | RA, Dec, Epoch |
| **Zenith** | Zenith | The point on the celestial sphere directly above the observer. Corresponds to an altitude of exactly 90 degrees. The zenith is the highest point any object can reach in the observer's sky. | N/A (direction) | Alt, Nadir |
| **Nadir** | Nadir | The point on the celestial sphere directly below the observer, opposite the zenith. Corresponds to an altitude of -90 degrees. Objects at the nadir are on the far side of the Earth. | N/A (direction) | Zenith, Alt |
| **Meridian** | Local Meridian | An imaginary great circle on the celestial sphere passing through the zenith, nadir, and the north and south celestial poles. An object crosses (transits) the meridian when it reaches its highest altitude for that night. This event is called culmination. | N/A (reference line) | Culmination, Az, LST |
| **Culmination** | Upper Culmination | The moment when a celestial object crosses the observer's local meridian and reaches its maximum altitude above the horizon. This is the optimal time for observation because the object is highest in the sky and atmospheric effects are minimized. Also called meridian transit. | N/A (event) | Meridian, Alt, H0 |
| **H0** | Hour Angle at Rise/Set | The hour angle of a celestial object at the moment it rises above or sets below the horizon. Computed as: cos(H0) = -tan(latitude) * tan(declination). If |cos(H0)| > 1, the object is either circumpolar (never sets) or never visible (never rises). See [Algorithms Section 5.1](../04-domain-engine/algorithms.md#51-analytical-solution-for-fixed-stars). | Hours or Radians | RA, Dec, Circumpolar |
| **VSOP87** | Variations Seculaires des Orbites Planetaires (1987) | A mathematical model for computing the heliocentric positions (ecliptic longitude, latitude, and radius) of the major planets as a function of time. Developed by Pierre Bretagnon and Gerard Francou at the Bureau des Longitudes. FindMyStar uses VSOP87 coefficients bundled in the app to compute planet RA/Dec without network access. | N/A (algorithm/model) | Ephemeris, Epoch |
| **Hipparcos** | High Precision Parallax Collecting Satellite | An ESA space astrometry mission (1989-1993) that produced a catalog of 118,218 stars with precise positions, proper motions, parallaxes, and magnitudes. The Hipparcos catalog is the primary source for star positions in FindMyStar. The MVP includes the 100-500 brightest stars (magnitude < 5). | N/A (catalog) | RA, Dec, Epoch |
| **Apparent Magnitude** | Apparent Visual Magnitude | A measure of the brightness of a celestial object as seen from Earth. The scale is logarithmic and inverted: brighter objects have lower (or more negative) magnitudes. The Sun is magnitude -26.7; the faintest naked-eye stars are about magnitude 6.0. | Dimensionless (mag) | Hipparcos |
| **Twilight** | Twilight Periods | The period after sunset or before sunrise when the sky is partially illuminated by the Sun below the horizon. Civil twilight: Sun 0 to -6 degrees (bright enough to read); Nautical twilight: Sun -6 to -12 degrees; Astronomical twilight: Sun -12 to -18 degrees. FindMyStar uses the civil twilight boundary (Sun < -6 degrees) as the visibility threshold. | Degrees (Sun altitude) | Alt, Az |
| **Hour Angle** | Hour Angle (HA) | The angular distance of a celestial object measured westward along the celestial equator from the observer's local meridian. HA = LST - RA. When HA = 0, the object is transiting (on the meridian, at culmination). Positive HA means the object has passed the meridian (west of meridian); negative HA means it has not yet reached the meridian (east of meridian). | Hours (-12 to +12) | LST, RA, Meridian, Culmination |
| **Obliquity** | Obliquity of the Ecliptic | The angle between the Earth's equatorial plane and the ecliptic plane (Earth's orbital plane). Currently approximately 23.44 degrees and slowly decreasing. Used in converting ecliptic coordinates (from planetary ephemeris) to equatorial coordinates (RA/Dec). | Degrees (~23.44) | Ecliptic, RA, Dec |
| **Refraction** | Atmospheric Refraction | The bending of light as it passes through Earth's atmosphere, causing objects to appear slightly higher than their true geometric position. The effect is strongest near the horizon (about 0.5 degrees at altitude 0 degrees) and negligible above 15 degrees altitude. FindMyStar MVP does not correct for refraction; planned for Phase 2. | Degrees (0-0.5) | Alt, Culmination |
| **Precession** | Axial Precession | The slow, conical motion of Earth's rotation axis with a period of approximately 25,772 years. Precession causes the celestial coordinates (RA/Dec) of all objects to shift slowly over time. Star catalog positions are given for a specific epoch (J2000.0) and must be precession-corrected for high-accuracy work. Negligible for FindMyStar MVP accuracy targets. | Degrees per year (~0.014) | Epoch, RA, Dec |
| **Proper Motion** | Stellar Proper Motion | The apparent angular motion of a star across the sky due to its actual movement through space relative to the Sun. Measured in arcseconds per year. Most stars have negligible proper motion (< 0.1 arcsec/year), but some nearby stars (e.g., Barnard's Star at 10.3 arcsec/year) have measurable motion over decades. | Arcseconds/year | Hipparcos, RA, Dec |

---

## 3. Technical Terms

| Term | Full Name | Definition | Units | Related Terms |
|------|-----------|-----------|-------|---------------|
| **IMU** | Inertial Measurement Unit | A sensor package containing a gyroscope (angular velocity) and accelerometer (linear acceleration). Modern smartphones include 6-axis IMUs. Combined with a magnetometer, the IMU provides complete 3D device orientation. FindMyStar uses IMU data to determine which direction the phone camera is pointing. | N/A (hardware) | Quaternion, Q_device |
| **Quaternion** | Quaternion | A mathematical representation of 3D rotation using four components: (w, x, y, z), where w is the scalar part and (x, y, z) is the vector part. Quaternions avoid gimbal lock (a problem with Euler angles) and provide smooth interpolation between orientations. The device orientation is represented as a quaternion Q_device. See [Algorithms Section 8](../04-domain-engine/algorithms.md#8-quaternion-operations). | Dimensionless (w, x, y, z) | Q_device, IMU |
| **Q_device** | Device Orientation Quaternion | The quaternion representing the current 3D orientation of the user's device, derived from IMU sensor fusion (gyroscope + accelerometer + magnetometer). Used to compute the camera's pointing direction as a 3D unit vector. Updated at 30+ Hz. | Quaternion (w, x, y, z) | Quaternion, V_target, Angular Error |
| **V_target** | Target Direction Vector | A 3D unit vector pointing from the observer's position toward the celestial target object. Computed by converting the object's Alt/Az to Cartesian coordinates. The angular error between V_target and the camera direction (derived from Q_device) determines how far the user needs to rotate the phone. | Unit vector [x, y, z] | Q_device, Angular Error, Alt, Az |
| **FFI** | Foreign Function Interface | A mechanism that allows code written in one programming language to call functions written in another language. FindMyStar uses FFI to call the Rust domain engine from the React Native (JavaScript/TypeScript) layer. On iOS, FFI uses C-compatible headers; on Android, FFI uses JNI. | N/A (interface) | JNI, Rust |
| **JNI** | Java Native Interface | The standard mechanism for calling native code (C/C++/Rust) from Java/Kotlin on Android. FindMyStar's Rust domain engine is compiled as a shared object (.so) and invoked via JNI from the React Native Android bridge. | N/A (interface) | FFI, Rust |
| **ARCore** | Google ARCore | Google's augmented reality platform for Android. Provides motion tracking, environmental understanding, and light estimation. FindMyStar uses ARCore for camera access and basic motion tracking on Android devices. Requires ARCore-supported devices. | N/A (SDK) | ARKit |
| **ARKit** | Apple ARKit | Apple's augmented reality framework for iOS. Provides device tracking, scene understanding, and rendering capabilities. FindMyStar uses ARKit for camera access and motion tracking on iOS devices. Available on all iPhones since iPhone 6s. | N/A (SDK) | ARCore |
| **SQLite** | SQLite | A self-contained, serverless, zero-configuration, transactional SQL database engine. SQLite is the most widely deployed database engine in the world. FindMyStar uses SQLite for all local data persistence: celestial object catalog, tracked alarms, and user preferences. See [Database Schema](../05-data-model/schema.md). | N/A (database) | ACID, CRC |
| **ACID** | Atomicity, Consistency, Isolation, Durability | A set of properties that guarantee database transactions are processed reliably. SQLite provides full ACID compliance, ensuring that FindMyStar's alarm data and catalog data remain consistent even if the app crashes or the device loses power during a write operation. | N/A (property set) | SQLite |
| **CRC** | Cyclic Redundancy Check | An error-detecting code used to verify data integrity. FindMyStar computes a CRC-32 checksum of the bundled catalog data on app startup to detect corruption. If the checksum does not match the expected value, the catalog is restored from the bundled backup. See NFR-12 in [Non-Functional Requirements](./non-functional-requirements.md). | 32-bit integer | SQLite, Catalog |
| **WAL** | Write-Ahead Logging | A SQLite journaling mode that allows concurrent reads and writes and provides better crash recovery than the default rollback journal. FindMyStar enables WAL mode for improved performance during alarm recalculation (writes) while the UI reads catalog data. | N/A (mode) | SQLite, ACID |
| **SGP4** | Simplified General Perturbations Model 4 | A mathematical model for propagating the orbits of Earth-orbiting satellites using Two-Line Element (TLE) data. Used for predicting satellite passes (ISS, Starlink). Planned for Phase 2 satellite tracking feature. | N/A (algorithm) | TLE |
| **TLE** | Two-Line Element Set | A standardized format for encoding the orbital elements of an Earth-orbiting satellite. TLEs are published by NORAD/CelesTrak and typically valid for 5-7 days. Phase 2 satellite tracking will require periodic TLE updates (network dependent). | N/A (data format) | SGP4 |

---

## 4. Application-Specific Terms

| Term | Definition | Context | Related Terms |
|------|-----------|---------|---------------|
| **Target Lock** | A state in which the user's device is pointed within 0.5 degrees of the target celestial object for at least 2 continuous seconds. Indicated by a "TARGET LOCKED" message and optional audio cue on the AR tracking screen. Lock clears when angular error exceeds 1.0 degrees (hysteresis). | FR-7, AR Tracking Screen | Angular Error, Q_device, V_target |
| **Angular Error** | The angular distance (in degrees) between the direction the device camera is pointing (derived from Q_device) and the direction of the target object (V_target). Ranges from 0 degrees (perfect alignment) to 180 degrees (pointing opposite direction). Drives the color of the guidance arrow: red (> 5 deg), yellow (1-5 deg), green (< 1 deg). See [Algorithms Section 4.1](../04-domain-engine/algorithms.md#41-angular-error-between-two-unit-vectors). | FR-5, FR-6 | Target Lock, V_target, Q_device |
| **Visibility Alert** | A local OS notification triggered when a tracked celestial object rises above the horizon (and the Sun is below -6 degrees). The notification includes the object name, rising direction, and approximate altitude. Users can set one-time or recurring visibility alerts from the object info screen. | FR-16, FR-17 | Rise/Set, Twilight, Alarm |
| **Tracking Mode** | The active AR state in which the app continuously computes the target object's position, the device's orientation, and the angular error between them at 30+ FPS. The AR screen displays a directional arrow, angular distance readout, and target lock indicator. Tracking mode keeps the screen awake and consumes more battery than passive modes. | FR-4, FR-21 | Target Lock, Angular Error, AR |
| **Guidance Arrow** | The on-screen directional indicator on the AR tracking screen that shows the user which way to rotate the phone to align with the target object. The arrow rotates to indicate direction (left, right, up, down) and changes color based on proximity (red > 5 deg, yellow 1-5 deg, green < 1 deg). | FR-6 | Angular Error, Tracking Mode |
| **Visibility Status** | The classification of a celestial object's current observability. One of: "Visible now" (above horizon and dark sky), "Rises at [TIME]" (currently below horizon, will rise within 48 hours), "Always visible" (circumpolar), or "Not visible from your location" (never rises at this latitude). | FR-9, FR-11, FR-12 | Alt, Circumpolar, Twilight |
| **Alarm Recalculation** | The daily background process (triggered at midnight local time) that recomputes the next visible time for all tracked objects and reschedules OS notifications accordingly. Handles date changes, location changes, timezone changes, and Daylight Saving Time transitions. Must complete within 30 seconds on iOS and 10 minutes on Android. | FR-18 | Visibility Alert, Rise/Set |
| **Catalog** | The pre-loaded database of celestial objects bundled with the app. Includes the Sun, Moon, 8 planets, 100-500 bright stars from the Hipparcos catalog, and approximately 110 Messier objects. Stored in the SQLite `objects` table. Read-only; updated only through app version releases. | FR-1, FR-2 | Hipparcos, Messier, SQLite |
| **Messier Object** | One of the approximately 110 deep-sky objects cataloged by French astronomer Charles Messier in the 18th century. Includes nebulae (M1 Crab Nebula), star clusters (M45 Pleiades), and galaxies (M31 Andromeda Galaxy). These objects are popular amateur observation targets and form a core part of FindMyStar's catalog. | Catalog, FR-1 | Apparent Magnitude, Hipparcos |
| **Sensor Fusion** | The process of combining data from multiple sensors (gyroscope, accelerometer, magnetometer) into a single, stable estimate of device orientation (Q_device). Sensor fusion filters out noise, compensates for gyroscope drift, and resolves ambiguities that individual sensors cannot. Implemented in the SensorFusionService. | Architecture, NFR-10 | IMU, Q_device, Quaternion |
| **Domain Engine** | The Rust-based core computation library that contains all astronomical algorithms: ephemeris computation, coordinate transformations, rise/set calculations, vector mathematics, and quaternion operations. The domain engine is deterministic (same inputs always produce same outputs), has no I/O or side effects, and is independently testable. See [Architecture Overview](../03-architecture/architecture-overview.md). | Architecture, ADR-0002 | Rust, FFI, Ephemeris |

---

## 5. Units Reference

| Quantity | Primary Unit | Conversion | Usage in FindMyStar |
|----------|-------------|-----------|-------------------|
| Right Ascension | Hours (0-24) | 1h = 15 degrees = 60 minutes of RA | Stored as decimal hours (e.g., 6.7525) |
| Declination | Degrees (-90 to +90) | 1 degree = 60 arcminutes = 3600 arcseconds | Stored as decimal degrees (e.g., -16.7161) |
| Altitude | Degrees (-90 to +90) | N/A | Computed; displayed to user |
| Azimuth | Degrees (0-360) | N/A | Computed; 0 = North |
| Angular distance | Degrees (0-180) | 1 degree = 60 arcminutes | Displayed on AR screen |
| Time | UTC milliseconds | 1000 ms = 1 second | Internal; converted to local for display |
| Julian Date | Days (fractional) | 1 JD = 86400 seconds | Internal computation only |
| Sidereal Time | Hours (0-24) | 1h = 15 degrees | Internal computation only |
| Latitude/Longitude | Decimal degrees | 1 degree latitude = ~111 km | From device GPS |
| Apparent magnitude | Dimensionless | Logarithmic; lower = brighter | Stored in catalog; displayed to user |

---

## 6. Abbreviations Quick Reference

| Abbreviation | Full Form |
|-------------|-----------|
| Alt | Altitude |
| Az | Azimuth |
| RA | Right Ascension |
| Dec | Declination |
| LST | Local Sidereal Time |
| GMST | Greenwich Mean Sidereal Time |
| JD | Julian Date |
| H0 | Hour Angle at Rise/Set |
| IMU | Inertial Measurement Unit |
| FFI | Foreign Function Interface |
| JNI | Java Native Interface |
| AR | Augmented Reality |
| CRC | Cyclic Redundancy Check |
| ACID | Atomicity, Consistency, Isolation, Durability |
| WAL | Write-Ahead Logging |
| TLE | Two-Line Element Set |
| SGP4 | Simplified General Perturbations 4 |
| VSOP87 | Variations Seculaires des Orbites Planetaires (1987) |
| USNO | United States Naval Observatory |
| JPL | Jet Propulsion Laboratory |
| IAU | International Astronomical Union |
| SOFA | Standards of Fundamental Astronomy |
| ESA | European Space Agency |
| WCAG | Web Content Accessibility Guidelines |
| GDPR | General Data Protection Regulation |
| CCPA | California Consumer Privacy Act |
| COPPA | Children's Online Privacy Protection Act |
| MVP | Minimum Viable Product |
| FPS | Frames Per Second |

---

## 7. Cross-References

| Document | Relationship |
|----------|-------------|
| [Algorithms](../04-domain-engine/algorithms.md) | Detailed mathematical definitions for astronomical computations |
| [SRS](./srs.md) | Original glossary (Section 6) this document expands |
| [Architecture Overview](../03-architecture/architecture-overview.md) | Technical architecture terms in context |
| [Functional Requirements](./functional-requirements.md) | FR references for app-specific terms |
| [Non-Functional Requirements](./non-functional-requirements.md) | NFR references for performance and accuracy terms |
| [Constraints](./constraints.md) | Technical constraint context for platform terms |
| [Database Schema](../05-data-model/schema.md) | SQLite schema for catalog and alarm data structures |
| [ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md) | Rust/FFI decision context |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md) | Offline architecture context |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Engineering Team
