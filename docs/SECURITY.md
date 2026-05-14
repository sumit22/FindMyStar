# Security & Threat Model

> **Dual-use note.** FindMyStar's sensor-fusion and target-lock pipeline could plausibly be adapted to point-and-aim contexts well beyond celestial observation. See [../RESPONSIBLE_USE.md](../RESPONSIBLE_USE.md) for the maintainer's statement on uses the project is not designed for (aircraft lasing, weapons targeting, safety-critical navigation, surveillance) and how to report misuse.

## 1. Security Principles

### 1.1 Privacy by Design

FindMyStar collects **zero user data**. There is no telemetry, no analytics, no crash reporting to external services, and no user accounts. All computation happens on-device.

### 1.2 Offline-First

The application makes **zero network calls**. There are no API endpoints, no cloud services, no remote databases. This eliminates the most common attack vectors: network interception, MITM attacks, authentication bypass, API abuse, and server-side vulnerabilities. See [ADR-0003: Offline-First](./11-adr/0003-offline-first.md).

### 1.3 Minimal Permissions

FindMyStar requests only the permissions strictly necessary for its functionality:

| Permission | Purpose | Usage |
|-----------|---------|-------|
| **Location (GPS)** | Compute local sky coordinates (Alt/Az) from celestial coordinates (RA/Dec) | Used locally only; never transmitted |
| **Camera** | AR overlay for pointing guidance | Live preview only; no photos stored, no streaming |
| **Motion/IMU** | Device orientation via accelerometer, gyroscope, magnetometer | Quaternion computation for AR guidance |
| **Notifications** | Visibility alerts for tracked celestial objects | Scheduled locally via OS notification system |

No other permissions are requested. Specifically: no microphone, no contacts, no storage (beyond app sandbox), no network, no Bluetooth.

### 1.4 Local-Only Data

All persistent data resides in the application's sandboxed SQLite database on the device:

- **Catalog** (read-only): ~620 bundled celestial objects
- **Tracked objects** (user-created): alarm configurations for visibility alerts
- **Preferences** (user-configured): display settings, notification preferences

No data is ever transmitted off the device or shared with other applications.

---

## 2. Threat Model

### 2.1 Asset Identification

| Asset | Sensitivity | Storage |
|-------|------------|---------|
| User location (GPS coordinates) | Medium -- reveals physical location | In-memory only during computation; not persisted |
| Observation history (tracked objects) | Low -- reveals astronomical interests | SQLite `tracked_objects` table |
| Device orientation (quaternion) | Low -- reveals phone pointing direction | In-memory only; not persisted |
| Celestial catalog | None -- publicly available data | SQLite `objects` table (read-only) |

### 2.2 Threat Actors

| Actor | Capability | Motivation |
|-------|-----------|------------|
| **Malicious apps on device** | Read shared storage, exploit IPC | Data harvesting, location tracking |
| **Physical device access** | Full file system access if unlocked | Data extraction, tampering |
| **Supply chain (dependencies)** | Inject malicious code via crate/npm package | Backdoor, data exfiltration |
| **Electromagnetic interference** | Affect magnetometer readings | Unintentional (environmental) |

### 2.3 Attack Surface

FindMyStar's attack surface is deliberately minimal: zero network endpoints, zero authentication systems, zero API endpoints, zero cloud storage. The only external inputs are one user text field (search query), four sensor inputs (GPS, camera, IMU, clock), and one FFI boundary (Rust to TypeScript).

---

## 3. Attack Vectors & Mitigations

| Vector | Risk | Likelihood | Mitigation |
|--------|------|------------|------------|
| SQLite injection | Data corruption | Low | Parameterized queries only; no string concatenation in SQL |
| Sensor spoofing (magnetometer) | Incorrect AR guidance | Medium | Calibration prompts, plausibility checks, user warnings |
| Location privacy leak | Location exposed to other apps | Low | Location used in-memory only; standard OS sandboxing; no export |
| Dependency supply chain | Malicious crate or npm package | Low | Minimal deps; `cargo audit` and `npm audit` in CI; lock files |
| Physical device access | Data extraction from SQLite | Low | Standard OS protections; no sensitive data stored |
| Magnetic interference | Orientation errors in AR | High | Calibration detection; deviation warning; figure-8 recalibration prompt |
| Time manipulation | Incorrect rise/set times | Low | Warn user if device time appears inconsistent |
| FFI boundary exploitation | Memory corruption | Very Low | All inputs validated before crossing Rust/TS boundary; Rust memory safety |

