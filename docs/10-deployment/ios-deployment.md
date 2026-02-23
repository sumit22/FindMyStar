# iOS Deployment

## 1. Build Configuration

### 1.1 Xcode Project Settings

| Setting | Value |
|---------|-------|
| Bundle Identifier | `com.findmystar.app` |
| Display Name | FindMyStar |
| Version (CFBundleShortVersionString) | `1.0.0` (from `package.json`) |
| Build Number (CFBundleVersion) | Auto-incremented integer |
| Minimum Deployment Target | iOS 14.0 |
| Supported Destinations | iPhone, iPad |
| Device Orientation | Portrait (primary), Landscape (AR mode) |

### 1.2 Rust Static Library Integration

The Rust domain engine compiles to `libastronomy_engine.a`. A custom Xcode Build Phase
script handles compilation:

```bash
# Build Phase: "Compile Rust Core"
cd "${SRCROOT}/../../core"
if [ "$PLATFORM_NAME" = "iphonesimulator" ]; then
    RUST_TARGET="aarch64-apple-ios-sim"
else
    RUST_TARGET="aarch64-apple-ios"
fi
cargo build --release --target "$RUST_TARGET"
cp "target/${RUST_TARGET}/release/libastronomy_engine.a" "${BUILT_PRODUCTS_DIR}/"
```

Required Rust targets:

```bash
rustup target add aarch64-apple-ios          # Physical devices
rustup target add aarch64-apple-ios-sim      # Simulator (Apple Silicon)
rustup target add x86_64-apple-ios           # Simulator (Intel)
```

### 1.3 Bitcode

Bitcode is **disabled** (`ENABLE_BITCODE = NO`). Rust does not support bitcode, and
Apple deprecated bitcode submission as of Xcode 14.

### 1.4 Linked Frameworks

`ARKit`, `CoreLocation`, `CoreMotion`, `UserNotifications`, `StoreKit`, `AVFoundation`.

---

## 2. Certificates and Provisioning

### 2.1 Apple Developer Account

An Apple Developer Program membership ($99/year) is required for App Store distribution,
TestFlight access, and provisioning profile management.

### 2.2 Certificate Types

| Certificate | Purpose | Validity |
|-------------|---------|----------|
| **Development** | Build and run on test devices | 1 year |
| **Distribution** | Sign apps for App Store or Ad Hoc | 1 year |

### 2.3 Provisioning Profiles

| Profile Type | Use Case |
|--------------|----------|
| **Development** | Run on registered test devices |
| **Ad Hoc** | Distribute to specific devices outside App Store |
| **App Store** | Submit to App Store Connect |

**Recommendation**: Use **Automatic Signing** in Xcode for development. For CI builds,
use manual provisioning profiles stored as GitHub Secrets.

---

## 3. Building Release

### 3.1 Archive via Xcode

1. Select **FindMyStar** scheme and **Any iOS Device** destination
2. **Product** > **Archive**
3. In Organizer: **Distribute App** > **App Store Connect** > **Upload**

### 3.2 Archive via Command Line

```bash
# Step 1: Archive
xcodebuild archive \
  -workspace mobile/ios/FindMyStar.xcworkspace \
  -scheme FindMyStar \
  -configuration Release \
  -archivePath build/FindMyStar.xcarchive \
  -destination "generic/platform=iOS"

# Step 2: Export IPA
xcodebuild -exportArchive \
  -archivePath build/FindMyStar.xcarchive \
  -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist
```

### 3.3 ExportOptions.plist

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
    "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key><string>app-store</string>
    <key>teamID</key><string>TEAM_ID_HERE</string>
    <key>uploadSymbols</key><true/>
    <key>compileBitcode</key><false/>
