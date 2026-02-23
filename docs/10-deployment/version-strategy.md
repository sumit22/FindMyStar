# Version Strategy

## 1. Semantic Versioning

FindMyStar follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

| Component | When to Increment | Examples |
|-----------|-------------------|----------|
| **MAJOR** | Breaking changes, incompatible data schemas | Database redesign, removed features |
| **MINOR** | New features, backward compatible | New celestial objects, new screens |
| **PATCH** | Bug fixes, performance improvements | Accuracy fix, memory leak patch |

Rules: incrementing MAJOR resets MINOR and PATCH to 0; incrementing MINOR resets PATCH
to 0.

### 1.1 Examples

| Change | From | To | Reasoning |
|--------|------|----|-----------|
| Add satellite tracking | 1.0.0 | 1.1.0 | New backward-compatible feature |
| Fix Moon ephemeris | 1.1.0 | 1.1.1 | Bug fix, no new features |
| Redesign SQLite schema | 1.1.1 | 2.0.0 | Incompatible data migration |
| Add astrophotography mode | 2.0.0 | 2.1.0 | New feature, no breaking changes |

---

## 2. Version Number Management

### 2.1 Single Source of Truth

The canonical version is stored in `mobile/package.json`:

```json
{
  "name": "findmystar",
  "version": "1.0.0"
}
```

All platform-specific version numbers are derived from this single source during build.

### 2.2 Android Version Mapping

| Field | Source | Description |
|-------|--------|-------------|
| `versionName` | `package.json` version | Human-readable ("1.0.0") |
| `versionCode` | Auto-incremented by CI | Monotonically increasing integer |

```groovy
def packageJson = new groovy.json.JsonSlurper()
    .parseText(file("../../package.json").text)
android {
    defaultConfig {
        versionName packageJson.version
        versionCode System.getenv("BUILD_NUMBER")?.toInteger() ?: 1
    }
}
```

### 2.3 iOS Version Mapping

| Field | Source | Description |
|-------|--------|-------------|
| `CFBundleShortVersionString` | `package.json` version | User-visible ("1.0.0") |
| `CFBundleVersion` | Auto-incremented by CI | Build number (integer string) |

```bash
# scripts/sync-ios-version.sh
VERSION=$(node -p "require('./package.json').version")
BUILD=$(/usr/libexec/PlistBuddy -c "Print CFBundleVersion" ios/FindMyStar/Info.plist)
NEW_BUILD=$((BUILD + 1))
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" \
    ios/FindMyStar/Info.plist
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $NEW_BUILD" \
    ios/FindMyStar/Info.plist
```

### 2.4 Rust Core Version

The Rust engine maintains its own version in `core/Cargo.toml`, tracked independently
but aligned with the app version at each major and minor release.

---

## 3. Planned Versions

| Version | Phase | Key Features | Target Date |
|---------|-------|--------------|-------------|
| 1.0.0-alpha.1 | Pre-release | Core engine, basic UI | Q1 2026 |
| 1.0.0-beta.1 | Pre-release | Feature-complete MVP | Q1 2026 |
| 1.0.0-rc.1 | Pre-release | Release candidate | Q2 2026 |
| **1.0.0** | **MVP** | **Core search, AR, alarms, Pro IAP** | **Q2 2026** |
| 1.0.1 | Patch | Post-launch bug fixes | Q2 2026 |
| **1.1.0** | Growth | Satellites, TLE, advanced calibration | **Q3 2026** |
| **1.2.0** | Advanced | Telescope, astrophotography, cloud | **Q4 2026** |

---

## 4. Pre-Release Versions

### 4.1 Identifiers

```
1.0.0-alpha.1    # Internal testing, feature-incomplete
1.0.0-beta.1     # External testing, feature-complete
1.0.0-rc.1       # Release candidate, production-ready pending validation
1.0.0            # Final release
```

### 4.2 Distribution Mapping