---

## 4. Data Validation Rules

All external inputs are validated before processing. The domain engine rejects out-of-range values rather than silently clamping.

### 4.1 Geographic Coordinates

- Latitude: must be in range [-90.0, 90.0] degrees
- Longitude: must be in range [-180.0, 180.0] degrees
- NaN and Infinity are rejected

### 4.2 Time Inputs

- Unix timestamp: must be in range [0, 4102444800] (1970-01-01 to 2100-01-01)
- Julian Date: must be in range [2440587.5, 2488069.5] (same range)

### 4.3 Celestial Coordinates

- Right Ascension (RA): must be in range [0.0, 24.0) hours
- Declination (Dec): must be in range [-90.0, 90.0] degrees

### 4.4 Database Integrity

- **Startup**: `PRAGMA integrity_check` runs on every app launch
- **Catalog**: CRC-32 validation against bundled reference checksum
- **Recovery**: if integrity check fails, restore catalog from bundled backup
- **Row count**: verify expected catalog size (~620 objects) on startup

See [schema.md](./05-data-model/schema.md) and [catalog-design.md](./05-data-model/catalog-design.md) for details.

### 4.5 Numeric Safety

All trigonometric inputs are guarded:

```rust
// Clamp acos/asin inputs to valid domain [-1, 1]
let clamped = value.clamp(-1.0, 1.0);
let angle = clamped.acos();

// Guard division by zero
if denominator.abs() < f64::EPSILON {
    return Err(DomainError::DivisionByZero);
}
```

---

## 5. Input Sanitization

### 5.1 Search Queries

User search input is the only free-text input in the application:

- All database queries use **parameterized statements** (never string interpolation)
- `LIKE` clauses use `ESCAPE` character to prevent wildcard injection
- Query length is limited to 100 characters

```sql
-- Safe: parameterized query
SELECT * FROM objects WHERE name LIKE ? ESCAPE '\' LIMIT 20;
```

### 5.2 FFI Boundary (Rust <-> TypeScript)

All data crossing the FFI boundary is validated on both sides:

- **TypeScript side**: type checking, range validation before calling native module
- **Rust side**: all public API functions validate inputs before computation
- **Numeric types**: NaN and Infinity are explicitly rejected at the boundary
- **String types**: UTF-8 validation (Rust enforces this by default)

### 5.3 Sensor Data

Sensor inputs are treated as untrusted:

- **GPS**: coordinates validated against geographic ranges (Section 4.1)
- **IMU**: quaternion normalized before use; magnitude checked (should be ~1.0)
- **Clock**: timestamp plausibility checked against expected range
- **Camera**: pixel data used for AR overlay only; never parsed, stored, or transmitted

---

## 6. Privacy Considerations

### 6.1 Data Inventory

| Data Category | Created By | Transmitted | Persisted |
|--------------|-----------|------------|-----------|
| Celestial catalog | Bundled at install | Never | SQLite (read-only) |
| Tracked objects | User action | Never | SQLite |
| User preferences | User action | Never | SQLite |
| GPS location | Device sensor | Never | Not persisted (in-memory only) |
| Device orientation | Device sensor | Never | Not persisted (in-memory only) |
| Camera frames | Device camera | Never | Not persisted |

### 6.2 What is NOT Collected

No analytics, no crash reports to cloud, no user accounts, no device fingerprinting, no advertising identifiers, no browsing history, no contacts or personal files.

### 6.3 Location Privacy

GPS coordinates are used exclusively for local astronomical calculations. Coordinates are passed to the Rust domain engine for Alt/Az computation, exist only in memory, and are **not** written to the database, logged, or transmitted. The user may optionally enter a manual location instead of using GPS.

### 6.4 Camera Privacy

Camera frames are rendered as a live background behind the AR guidance arrow. No frames are captured, stored, or transmitted. No image processing, face detection, or object recognition is performed. Camera resources are released when the AR screen is exited.

