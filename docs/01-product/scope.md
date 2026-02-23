# Feature Scope

## 1. Overview

This document defines the feature boundaries for each phase of FindMyStar development. It establishes what is included, what is deferred, and what is explicitly excluded. All scope decisions are informed by the [Problem Statement](./problem-statement.md), aligned with the [Product Vision](./vision.md), and scheduled according to the [Product Roadmap](./roadmap.md).

---

## 2. MVP -- Phase 1 Scope

### 2.1 Target Release

**Q2 2026 (June)** -- 3-month development cycle.

### 2.2 Celestial Object Catalog

| Category | Count | Source | Notes |
|----------|-------|--------|-------|
| Sun | 1 | Computed (simplified VSOP87) | RA/Dec computed at runtime |
| Moon | 1 | Computed (lunar theory) | RA/Dec computed at runtime |
| Planets | 8 | VSOP87 coefficients (bundled) | Mercury through Neptune |
| Bright stars | 100-500 | Hipparcos catalog (mag < 5) | Fixed RA/Dec, pre-loaded |
| Messier objects | ~110 | Static catalog | M1 through M110, fixed positions |
| **Total** | **~620** | | ~10-20 MB bundled data |

### 2.3 Core Features (Must Have)

**Object Search (FR-1 to FR-3)**
- Case-insensitive substring search by name.
- Results within 100ms.
- Object metadata display: type, magnitude, current altitude/azimuth.
- Edge case handling: "no results found," partial match suggestions.

**Real-Time AR Guidance (FR-4 to FR-7)**
- Directional arrow overlay on live camera feed.
- 30+ FPS update rate with < 15ms sensor-to-display latency.
- Angular distance indicator (degrees from target).
- Color-coded proximity: red (> 5 deg), yellow (1-5 deg), green (< 1 deg).
- Target lock state at < 0.5 deg with visual and optional audio feedback.

**Visibility Computation (FR-8 to FR-12)**
- Current altitude calculation from observer location and time.
- Visibility status: "Visible now," "Rises at [TIME]," "Not visible from your location."
- Sun altitude filtering: objects only marked visible when Sun < -6 deg (civil twilight).
- Circumpolar detection: "Always visible from your location."
- Never-visible detection with informational message.

**Rise/Set Calculation (FR-13 to FR-15)**
- Analytical solution for fixed stars (Hour Angle formula, accuracy +/- 2 min).
- Iterative scan for planets (5-minute intervals over 48h, accuracy +/- 5 min).
- Optimal altitude (culmination) time computation.

**Alarm Scheduling (FR-16 to FR-19)**
- One-time and recurring visibility alerts.
- OS-level notifications via AlarmManager/WorkManager (Android) and UNUserNotificationCenter (iOS).
- Daily midnight recalculation of all tracked objects.
- Alarm management UI: list, edit, delete.

**Offline Operation**
- Zero network dependency for all features.
- All catalogs bundled in app.
- SQLite-only local persistence.
- No user accounts, no telemetry, no cloud services.

### 2.4 Platform Requirements

| Requirement | Target |
|-------------|--------|
| iOS minimum | 14.0 |
| Android minimum | 10 (API 29) |
| App size | < 150 MB |
| Catalog size | < 30 MB |
| RAM usage | < 100 MB |
| Device sensors | GPS + 6-axis IMU + magnetometer |

---

## 3. Phase 2 Scope -- Growth and Satellite Tracking

### 3.1 Target Release

**Q3 2026 (September)** -- 3-month development cycle following stable Phase 1.

### 3.2 Astronomy Additions

| Feature | Description | Dependency |
|---------|-------------|------------|
| Satellite tracking | ISS, Starlink, visible satellites | TLE data (periodic updates) |
| TLE-based orbital computation | SGP4 propagation model | New `SatelliteEphemerisEngine` module |
| Comet predictions | Bright comets with orbital elements | Extended catalog |
| Meteor shower alerts | Annual meteor shower peak dates/times | Static calendar + radiant computation |
| Variable star magnitude | Notify when variable stars at peak brightness | Extended Hipparcos data |

