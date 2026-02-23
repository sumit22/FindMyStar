# Android Deployment

## 1. Build Configuration

### 1.1 Gradle Settings

The primary build configuration lives in `android/app/build.gradle`:

```groovy
android {
    compileSdkVersion 34
    defaultConfig {
        applicationId "com.findmystar.app"
        minSdkVersion 29          // Android 10+
        targetSdkVersion 34       // Android 14
        versionCode 1             // Auto-incremented integer
        versionName "1.0.0"       // Semantic version from package.json
    }
    buildTypes {
        release {
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'),
                          'proguard-rules.pro'
        }
    }
}
```

### 1.2 Rust NDK Integration

The Rust domain engine compiles to `libastronomy_engine.so` via the Android NDK using
CMake to orchestrate the native build:

```groovy
android {
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
            version "3.22.1"
        }
    }
    defaultConfig {
        ndk { abiFilters 'arm64-v8a', 'armeabi-v7a', 'x86_64' }
    }
}
```

Cross-compilation targets for each ABI:

| ABI | Rust Target |
|-----|-------------|
| `arm64-v8a` | `aarch64-linux-android` |
| `armeabi-v7a` | `armv7-linux-androideabi` |
| `x86_64` | `x86_64-linux-android` |

### 1.3 ProGuard / R8 Configuration

Release builds use R8 with custom rules for the native bridge:

```proguard
-keep class com.findmystar.engine.AstronomyBridge { *; }
-keep class com.findmystar.engine.** { native <methods>; }
-keep class com.facebook.react.** { *; }
-dontwarn com.facebook.react.**
```

---

## 2. Signing

### 2.1 Generate a Release Keystore

Create a keystore for signing release builds (**never commit to version control**):

```bash
keytool -genkey -v -keystore findmystar.keystore \
  -alias findmystar-release -keyalg RSA -keysize 2048 -validity 10000
```

### 2.2 Local Signing Configuration

Add credentials to `gradle.properties` (excluded via `.gitignore`):

```properties
MYAPP_RELEASE_STORE_FILE=findmystar.keystore
MYAPP_RELEASE_KEY_ALIAS=findmystar-release
MYAPP_RELEASE_STORE_PASSWORD=<STORE_PASSWORD>
MYAPP_RELEASE_KEY_PASSWORD=<KEY_PASSWORD>
```

Reference these in `build.gradle`:

```groovy
android {
    signingConfigs {
        release {
            storeFile file(MYAPP_RELEASE_STORE_FILE)
            storePassword MYAPP_RELEASE_STORE_PASSWORD
            keyAlias MYAPP_RELEASE_KEY_ALIAS
            keyPassword MYAPP_RELEASE_KEY_PASSWORD
        }
    }
}
```

### 2.3 CI Signing via GitHub Secrets

Store signing credentials as GitHub Actions secrets:

| Secret Name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Base64-encoded `.keystore` file |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password |
| `ANDROID_KEY_ALIAS` | Key alias (`findmystar-release`) |
| `ANDROID_KEY_PASSWORD` | Key password |

Decode in CI: `echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > android/app/findmystar.keystore`

---

## 3. Building Release

### 3.1 App Bundle (Play Store)

```bash
cd mobile/android
./gradlew bundleRelease  # AAB for Play Store
```

Output: `app/build/outputs/bundle/release/app-release.aab`

### 3.2 APK (Direct Distribution)

```bash
cd mobile/android
./gradlew assembleRelease  # APK for sideloading or testing
```

Output: `app/build/outputs/apk/release/app-release.apk`

### 3.3 Verify the Build

```bash
bundletool build-apks --bundle=app-release.aab --output=app.apks --mode=universal
apksigner verify --verbose app-release.apk
```

---

## 4. Play Store Submission

### 4.1 Prerequisites

- **Google Play Console** account (one-time $25 registration fee)
- **Privacy policy URL** (required even for fully offline apps)
- **Content rating** questionnaire completed in Play Console
- **Target audience declaration**: 13+ (astronomy education)

### 4.2 App Listing

| Asset | Specification |
|-------|---------------|
| App title | "FindMyStar" (max 30 chars) |
| Short description | Max 80 characters |
| Full description | Max 4,000 characters |
| Phone screenshots | Min 2, max 8 (16:9 or 9:16) |
| Tablet screenshots | Min 2 if tablet-compatible |
| Feature graphic | 1024 x 500 px |
| App icon | 512 x 512 px (hi-res) |

### 4.3 Content Rating

Complete the IARC questionnaire. Expected rating: **Everyone** (ESRB) / **3+** (PEGI).

---

## 5. Release Tracks

| Track | Audience | Review | Use Case |
|-------|----------|--------|----------|
| **Internal testing** | Up to 100 (team) | None | Quick iteration, instant updates |
| **Closed testing** (Alpha) | Invited testers | Brief | Feedback from trusted users |
| **Open testing** (Beta) | Public opt-in | Standard | Wider feedback, stress testing |
| **Production** | All Play Store users | Standard | Full public release |

**Recommended flow**: Internal -> Closed -> Open -> Production

Use staged rollouts in Production (start at 10%, increase gradually). Monitor the
Android Vitals dashboard for crash rate and ANR metrics between each stage.

---

## 6. Version Strategy

- **versionCode**: Auto-incrementing integer. Must increase with every Play Store upload.
- **versionName**: Semantic version string ("1.0.0") sourced from `mobile/package.json`.

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

See [Version Strategy](./version-strategy.md) for the full versioning policy.

---

## 7. App Bundle Requirements

Since August 2021, Google Play requires the **Android App Bundle** (AAB) format:

- **Dynamic delivery**: Users download only resources matching their device
- **Smaller install size**: Optimized APKs generated per device configuration

**Play App Signing** is mandatory for AAB distribution. Google manages the app signing
key; the developer keeps an upload key. If the upload key is compromised, it can be
reset without affecting end users.

---

## 8. Permissions

FindMyStar declares these permissions in `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Not required**: `INTERNET` (fully offline), `WRITE_EXTERNAL_STORAGE` (app-private
SQLite), `READ_PHONE_STATE` (no telemetry). Runtime permissions are requested at the
point of use (e.g., camera permission when opening AR mode).

---

## 9. Store Listing Optimization

**Keywords**: star finder, astronomy, night sky, AR, celestial, offline, planet finder

**Screenshots** (recommended 4-6):

1. Search screen with celestial catalog and filters
2. AR tracking with directional arrow overlay
3. Target lock confirmation ("TARGET LOCKED")
4. Alarm setup for visibility alerts
5. Object detail panel with rise/set times

**Localization**: English and Hindi at launch; expand based on download geography.

---

## 10. Related Documents

- [Version Strategy](./version-strategy.md) -- versioning policy and planned releases
- [Release Checklist](./release-checklist.md) -- step-by-step release procedure
- [iOS Deployment](./ios-deployment.md) -- iOS-specific build and submission
- [CI/CD Pipeline](../09-devops/ci-cd.md) -- automated build and test workflows
- [Testing Strategy](../08-testing/overview.md) -- test coverage requirements

---

**Last Updated**: February 2026
