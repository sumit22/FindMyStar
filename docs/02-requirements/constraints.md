# Constraints

## 1. Overview

This document details the technical, accuracy, business, regulatory, and platform-specific constraints that govern FindMyStar's design and implementation. Constraints are non-negotiable boundaries that shape architecture decisions and feature scope. This document expands on [SRS](./srs.md) Section 5 and relates to the architectural decisions documented in the [ADR series](../11-adr/).

---

## 2. Technical Constraints

### 2.1 Offline Operation

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | All MVP features must operate without any network connectivity |
| **Rationale** | Core value proposition; users observe from remote dark sky sites without cellular service |
| **Enforcement** | Architectural rule: no network API calls in MVP codebase. See [ADR-0003](../11-adr/0003-offline-first.md) |
| **Impact** | Eliminates cloud-dependent features: real-time satellite TLE updates, cloud sync, social sharing, server-side analytics |
| **Verification** | Full integration test suite runs in airplane mode |

### 2.2 Data Persistence: SQLite Only

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | All persistent data stored in local SQLite database |
| **Rationale** | Simplicity, portability, zero backend cost, proven reliability for embedded applications |
| **Enforcement** | No alternative database engines or cloud storage in MVP |
| **Impact** | Single-device data only; no multi-device sync; data loss if app uninstalled without backup |
| **Schema Reference** | See [Database Schema](../05-data-model/schema.md) |

### 2.3 Platform Minimum Versions

| Platform | Minimum Version | API Level | Rationale |
|----------|----------------|-----------|-----------|
| iOS | 14.0 | N/A | ARKit 4 support; UNUserNotificationCenter; 85%+ of active iOS devices |
| Android | 10 (Q) | API 29 | ARCore 1.18+; scoped storage; WorkManager; 90%+ of active Android devices |

**Impact**: Cannot use APIs introduced after these versions (e.g., iOS 16 Live Activities, Android 13 per-app language).

### 2.4 Device Hardware Requirements

| Sensor | Requirement | Purpose | Fallback |
|--------|------------|---------|----------|
| GPS | Required | Observer latitude/longitude | Last known location + warning |
| 6-axis IMU (gyro + accel) | Required | Device orientation for AR | Cannot function without IMU |
| Magnetometer | Required | Absolute heading (compass) | Gyro-only with drift warning |
| Camera | Required (for AR mode) | Live camera preview in AR screen | Non-AR mode: text-only guidance |
| 2 GB RAM minimum | Required | App + catalog + AR rendering | Reduced catalog if < 2 GB detected |
| 50 MB free storage | Required | App + SQLite database + catalog | Prompt user to free storage |

### 2.5 App Size Constraint

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | Total app download size < 150 MB |
| **Rationale** | App Store cellular download limit (200 MB on iOS); user expectation for utility apps |
| **Breakdown** | See table below |

| Component | Estimated Size | Budget |
|-----------|---------------|--------|
| React Native runtime + JS bundle | ~15-20 MB | 25 MB |
| Rust domain engine (compiled native library) | ~2-5 MB | 10 MB |
| ARCore/ARKit SDK | ~10-15 MB | 20 MB |
| Hipparcos star catalog (compressed) | ~3-5 MB | 10 MB |
| VSOP87 planet coefficients | ~1 MB | 2 MB |
| Messier object catalog | ~100 KB | 1 MB |
| UI assets (icons, images, fonts) | ~5-10 MB | 15 MB |
| SQLite engine | ~1 MB | 2 MB |
| **Total estimate** | **~40-60 MB** | **< 150 MB** |

### 2.6 Catalog Size Constraint

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | Celestial object catalog data < 30 MB |
| **Rationale** | Minimize app size; keep memory footprint low when catalog loaded |
| **Current estimate** | ~10-15 MB (Hipparcos + VSOP87 + Messier) |
| **Headroom** | ~15-20 MB for Phase 2 additions (satellite TLEs, comets) |