### 3.3 User Features

| Feature | Description |
|---------|-------------|
| Satellite pass predictions | "ISS visible in 12 minutes, look NW" |
| Brightness alerts | Notify when object reaches peak apparent magnitude |
| Observation logging | Local history of observed objects with timestamps |
| Advanced calibration | Manual two-star alignment for improved IMU accuracy |
| Altitude threshold customization | Per-object minimum altitude for notifications |

### 3.4 Technical Enhancements

- Background task infrastructure for TLE data refresh (requires optional network).
- Advanced caching for orbital predictions.
- Performance optimization to maintain 60 FPS baseline.
- Unit test coverage target: > 90%.

---

## 4. Phase 3 Scope -- Advanced and Ecosystem

### 4.1 Target Release

**Q4 2026 (December)** -- 3-month development cycle following stable Phase 2.

### 4.2 Telescope Integration

| Feature | Description |
|---------|-------------|
| Digital setting circles | Manual telescope guidance via phone attachment |
| Alignment solver | Two-star / three-star calibration routine |
| Field of view preview | Show what the telescope eyepiece will see |
| Polar alignment assistant | Guide equatorial mount polar alignment |

### 4.3 Astrophotography Tools

| Feature | Description |
|---------|-------------|
| Exposure time recommendations | Based on object brightness and focal length |
| Optimal altitude alerts | Notify when target at best altitude for imaging |
| Meridian flip prediction | For German equatorial mount users |
| Light pollution awareness | Bortle scale estimation from location |

### 4.4 Cloud Sync (Optional Premium)

| Feature | Description |
|---------|-------------|
| Observation history backup | Encrypted cloud storage (user-opted) |
| Multi-device sync | Share tracked objects across devices |
| Shareable observation links | Privacy-controlled external sharing |

### 4.5 Community Features (Light)

| Feature | Description |
|---------|-------------|
| Public sighting map | Anonymous, aggregated observation data |
| Trending objects | "What's visible tonight" community feed |
| Simple social sharing | External sharing (not in-app social network) |

---

## 5. Explicit Exclusions

The following features are explicitly out of scope for all planned phases. These exclusions are deliberate architectural and product decisions, not deferrals.

### 5.1 Permanently Excluded

| Feature | Reason | Alternative |
|---------|--------|-------------|
| Telescope motor control | Too niche; liability concerns; requires hardware partnerships | Support digital setting circles (manual guidance) |
| Plate solving / image alignment | Computationally intensive; requires camera integration beyond AR | Defer to Phase 3+ as optional plugin |
| Real-time image processing | Too heavy for mobile; drains battery; outside core value prop | Partner with dedicated astrophotography apps |
| In-app social network | Requires backend infrastructure; moderation burden; scope creep | External sharing links only |
| User accounts (MVP) | Contradicts privacy-first positioning; adds complexity | No accounts in Phase 1-2; optional in Phase 3 |
| Cloud services (MVP) | Contradicts offline-first architecture; adds infrastructure cost | Local-only in Phase 1-2; optional premium in Phase 3 |
| Subscription-only monetization | Alienates amateur community; requires account system | One-time purchase for Pro; optional subscription for Premium |
| Real-time weather integration | Requires network; unreliable at dark sky sites | Manual sky condition input (Phase 2) |

### 5.2 Exclusion Rationale Summary

Each exclusion follows the offline-first principle established in [ADR-0003](../11-adr/0003-offline-first.md): if a feature requires backend infrastructure, it is excluded from MVP and deferred to Phase 2+ only if it can be made optional.

---

## 6. Scope Decision Matrix

The following matrix documents the decision criteria used for each feature inclusion or exclusion.