| Stage | Android | iOS |
|-------|---------|-----|
| Alpha | Internal Testing track | TestFlight: Internal testers |
| Beta | Closed/Open Testing tracks | TestFlight: External testers |
| RC | Open Testing track | TestFlight: External testers |
| Release | Production track | App Store: Public release |

### 4.3 Graduation Criteria

| Transition | Criteria |
|------------|----------|
| Alpha -> Beta | All MVP features implemented and functioning |
| Beta -> RC | No critical bugs; crash rate < 0.5% |
| RC -> Release | All tests pass; performance targets met; store assets ready |

---

## 5. Database Compatibility

### 5.1 Schema Versioning

The SQLite schema carries its own version:

```sql
PRAGMA user_version = 1;  -- Schema version 1 for app 1.0.0
```

### 5.2 Compatibility Window

Each app version supports the current schema plus one version back. Migration scripts
in `db/migrations/` run sequentially on app launch:

```
db/migrations/
├── 001_initial_schema.sql       # v1.0.0
├── 002_add_satellite_table.sql  # v1.1.0
└── 003_add_observation_log.sql  # v1.2.0
```

Each migration is idempotent and wrapped in a transaction.

### 5.3 Catalog Updates

The celestial catalog is refreshed independently of app versions via versioned bundled
assets (`assets/catalog_v1.db`, `assets/catalog_v2.db`). The app checks the catalog
version on launch and replaces the local copy if a newer version is bundled.

---

## 6. Rust Core Version

### 6.1 Version Exposure

```rust
#[no_mangle]
pub extern "C" fn core_version() -> *const c_char {
    let version = CString::new(env!("CARGO_PKG_VERSION")).unwrap();
    version.into_raw()
}
```

### 6.2 Validation on Boot

The mobile app validates compatibility on startup:

```typescript
const coreVersion = AstronomyEngine.coreVersion();
const expectedMinVersion = "1.0.0";
if (!semver.gte(coreVersion, expectedMinVersion)) {
    showWarning("Astronomy engine outdated. Please update the app.");
}
```

| Scenario | Behavior |
|----------|----------|
| Core matches expected | Normal operation |
| Core newer than expected | Normal operation (backward compatible) |
| Core older than expected | Warning dialog; suggest app update |
| Core unavailable | Fatal error; prompt reinstall |

---

## 7. Deprecation Policy

### 7.1 Features

1. **Warning phase** (1 minor version): Feature works but shows deprecation notice
2. **Removal phase** (next major version): Feature removed from codebase

### 7.2 Rust FFI Functions

```rust
#[deprecated(since = "1.2.0", note = "Use compute_position_v2 instead")]
#[no_mangle]
pub extern "C" fn compute_position(/* ... */) -> PositionResult {
    compute_position_v2(/* ... */)
}
```

### 7.3 Database Columns

Database columns are **never deleted**. Deprecated columns are marked unused in schema
documentation; new code stops writing to them. This preserves backward compatibility
for users who downgrade.

---

## 8. Git Tagging Convention

```bash
# Release tags
git tag -a v1.0.0 -m "Release 1.0.0: MVP launch"
git push origin v1.0.0

# Pre-release tags
git tag -a v1.0.0-alpha.1 -m "Alpha 1: internal testing"
git tag -a v1.0.0-beta.1 -m "Beta 1: external testing"
git tag -a v1.0.0-rc.1 -m "Release candidate 1"
```

Rules: always prefix with `v`, use annotated tags (`-a`) with a message, and never
delete or move a release tag once pushed.

---

## 9. Related Documents

- [CHANGELOG.md](../../CHANGELOG.md) -- detailed history of all releases
- [Android Deployment](./android-deployment.md) -- Android build and version config
- [iOS Deployment](./ios-deployment.md) -- iOS build and version config
- [Release Checklist](./release-checklist.md) -- step-by-step release procedure
- [Roadmap](../01-product/roadmap.md) -- product phase timeline

---

**Last Updated**: February 2026