### 6.5 Regulatory Compliance

| Regulation | Applicability | Rationale |
|-----------|--------------|-----------|
| **GDPR** | Not applicable | No personal data processed, stored, or transmitted |
| **CCPA** | Not applicable | No data sale, sharing, or collection |
| **COPPA** | Not applicable | No data collection targeting children |
| **App Tracking Transparency** (iOS) | Not applicable | No tracking of any kind |

---

## 7. Device Security

| Sensor | Threat | Impact | Mitigation |
|--------|--------|--------|------------|
| Magnetometer | Metal objects, electronics nearby | AR arrow points wrong | Calibration prompt if deviation >10 degrees |
| Accelerometer | Device vibration, vehicle movement | Noisy orientation data | Low-pass filtering in sensor fusion |
| Gyroscope | Drift over time | Gradual orientation error | Complementary filter with magnetometer correction |
| GPS | Urban canyons, indoor use | Poor or no location fix | Fall back to last known location; manual entry |
| System clock | User manipulation, drift | Incorrect rise/set times | Plausibility warning if time appears unusual |

GPS spoofing is not a meaningful threat for an astronomy app. The worst outcome is calculations for a wrong location. Time manipulation causes inaccurate rise/set times; the app warns if computed sidereal time produces implausible results.

---

## 8. Dependency Security

### 8.1 Rust Dependencies

| Crate | Purpose | Status |
|-------|---------|--------|
| `nalgebra` | Linear algebra, quaternions, vectors | Actively maintained, widely audited |

**Policy**: No additional Rust dependencies without security review and documented justification.

### 8.2 npm Dependencies

Managed with `package-lock.json` for deterministic installs. Regular `npm audit` runs are integrated into the CI pipeline. Dependabot or Renovate provides automated update PRs.

### 8.3 Audit Schedule

| Activity | Frequency | Tool |
|----------|-----------|------|
| `cargo audit` | Every CI build | cargo-audit |
| `npm audit` | Every CI build | npm built-in |
| Dependency update | Monthly | Manual review + automated PRs |
| Full security review | Quarterly | Manual review of all dependencies |

---

## 9. App Store Compliance

**Google Play Data Safety**: accurately reports no data collected, no data shared.

**Apple Privacy Nutrition Labels**: Location, camera, and motion declared as "used on device only," not linked to identity, not used for tracking.

**Privacy Policy**: "FindMyStar does not collect, store, or transmit any personal data. All data remains on your device."

---

## 10. Incident Response

### 10.1 Vulnerability Reporting

- **Channel**: GitHub Issues with `[SECURITY]` label
- **Response time**: Acknowledgment within 24 hours
- **Confidential reports**: Email to project maintainer (listed in repository)

### 10.2 Severity & Response

| Severity | Definition | Response Time |
|----------|-----------|---------------|
| **Critical** | Data corruption, privacy leak, code execution | Hotfix within 48 hours |
| **High** | Crash >1%, incorrect guidance | Fix in next patch (1 week) |
| **Medium** | Minor accuracy issues, edge cases | Fix in next minor release |
| **Low** | Cosmetic issues, documentation gaps | Next scheduled release |

### 10.3 User Notification

Since FindMyStar has no push notification infrastructure (by design), users are notified through app store release notes, GitHub security advisories, and in-app "What's New" dialogs.

---

## 11. Cross-References

| Document | Relationship |
|----------|-------------|
| [ADR-0003: Offline-First](./11-adr/0003-offline-first.md) | Architectural foundation for zero-network security posture |
| [Non-Functional Requirements](./02-requirements/non-functional-requirements.md) | NFR-5 (offline), NFR-7 (crash rate), NFR-11 (data consistency) |
| [Database Schema](./05-data-model/schema.md) | Data structures protected by validation rules |
| [Catalog Design](./05-data-model/catalog-design.md) | CRC validation and integrity checking |
| [Architecture Overview](./03-architecture/architecture-overview.md) | Layered design enforcing security boundaries |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Security considerations for contributors |
| [OPERATIONS.md](./OPERATIONS.md) | Incident response and troubleshooting procedures |

---

**Last Updated**: February 2026