| Feature | User Value | Technical Complexity | Offline Compatible | Solo Dev Viable | Phase |
|---------|-----------|---------------------|-------------------|----------------|-------|
| Object search | High | Low | Yes | Yes | **1 (MVP)** |
| AR directional guidance | High | Medium | Yes | Yes | **1 (MVP)** |
| Rise/set calculation | High | Medium | Yes | Yes | **1 (MVP)** |
| Visibility alerts | High | Medium | Yes | Yes | **1 (MVP)** |
| Sun filtering | High | Low | Yes | Yes | **1 (MVP)** |
| Circumpolar detection | Medium | Low | Yes | Yes | **1 (MVP)** |
| Target lock feedback | High | Low | Yes | Yes | **1 (MVP)** |
| Alarm management UI | Medium | Low | Yes | Yes | **1 (MVP)** |
| Satellite tracking | High | High | Partial (TLE updates) | Stretch | **2** |
| Comet predictions | Medium | Medium | Yes (bundled orbits) | Yes | **2** |
| Meteor shower alerts | Medium | Low | Yes (static calendar) | Yes | **2** |
| Observation logging | Medium | Low | Yes | Yes | **2** |
| Advanced calibration | Medium | Medium | Yes | Yes | **2** |
| Telescope integration | Medium | High | Yes | Stretch | **3** |
| Astrophotography tools | Low-Medium | High | Partial | No (needs partner) | **3** |
| Cloud sync | Low (MVP) | High | No | No | **3 (Premium)** |
| Social features | Low | High | No | No | **3 (Light)** |
| Telescope motor control | Low | Very High | N/A | No | **Excluded** |
| Plate solving | Low | Very High | Partial | No | **Excluded** |
| Image processing | Low | Very High | N/A | No | **Excluded** |

**Decision Criteria**:
- **User Value**: How directly does this feature solve the three core problems?
- **Technical Complexity**: Can a solo developer implement this within the phase timeline?
- **Offline Compatible**: Does this work without network connectivity?
- **Solo Dev Viable**: Can one developer build, test, and maintain this?

---

## 7. Scope Change Process

### 7.1 Adding Features

Any feature addition to a committed phase requires:
1. Written justification linking to one of the three core problems.
2. Technical feasibility assessment (performance impact, architecture fit).
3. Confirmation that no existing committed feature is delayed.
4. Update to this document, the [SRS](../02-requirements/srs.md), and the [Roadmap](./roadmap.md).

### 7.2 Removing Features

Feature removal from a committed phase requires:
1. Root cause analysis (technical blocker, timeline risk, or priority change).
2. Impact assessment on dependent features.
3. Deferral plan (move to next phase or exclude entirely).
4. Update to this document and related docs.

### 7.3 Scope Freeze

Phase 1 scope freezes **4 weeks before target release**. After freeze, only bug fixes and performance improvements are permitted. Feature additions require explicit exception approval.

---

## 8. Dependencies Between Phases

```
Phase 1 (MVP)
  |
  |-- Rise/set algorithms < 500ms (required for Phase 2 satellite pass predictions)
  |-- Background task infrastructure (required for Phase 2 TLE updates)
  |-- Alarm scheduling system (required for Phase 2 pass alerts)
  |
  v
Phase 2 (Growth)
  |
  |-- Stable sensor fusion pipeline (required for Phase 3 telescope alignment)
  |-- Observation logging database schema (required for Phase 3 cloud sync)
  |-- Optional network layer (required for Phase 3 cloud features)
  |
  v
Phase 3 (Advanced)
```

No Phase 2 feature may be started until Phase 1 is stable (crash rate < 0.1%, accuracy validated against USNO/JPL data). No Phase 3 feature may be started until Phase 2 has achieved > 90% unit test coverage.

---

## 9. Cross-References

| Document | Relationship |
|----------|-------------|
| [Product Vision](./vision.md) | Feature overview and market positioning |
| [Problem Statement](./problem-statement.md) | Core problems driving scope decisions |
| [User Personas](./personas.md) | Feature priorities per user segment |
| [Product Roadmap](./roadmap.md) | Phase timelines and milestones |
| [SRS](../02-requirements/srs.md) | Detailed FR and NFR specifications |
| [Functional Requirements](../02-requirements/functional-requirements.md) | Expanded requirement details |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md) | Offline constraint driving exclusions |
| [Architecture Overview](../03-architecture/architecture-overview.md) | Technical feasibility basis |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Product Team