---

## 3. Accuracy Limitations

Astronomical accuracy is fundamentally limited by device hardware, mathematical approximations, and environmental conditions. The following table documents known limitations, their causes, their impact on the user experience, and available workarounds.

### 3.1 Accuracy Limitations Table

| Limitation | Reason | Impact on User | Workaround | Phase |
|-----------|--------|---------------|-----------|-------|
| +/- 1 deg pointing accuracy | Phone IMU is inherently noisy; consumer-grade magnetometer has limited precision | User may need to visually scan a 2-degree area around the indicated direction | Manual star alignment calibration mode | Phase 2 |
| +/- 0.5 deg atmospheric refraction error | No atmospheric refraction model in MVP; objects near horizon appear higher than geometric position | Rise/set times and near-horizon altitudes slightly inaccurate | Implement Bennett refraction formula | Phase 2 |
| +/- 5-10 deg magnetic interference | Metal structures, electronics, and magnetic fields distort magnetometer readings | AR arrow may point in wrong direction near cars, buildings, or telescope mounts | Calibration prompt when error > 10 deg; move away from metal objects | Phase 1 (detection) |
| +/- 1 minute system time skew | Device clock may drift if not NTP-synced; user may have set time manually | Rise/set times and real-time positions shifted by corresponding amount | Display time accuracy warning; suggest syncing device clock | Phase 1 (warning) |
| +/- 5 min planet rise/set accuracy | Iterative scan uses 5-minute intervals; planet RA/Dec changes between steps | Notification may arrive up to 5 minutes early or late | Reduce scan interval to 1 minute (performance trade-off) | Phase 2 |
| No proper motion correction | Stars move over decades (proper motion); Hipparcos positions are for epoch J1991.25 | Negligible for most stars (< 0.01 deg over 50 years); significant for high-proper-motion stars like Barnard's Star | Apply proper motion correction formula | Phase 2 |
| No nutation/precession correction | Earth's axis wobbles; equinox precesses over 26,000-year cycle | RA/Dec off by ~0.01 deg per year from J2000.0 epoch; negligible for pointing accuracy | Apply IAU precession/nutation model | Phase 3 |
| No aberration correction | Earth's orbital motion causes apparent shift of ~20 arcseconds | Negligible for amateur observation (< 0.006 deg) | Not planned (below observable threshold) | N/A |
| No parallax correction | Nearby stars shift position depending on Earth's orbital position | Negligible for all stars beyond 10 parsecs | Not planned (below observable threshold) | N/A |

### 3.2 Error Budget

The total pointing error is the sum of independent error sources:

```
Total Error = sqrt(IMU_error^2 + Computation_error^2 + Time_error^2 + Refraction_error^2)

Typical case (good conditions):
  IMU_error = 0.5 deg (freshly calibrated)
  Computation_error = 0.1 deg (algorithmic)
  Time_error = 0.05 deg (device clock synced)
  Refraction_error = 0.1 deg (object well above horizon)

  Total = sqrt(0.25 + 0.01 + 0.0025 + 0.01) = sqrt(0.2725) = 0.52 deg

Worst case (poor conditions):
  IMU_error = 2.0 deg (magnetic interference)
  Computation_error = 0.1 deg
  Time_error = 0.25 deg (5-minute clock skew)
  Refraction_error = 0.5 deg (object near horizon)

  Total = sqrt(4.0 + 0.01 + 0.0625 + 0.25) = sqrt(4.3225) = 2.08 deg
```

**Conclusion**: Under good conditions, total error is approximately 0.5 deg (well within the 1 deg target). Under poor conditions, error can reach 2 deg, which the calibration prompt and user warnings mitigate.

---

## 4. Business Constraints

### 4.1 Distribution

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | Distribution exclusively through Apple App Store and Google Play Store |
| **Rationale** | Trust and discoverability; payment processing handled by platforms; no sideloading support needed |
| **Impact** | Subject to platform review guidelines; 30% revenue share (Apple), 15% (Google, first $1M) |
| **Compliance** | Must follow Apple Human Interface Guidelines and Google Material Design guidelines |

