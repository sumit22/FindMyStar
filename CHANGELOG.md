# Changelog

All notable changes to FindMyStar will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### In Development

- [ ] Phase 1 MVP core functionality
- [ ] Rust domain engine implementation
- [ ] React Native mobile UI
- [ ] Database schema finalization

---

## [1.0.0] - 2026-06-15 (Projected)

### Phase 1: MVP Release

#### Added

**Core Mathematics**
- Sidereal time computation (GMST + LST)
- RA/Dec to Alt/Az coordinate transformation
- Julian Date calculations
- Quaternion-based device orientation
- Angular error computation (3D vector math)

**Celestial Objects**
- Sun position ephemeris
- Moon position ephemeris (simplified)
- 8 major planets (VSOP87 model)
- 100-500 brightest stars (Hipparcos catalog)
- ~110 Messier deep sky objects

**AR Guidance System**
- Real-time object tracking (30+ FPS)
- Directional arrow overlay
- Angular distance display
- Target lock state indicator (< 0.5° threshold)
- Proximity-based color feedback (red/yellow/green)

**Visibility System**
- Current altitude computation
- Rise/set time calculation (analytical for stars, iterative for planets)
- Circumpolar detection
- Never-visible detection
- Sun altitude filtering (civil twilight)

**Alarm System**
- Set visibility alerts
- Local OS notifications
- Daily alarm recalculation
- SQLite persistence for tracked objects

**User Interfaces**
- Search screen (by object name)
- AR tracking screen (camera-based guidance)
- Object info screen (metadata + visibility)
- Alarm management screen

**Data & Persistence**
- SQLite database (local only)
- Pre-loaded celestial catalog
- User preferences storage
- Backup & corruption recovery

#### Technical

- Rust core engine (all astronomy algorithms)
- React Native mobile app
- Native bridges (Android JNI, iOS Objective-C)
- ARCore integration (Android)
- ARKit integration (iOS)
- GPS + IMU sensor fusion
- Offline-first architecture

#### Performance

- Position computation: < 10ms
- AR frame rate: 30+ FPS
- Memory footprint: ~80MB
- Battery drain: ~8% per hour (AR mode)
- App size: < 100MB

#### Documentation

- Software Requirements Specification (SRS)
- System architecture documentation
- Algorithm reference guide
- Database schema documentation
- API contracts
- Contributing guidelines

---

## [1.1.0] - 2026-09-15 (Projected)

### Phase 2: Growth & Enhancements

#### Added

**New Objects**
- Satellite tracking (ISS, Starlink, etc.)
- TLE-based orbital propagation (SGP4)
- Comet position predictions
- Meteor shower radiant points
- Variable star magnitude tracking

**Features**
- Satellite pass predictions
- Brightness alerts
- Observation logging (local history)
- Manual alignment calibration (2-star/3-star)
- Customizable altitude thresholds
- Advanced search filters

**Performance**
- Caching layer for orbit predictions
- Optimized batch calculations
- 60 FPS baseline (increased from 30)

#### Documentation

- Algorithm validation against USNO/JPL
- Testing strategy & benchmarks
- Architecture Decision Records (ADRs)

---

## [1.2.0] - 2026-12-15 (Projected)

### Phase 3: Telescope & Astrophotography

#### Added

**Telescope Integration**
- Digital setting circles (manual telescope assist)
- 2-star/3-star alignment calibration
- Field of view preview
- Polar alignment assistant

**Astrophotography**
- Exposure time recommendations
- Optimal altitude alerts
- Meridian flip prediction
- Light pollution awareness

**Cloud (Optional Premium)**
- Observation history sync (user opt-in)
- Multi-device support (Enterprise only)
- Privacy-controlled sharing

#### Monetization

- Premium tier launch
- Professional licensing tier

---

## Notes on Version Numbering

- **MAJOR**: Breaking architectural changes, incompatible data schemas
- **MINOR**: New features, new objects, new capabilities (backward compatible)
- **PATCH**: Bug fixes, performance improvements, documentation updates

For issues/PRs, use:
- `bug`: Fix → PATCH
- `feature`: New functionality → MINOR  
- `breaking`: Architecture change → MAJOR

---

## Compatibility

### Minimum Supported Versions

- **iOS**: 14.0+
- **Android**: 10.0+ (API 29)
- **React Native**: 0.68+
- **Rust**: 1.70.0+

### Data Compatibility

- ✅ Database migrations are backward compatible
- ✅ Old app can run with newer database schema
- ✅ New app gracefully handles old database

### Breaking Changes

None yet (since we haven't released v1.0 publicly).

---

## References

- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
- [Semantic Versioning](https://semver.org/)

---

**Last Updated**: February 2026
