# Frequently Asked Questions

## 1. User FAQ

### General Usage

**Q: What is FindMyStar?**

A: FindMyStar is a fully offline mobile app that helps you find celestial objects in the sky. Point your phone at the sky and follow the AR guidance arrow to locate stars, planets, the Moon, the Sun, and deep-sky objects like galaxies and nebulae. You can also set visibility alarms to be notified when an object rises above the horizon.

---

**Q: Does FindMyStar require an internet connection?**

A: No. FindMyStar is 100% offline. All celestial data is bundled with the app, and all calculations happen on your device. You can use it in airplane mode, in remote locations, or anywhere without cell service.

---

**Q: Does this app use my data or track me?**

A: No. FindMyStar collects zero data. Your location is used only for local astronomical calculations and never leaves your device. We do not collect analytics, crash reports, or any personal information. There are no user accounts, no telemetry, and no advertising. See [SECURITY.md](./SECURITY.md) for details.

---

**Q: What devices are supported?**

A: FindMyStar supports iOS 14+ (iPhone) and Android 10+ (API level 29). The app requires GPS, camera, and motion sensors (accelerometer, gyroscope, magnetometer). Most modern smartphones have all of these.

---

**Q: What celestial objects are included?**

A: The MVP catalog includes approximately 620 objects:

| Category | Count | Examples |
|----------|-------|---------|
| Sun | 1 | The Sun |
| Moon | 1 | The Moon |
| Planets | 8 | Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto |
| Stars | ~500 | Sirius, Polaris, Betelgeuse, Vega, and the brightest stars |
| Messier objects | ~110 | Andromeda Galaxy (M31), Orion Nebula (M42), Pleiades (M45) |

More objects will be added in future updates.

---

### AR Guidance & Accuracy

**Q: Why isn't the arrow pointing the right way?**

A: Your phone's magnetometer (compass sensor) may need calibration. To calibrate:

1. Move your phone in a slow figure-8 pattern several times
2. Ensure you are away from large metal objects, speakers, or electronics
3. Move outdoors if inside a building (structural metal causes interference)
4. Try rotating your phone through all three axes

If the problem persists, check that your device's compass works correctly in a compass app.

---

**Q: How accurate is the positioning?**

A: Under good conditions (outdoors, calibrated magnetometer, clear of metal):

| Condition | Typical Accuracy |
|-----------|-----------------|
| Freshly calibrated, outdoors | approximately 0.5 to 1 degree |
| After 10 minutes of use | approximately 1 to 2 degrees |
| Near metal or electronics | approximately 2 to 5 degrees (warning displayed) |
| Premium phones (better sensors) | approximately 0.5 degrees or better |

This is sufficient to point you at the correct area of sky. At 1 degree accuracy, you can distinguish objects about two full-moon widths apart.

---

**Q: Will this work indoors?**

A: The AR guidance requires outdoor use for accurate compass readings. Indoor use will have poor accuracy due to magnetic interference from building structures and appliances. The non-AR features (search, object info, rise/set times, alarms) work normally indoors.

---

**Q: What does the "locked" indicator mean?**

A: When the angular error between your phone's pointing direction and the target is less than a threshold (typically 2 to 5 degrees), the app shows "locked." This means your phone is pointing at the target. Look along your phone's line of sight to find the object.

---

### Visibility & Alarms

**Q: Why does the app say "Not visible from your location"?**

A: Some celestial objects are below the horizon from your latitude. For example, the Southern Cross is not visible from most of the Northern Hemisphere (above ~25 degrees N). Planets may also be below the horizon at certain times. If an object will rise later, you can set an alarm to be notified.

---

**Q: Why didn't I get my alarm notification?**

A: Several things can prevent notifications:

**Android**: check notification permissions, add FindMyStar to battery optimization exceptions (Settings > Battery > Battery optimization > FindMyStar > Don't optimize), and check [dontkillmyapp.com](https://dontkillmyapp.com) for device-specific instructions from manufacturers that aggressively kill background apps.

**iOS**: check notification permissions (Settings > Notifications > FindMyStar), ensure Background App Refresh is enabled, and check that Focus mode is not blocking FindMyStar.

**Both**: verify the alarm is enabled in the app, and confirm the object actually becomes visible from your location.

---

**Q: How far in advance does the alarm notify me?**

A: The alarm fires at the computed rise time of the object. The daily recalculation task runs at midnight to update all alarm times for the next 24 hours.

---

### Battery & Miscellaneous

**Q: Does FindMyStar drain a lot of battery?**

A: Battery usage depends on the mode:

| Mode | Drain | Notes |
|------|-------|-------|
| AR tracking (active) | ~8%/hr | Camera, GPS, and motion sensors all active |
| Object info screen | ~3%/hr | GPS intermittent; no camera or sensors |
| Background | <0.5%/hr | Only alarm recalculation at midnight |

Tips: reduce screen brightness, exit AR when not tracking, close other background apps.

---

**Q: Can I use this with a telescope?**

A: Telescope integration (GoTo mount control) is planned for Phase 3 (v1.2). Currently, FindMyStar guides your naked eye or binoculars to the target area.

---

**Q: Why is [object] not in the catalog?**

A: The MVP includes ~620 commonly observed targets. Request additions via GitHub Issues. Additional catalogs (NGC, double stars, variable stars) are planned for future updates.

---

## 2. Developer FAQ

### Development Environment

**Q: How do I set up the development environment?**

A: See [build-process.md](./09-devops/build-process.md) for complete instructions. You need Rust (stable), Node.js 18+, and mobile SDKs (Android Studio + NDK, Xcode 14+).

```bash
git clone https://github.com/yourusername/FindMyStar.git
cd FindMyStar
cd core && cargo test        # Rust domain engine
cd ../mobile && npm install  # Mobile app
npm start                    # Start Metro bundler
```

---

**Q: Why are Rust tests failing?**

A: Common causes:

| Symptom | Fix |
|---------|-----|
| `failed to resolve` dependency | Run `cargo update` |
| nalgebra version mismatch | Pin version in `Cargo.toml` |
| Test assertion failure | Compare output against USNO reference data |
| Linker error | `rustup target add <target>` |

Run with detailed output: `cargo test -- --nocapture`

---

**Q: How do I validate against USNO data?**

A: Run `cargo test --test validation_tests`. This compares computed positions against reference data from the U.S. Naval Observatory and JPL Horizons (100+ test cases covering stars, planets, rise/set times, and sidereal time). See [validation.md](./04-domain-engine/validation.md).

---

### Astronomical Concepts

**Q: What is LST (Local Sidereal Time)?**

A: LST is the astronomical timescale based on Earth's rotation relative to stars (not the Sun). It is essential for converting celestial coordinates (RA/Dec) to local sky coordinates (Alt/Az). At any moment, LST equals the Right Ascension of objects on the local meridian. Computation: LST = GMST + observer's longitude (in hours). See [algorithms.md](./04-domain-engine/algorithms.md) Section 2.

---

**Q: What coordinate systems does FindMyStar use?**

A: Three systems: **Equatorial** (RA/Dec, catalog positions), **Horizontal** (Alt/Az, local sky position), and **Cartesian 3D** (unit vectors for AR angular error). The domain engine transforms Equatorial to Horizontal to Cartesian. See [coordinate-transforms.md](./04-domain-engine/coordinate-transforms.md).

---

### Common Tasks

**Q: How do I add a new celestial object?**

A: See [CONTRIBUTING.md](./CONTRIBUTING.md) Section "Common Tasks." Add the object to the catalog SQL (`objects` table) with RA, Dec, magnitude, and type. Write a visibility test. Run the full test suite.

---

**Q: How do I debug device orientation issues?**

A: Enable debug mode in Settings to display raw quaternion values, computed Alt/Az, FPS counter, and angular error. **Calibration reference**: Polaris (North Star) altitude should approximately equal your latitude. If it does not match, device orientation is off.

---

**Q: How does the FFI bridge work?**

A: The Rust domain engine compiles as a native library (.dylib for iOS, .so for Android). React Native communicates via Native Modules bridge: TypeScript calls a platform-specific native module (Java/Kotlin or ObjC/Swift), which calls the Rust FFI. All inputs are validated on both sides. See [architecture-overview.md](./03-architecture/architecture-overview.md) Section 7.

---

## 3. Known Issues

| Issue | Workaround | Status |
|-------|-----------|--------|
| Magnetometer interference near metal | Move 2m+ away; recalibrate with figure-8 | By design (hardware limitation) |
| Time sync issues | Ensure device time is set to automatic | User warning displayed |
| GPS accuracy in urban canyons | Wait for better fix, or enter location manually | Phase 2: enhanced location |
| Moon position approximately 1 degree off | Sufficient for finder use | Phase 2: improved model |
| Atmospheric refraction at horizon | Adds approximately 0.5 degrees error near horizon | Phase 2: refraction correction |
| Android background task killed | Add to battery optimization exceptions | OS limitation |
| Gyroscope drift in long sessions | Periodically recalibrate | Phase 2: auto-recalibration |

---

## 4. Troubleshooting Quick Reference

| Symptom | Most Likely Cause | Quick Fix |
|---------|------------------|-----------|
| Arrow points wrong | Uncalibrated magnetometer | Figure-8 calibration |
| "Not visible" for known-visible object | Device clock wrong | Set time to automatic |
| No alarm notification (Android) | Battery optimization killing app | Add to battery exceptions |
| No alarm notification (iOS) | Background App Refresh disabled | Enable in Settings |
| Blank AR screen | Camera permission denied | Grant permission in Settings |
| "Location unavailable" | GPS permission denied or no fix | Grant permission; go outdoors |
| High battery drain | AR mode left active | Exit AR when not tracking |

---

## 5. Getting Help

- **GitHub Issues**: bug reports and feature requests (include device model, OS version, steps to reproduce)
- **GitHub Discussions**: general questions and community help
- **Email**: private support (address in app's About screen)

---

## 6. Cross-References

| Document | Relationship |
|----------|-------------|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development setup, common tasks, code style |
| [Algorithms](./04-domain-engine/algorithms.md) | Mathematical foundations (LST, coordinate transforms) |
| [Build Process](./09-devops/build-process.md) | Build and setup instructions |
| [SECURITY.md](./SECURITY.md) | Privacy policy and data handling |
| [OPERATIONS.md](./OPERATIONS.md) | Troubleshooting runbooks and support procedures |
| [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) | Battery and performance details |
| [Non-Functional Requirements](./02-requirements/non-functional-requirements.md) | Accuracy targets |

---

**Last Updated**: February 2026