### 4.2 Pricing

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | One-time purchase price: Rs. 499-799 (India) / $2.99-$6.99 (US/International) |
| **Rationale** | Amateur astronomy community resistant to subscriptions for utility apps; one-time purchase maximizes conversion |
| **Model** | Free tier (limited catalog) + Pro tier (full catalog + alarms + precision mode) |
| **Future** | Optional premium subscription for Phase 3 cloud features; does not replace one-time Pro purchase |

### 4.3 Development Resource

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | Architecture must be maintainable by a solo developer |
| **Rationale** | Initial development and maintenance will be handled by one person; must not require DevOps, backend ops, or dedicated QA team |
| **Impact** | No backend services (eliminates server maintenance); automated testing replaces manual QA; simple CI/CD pipeline |
| **Maintenance estimate** | ~20 hours/week for development, testing, and support |

### 4.4 Support Model

| Attribute | Constraint |
|-----------|-----------|
| **Constraint** | Community-based support only |
| **Channels** | GitHub Issues; App Store / Play Store review responses; email for critical bugs |
| **SLA** | No formal SLA; best-effort response within 72 hours |
| **Impact** | App must be self-explanatory; onboarding must require zero tutorials; error messages must be user-actionable |

---

## 5. Regulatory Constraints

### 5.1 Privacy and Data Collection

| Attribute | Detail |
|-----------|--------|
| **Data collected** | None. Zero telemetry, zero analytics, zero crash reporting to external services |
| **User accounts** | None in MVP. No email, no username, no password |
| **Location data** | Used locally for computation only; never transmitted |
| **GDPR applicability** | Not applicable -- no personal data collected, processed, or stored on external servers |
| **CCPA applicability** | Not applicable -- no personal information sold, shared, or disclosed to third parties |
| **COPPA applicability** | Not applicable -- no data collected from any users, including children |
| **App Store privacy label** | "Data Not Collected" on both iOS and Android privacy labels |

### 5.2 Export Control

| Attribute | Detail |
|-----------|--------|
| **Encryption** | No encryption used for data at rest (SQLite unencrypted); no network encryption (no network) |
| **Export classification** | EAR99 (no export restrictions) -- no encryption, no controlled technology |
| **ITAR** | Not applicable -- civilian astronomy algorithms using publicly available data |

### 5.3 Accessibility Regulations

| Attribute | Detail |
|-----------|--------|
| **Target standard** | WCAG 2.1 Level AA for non-AR screens |
| **Legal requirement** | Best practice for App Store/Play Store compliance; not legally mandated for independent apps in most jurisdictions |
| **Implementation** | NFR-14 defines accessibility requirements; enforced through automated accessibility audits |

---

## 6. Platform-Specific Constraints

### 6.1 AR Framework Differences

| Aspect | iOS (ARKit) | Android (ARCore) | Impact |
|--------|-------------|------------------|--------|
| Minimum version | ARKit 4 (iOS 14+) | ARCore 1.18+ (Android 10+) | Consistent minimum version across platforms |
| Device support | All iPhones since iPhone 6s | Varies by manufacturer; see ARCore supported devices list | Some Android devices may lack ARCore support |
| Camera API | AVCaptureSession | Camera2 API | Platform-specific camera integration code |
| Orientation API | CMMotionManager (CoreMotion) | SensorManager (TYPE_ROTATION_VECTOR) | Different quaternion conventions; abstracted in SensorFusionService |
| Coordinate system | Right-handed, Y-up | Right-handed, Y-up | Compatible; minor axis mapping differences |
| Background AR | Not supported (camera requires foreground) | Not supported (camera requires foreground) | AR tracking pauses when app backgrounded |

### 6.2 Notification API Differences