</dict>
</plist>
```

---

## 4. TestFlight

TestFlight is Apple's beta distribution platform:

| Group | Limit | Review | Availability |
|-------|-------|--------|--------------|
| **Internal testers** | 100 | None (immediate) | App Store Connect team members |
| **External testers** | 10,000 | Beta App Review | Anyone with invite link |

**Workflow**:

1. Upload archive to App Store Connect
2. Internal testers receive push notification immediately
3. For external testing: create group, add testers, submit for Beta App Review
4. Collect feedback via the TestFlight app

---

## 5. App Store Submission

### 5.1 Required Metadata

| Field | Details |
|-------|---------|
| App name | "FindMyStar - Star Finder" (max 30 chars) |
| Subtitle | "AR Celestial Object Guide" (max 30 chars) |
| Description | Full feature description (max 4,000 chars) |
| Keywords | star finder, astronomy, night sky, AR, celestial, offline |
| Support URL | Link to support page or contact |
| Privacy policy URL | Required (even for offline apps) |
| Category | Primary: Education; Secondary: Utilities |

### 5.2 Screenshots

| Device | Size (pixels) | Required |
|--------|---------------|----------|
| iPhone 6.7" (15 Pro Max) | 1290 x 2796 | Yes |
| iPhone 6.1" (15 Pro) | 1179 x 2556 | Yes |
| iPad 12.9" | 2048 x 2732 | If iPad supported |

Recommended screenshots: search screen, AR tracking, target lock, alarm setup, object
detail panel. An app preview video (15-30 seconds) is optional but improves conversion.

### 5.3 Privacy Nutrition Labels

| Data Type | Collected | Linked to Identity | Tracking |
|-----------|-----------|-------------------|----------|
| Precise Location | Yes (used locally) | No | No |
| Camera | Yes (AR mode) | No | No |
| Motion & Fitness | Yes (orientation) | No | No |

No data is collected, stored on servers, or shared with third parties.

---

## 6. App Review Guidelines

Key guidelines to be aware of before submission:

| Guideline | Section | Relevance |
|-----------|---------|-----------|
| Minimum Functionality | 4.2 | App must be complete and provide lasting value |
| Software Requirements | 2.5.1 | Use only public APIs (ARKit, CoreLocation) |
| Data Collection | 5.1.1 | Disclose location, camera, and motion usage |
| In-App Purchase | 3.1.1 | Pro features must use Apple IAP |

### Common Rejection Reasons

| Reason | Prevention |
|--------|------------|
| Incomplete app or placeholders | Ensure all screens are functional |
| Vague permission usage strings | Write specific, user-friendly descriptions |
| Missing privacy policy | Host a privacy policy page |
| Crashes during review | Test on clean install with no prior data |

---

## 7. Permissions (Info.plist)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>FindMyStar needs your location to calculate which celestial objects
are visible from where you are.</string>

<key>NSCameraUsageDescription</key>
<string>FindMyStar uses your camera to provide AR guidance to find
celestial objects.</string>

<key>NSMotionUsageDescription</key>
<string>FindMyStar uses motion sensors to determine which direction
your phone is pointing.</string>
```

These strings appear in system permission dialogs and must clearly explain *why* the
permission is needed. FindMyStar does **not** request `NSLocationAlwaysUsageDescription`
since location is only used while the app is in the foreground.

---

## 8. In-App Purchases

### 8.1 Pro Upgrade

| Field | Value |
|-------|-------|
| Product ID | `com.findmystar.pro` |
| Type | Non-Consumable |
| Price | $2.99 - $6.99 / INR 499-799 (varies by region) |
| Description | Unlock full catalog, alarms, and precision mode |

### 8.2 StoreKit 2 Integration

```swift
func checkProStatus() async {
    for await result in Transaction.currentEntitlements {
        if case .verified(let transaction) = result {
            if transaction.productID == "com.findmystar.pro" {
                await unlockProFeatures()
            }
        }
    }
}
```

Receipt validation is **local only** using StoreKit 2's built-in JWS verification.
No server-side validation is needed since FindMyStar has no backend. Restore purchases
via `AppStore.sync()`.

---

## 9. Related Documents

- [Version Strategy](./version-strategy.md) -- versioning policy and planned releases
- [Release Checklist](./release-checklist.md) -- step-by-step release procedure
- [Android Deployment](./android-deployment.md) -- Android-specific build and submission
- [CI/CD Pipeline](../09-devops/ci-cd.md) -- automated build and test workflows
- [Testing Strategy](../08-testing/overview.md) -- test coverage requirements

---

**Last Updated**: February 2026