| Aspect | iOS (UNUserNotificationCenter) | Android (AlarmManager / WorkManager) | Impact |
|--------|-------------------------------|-------------------------------------|--------|
| Permission model | Explicit user permission required on first use | Implicit for local notifications (Android 12 and below); explicit for Android 13+ | Must handle permission denial gracefully |
| Scheduling precision | +/- 1 second for time-based triggers | AlarmManager: +/- 1 minute (inexact); WorkManager: +/- 15 minutes | Use AlarmManager for time-critical alerts |
| Background execution | Limited (30 seconds background task) | WorkManager: up to 10 minutes for periodic work | Midnight recalculation must complete within 30 seconds on iOS |
| Notification grouping | Automatic by thread identifier | Notification channels (Android 8+) | Define "FindMyStar Alerts" notification channel |
| Do Not Disturb | Notifications queued; delivered when DND ends | Notifications queued; delivered when DND ends | Consistent behavior |
| App kill behavior | Notifications still delivered (scheduled with OS) | Notifications still delivered (AlarmManager persists) | Reliable even if user kills app |

### 6.3 Storage and File System

| Aspect | iOS | Android | Impact |
|--------|-----|---------|--------|
| Database location | Application sandbox (Documents/) | Application-specific storage (internal) | No user-accessible path; secure by default |
| Backup | Included in iCloud backup by default | Included in Android backup if enabled | User's alarm data preserved across device restore |
| Storage limit | No hard limit (device dependent) | No hard limit (device dependent) | 50 MB free storage required at install |

### 6.4 Rust FFI Integration

| Aspect | iOS | Android | Impact |
|--------|-----|---------|--------|
| Binding mechanism | C-compatible FFI via Swift bridging header | JNI (Java Native Interface) or NDK direct call | Different binding code per platform |
| Build target | `aarch64-apple-ios` | `armv7-linux-androideabi`, `aarch64-linux-android` | Cross-compilation setup required for CI |
| Library format | Static library (.a) or dynamic framework (.dylib) | Shared object (.so) | Different linking configurations |
| Memory management | Rust owns memory; Swift calls free functions | Rust owns memory; JNI calls free functions | Must prevent memory leaks at FFI boundary |

---

## 7. Constraint Interaction Matrix

Some constraints interact and create compound limitations:

| Constraint A | Constraint B | Combined Effect |
|-------------|-------------|----------------|
| Offline operation | Satellite tracking | Satellites excluded from MVP (TLE data goes stale) |
| Solo developer | Backend services | No backend in any phase without team expansion |
| App size < 150 MB | Full Hipparcos (120k stars) | Limit to brightest 500 stars; full catalog in Phase 2 |
| iOS background limit (30s) | Midnight recalculation | Batch recalc for 100 objects must complete in < 30 seconds |
| Battery < 10%/hr (AR) | 30+ FPS AR updates | Computation must be < 10ms/frame; no unnecessary GPU work |
| +/- 1 deg IMU accuracy | Target lock at < 0.5 deg | Lock relies on momentary alignment; 2-second hold mitigates noise |

---

## 8. Cross-References

| Document | Relationship |
|----------|-------------|
| [SRS Section 5](./srs.md#5-constraints) | Source constraint definitions |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md) | Offline operation architectural decision |
| [ADR-0002: Rust Core Engine](../11-adr/0002-rust-core-engine.md) | Rust FFI constraints |
| [ADR-0001: Layered Architecture](../11-adr/0001-layered-architecture.md) | Architectural constraint framework |
| [Non-Functional Requirements](./non-functional-requirements.md) | Performance and accuracy targets |
| [Feature Scope](../01-product/scope.md) | Scope exclusions driven by constraints |
| [Architecture Overview](../03-architecture/architecture-overview.md) | System design constrained by this document |
| [Database Schema](../05-data-model/schema.md) | SQLite-only persistence constraint |
| [Algorithms](../04-domain-engine/algorithms.md) | Accuracy limitations in mathematical models |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Engineering Team
