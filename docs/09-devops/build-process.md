# Build Process & Local Development Setup

This guide walks through the complete local development environment setup for FindMyStar, covering the Rust domain engine, React Native mobile app, and supporting toolchain. A new contributor should be able to complete their first successful build within 30 minutes.

---

## 1. Prerequisites

| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| **Rust** (via rustup) | stable (1.75+) | Domain engine compilation |
| **Node.js** | v18+ | React Native toolchain |
| **npm** | v9+ | Package management |
| **Android Studio** | 2023.1+ | Android SDK, emulator |
| **Android SDK** | API 29+ | Android build target |
| **Android NDK** | r25+ | Rust native library linking |
| **JDK** | 17 | Android Gradle builds |
| **Xcode** | 14+ | iOS builds (macOS only) |
| **CocoaPods** | 1.12+ | iOS dependency management |
| **Command Line Tools** | Latest | Xcode CLI utilities |
| **SQLite** | sqlite3 CLI | Local database debugging |
| **Python** | 3.10+ | Catalog population scripts |

> **Note**: iOS development requires macOS. Android development works on macOS, Linux, and Windows.

---

## 2. Rust Toolchain Setup

### 2.1 Install Rustup and Stable Toolchain

```bash
# Install rustup (macOS/Linux)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Select default stable toolchain during installation
rustup default stable
```

### 2.2 Add Cross-Compilation Targets

FindMyStar compiles the Rust core engine to native libraries for each mobile platform. Add the required targets:

```bash
# iOS targets
rustup target add aarch64-apple-ios        # iOS ARM64 (physical devices)
rustup target add x86_64-apple-ios         # iOS x86_64 (simulator on Intel Mac)
rustup target add aarch64-apple-ios-sim    # iOS ARM64 simulator (Apple Silicon)

# Android targets
rustup target add aarch64-linux-android    # Android ARM64 (modern devices)
rustup target add armv7-linux-androideabi  # Android ARMv7 (older devices)
rustup target add x86_64-linux-android     # Android x86_64 (emulator)

# Optional: WASM target for web-based testing tools
rustup target add wasm32-unknown-unknown
```

### 2.3 Install Development Tools

```bash
# Linting
rustup component add clippy

# Formatting
rustup component add rustfmt

# Code coverage (optional)
cargo install cargo-tarpaulin

# Dependency auditing
cargo install cargo-audit
```

### 2.4 Verify Installation

```bash
rustc --version    # Expected: rustc 1.75.0 or later
cargo --version    # Expected: cargo 1.75.0 or later
rustup show        # Lists installed targets and components
```

---

## 3. Building the Rust Core Engine

The core engine lives in the `core/` directory and produces native libraries consumed by the mobile app through the FFI boundary.

### 3.1 Host Build (Development & Testing)

```bash
cd core

# Debug build (fast compilation, no optimizations)
cargo build

# Release build (optimized, used for benchmarking)
cargo build --release

# Run all tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run only validation tests
cargo test --test validation_tests
```

### 3.2 Cross-Compilation for Mobile

```bash
# iOS ARM64 (physical devices)
cargo build --release --target aarch64-apple-ios

# iOS Simulator (Apple Silicon)
cargo build --release --target aarch64-apple-ios-sim

# Android ARM64
cargo build --release --target aarch64-linux-android

# Android ARMv7
cargo build --release --target armv7-linux-androideabi
```

### 3.3 Build Output Locations

| Target | Output Path | Library Name |
|--------|------------|--------------|
| macOS (host) | `target/release/` | `libastronomy_engine.dylib` |
| Linux (host) | `target/release/` | `libastronomy_engine.so` |
| iOS (static) | `target/aarch64-apple-ios/release/` | `libastronomy_engine.a` |
| Android (shared) | `target/aarch64-linux-android/release/` | `libastronomy_engine.so` |

### 3.4 Lint and Format Checks

```bash
# Lint with zero warnings policy
cargo clippy -- -D warnings

# Check formatting (no changes applied)
cargo fmt -- --check

# Apply formatting
cargo fmt
```

---

## 4. Mobile App Setup

### 4.1 Install JavaScript Dependencies

```bash
cd mobile
npm install
```

### 4.2 iOS-Specific Setup (macOS Only)

```bash
# Install CocoaPods if not already installed
sudo gem install cocoapods

# Install iOS native dependencies
cd mobile/ios
pod install

# Or use the convenience script from the mobile directory
cd mobile
npx pod-install
```

### 4.3 Environment Variables

Set the following environment variables in your shell profile (`~/.bashrc`, `~/.zshrc`):

```bash
# Android SDK
export ANDROID_HOME=$HOME/Library/Android/sdk       # macOS
export ANDROID_HOME=$HOME/Android/Sdk               # Linux

# Android NDK (required for Rust linking)
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653

# Add platform tools to PATH
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/emulator
```

---

## 5. Android Build

### 5.1 Debug Build

```bash
cd mobile/android

# Build debug APK
./gradlew assembleDebug

# Output: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### 5.2 Release Build

```bash
cd mobile/android

# Release APK (requires signing configuration)
./gradlew assembleRelease

# Android App Bundle for Play Store
./gradlew bundleRelease

# Output: mobile/android/app/build/outputs/bundle/release/app-release.aab
```

### 5.3 NDK Configuration

The NDK path and ABI filters are configured in `mobile/android/app/build.gradle`:

```groovy
android {
    ndkVersion "25.2.9519653"

    defaultConfig {
        ndk {
            abiFilters "arm64-v8a", "armeabi-v7a", "x86_64"
        }
    }
}
```

Ensure the `ANDROID_NDK_HOME` environment variable matches the version declared in `build.gradle`.

---

## 6. iOS Build

### 6.1 Command Line Build

```bash
cd mobile/ios

# Install pods (first time or after adding dependencies)
pod install

# Build for simulator
xcodebuild -workspace FindMyStar.xcworkspace \
  -scheme FindMyStar \
  -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 15' \
  build

# Build for device (requires signing)
xcodebuild -workspace FindMyStar.xcworkspace \
  -scheme FindMyStar \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  build
```

### 6.2 Xcode GUI Build

1. Open `mobile/ios/FindMyStar.xcworkspace` (not `.xcodeproj`)
2. Select the **FindMyStar** scheme from the scheme selector
3. Choose a simulator or connected device
4. Press **Cmd+B** to build or **Cmd+R** to build and run

### 6.3 Signing Configuration

For development builds, enable **Automatically manage signing** in Xcode under **Signing & Capabilities**. Production signing requires provisioning profiles configured via Apple Developer Portal.

---

## 7. Database Setup

### 7.1 Initialize the SQLite Database

The app ships with a pre-populated celestial object catalog stored in SQLite:

```bash
# Create the database from schema
sqlite3 mobile/assets/findmystar.db < db/schema.sql

# Populate with star catalog data (Hipparcos, Messier, planets)
python scripts/populate_catalog.py

# Verify the database
sqlite3 mobile/assets/findmystar.db "SELECT COUNT(*) FROM objects;"
# Expected: ~9100+ objects (stars, planets, deep sky)
```

### 7.2 Database Debugging

```bash
# Open interactive SQLite shell
sqlite3 mobile/assets/findmystar.db

# Useful queries
.tables                                    -- List all tables
.schema objects                            -- Show objects table schema
SELECT * FROM objects WHERE name LIKE '%Sirius%';
SELECT * FROM tracked_objects;
```

---

## 8. Running the App

### 8.1 Start the Metro Bundler

```bash
cd mobile
npx react-native start
```

### 8.2 Launch on Android

```bash
# Ensure an emulator is running or a device is connected
cd mobile
npx react-native run-android
```

### 8.3 Launch on iOS

```bash
# Ensure a simulator is available
cd mobile
npx react-native run-ios

# Target a specific simulator
npx react-native run-ios --simulator="iPhone 15 Pro"
```

---

## 9. First 30-Minute Build Checklist

Use this checklist to verify your environment is correctly configured:

- [ ] **Rust compiles**: `cd core && cargo build --release` completes without errors
- [ ] **Rust tests pass**: `cargo test` reports all tests green
- [ ] **Clippy clean**: `cargo clippy -- -D warnings` reports zero warnings
- [ ] **npm install succeeds**: `cd mobile && npm install` completes
- [ ] **TypeScript tests pass**: `npm test` reports all tests green
- [ ] **Android emulator launches**: App renders on Android emulator
- [ ] **iOS simulator launches**: App renders on iOS simulator (macOS only)
- [ ] **Sample computation works**: RA/Dec to Alt/Az returns a valid result
- [ ] **SQLite database opens**: `sqlite3 mobile/assets/findmystar.db ".tables"` lists tables
- [ ] **Catalog data present**: Objects table contains star catalog entries

---

## 10. Troubleshooting

### NDK Not Found

```
error: could not find Android NDK
```

**Fix**: Set `ANDROID_NDK_HOME` to the exact NDK path:
```bash
export ANDROID_NDK_HOME=$ANDROID_HOME/ndk/25.2.9519653
```
Confirm the version matches what is installed via Android Studio > SDK Manager > SDK Tools.

### iOS Pod Install Fails

```
[!] CocoaPods could not find compatible versions
```

**Fix**: Update the CocoaPods spec repository and retry:
```bash
pod repo update
cd mobile/ios && pod install
```

### Rust Linker Errors on Cross-Compilation

```
error: linker 'aarch64-linux-android-clang' not found
```

**Fix**: Ensure the Android NDK standalone toolchain is on your PATH, and that `~/.cargo/config.toml` contains the correct linker paths for each Android target:

```toml
[target.aarch64-linux-android]
linker = "/path/to/ndk/toolchains/llvm/prebuilt/linux-x86_64/bin/aarch64-linux-android29-clang"
```

### Metro Bundler Port Conflict

```
error: packager is already running on port 8081
```

**Fix**: Kill the existing process or use a different port:
```bash
npx react-native start --port 8082
```

### Gradle Build Failure on JDK Version

```
Unsupported class file major version
```

**Fix**: Ensure JDK 17 is installed and selected:
```bash
java -version   # Should report 17.x
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

---

## 11. IDE Setup

### 11.1 Visual Studio Code (Recommended)

Install the following extensions:

| Extension | Purpose |
|-----------|---------|
| **rust-analyzer** | Rust language server (IntelliSense, errors) |
| **ESLint** | TypeScript linting |
| **Prettier** | Code formatting |
| **React Native Tools** | Debugging, IntelliSense for RN |
| **SQLite Viewer** | Browse local database |
| **Even Better TOML** | Cargo.toml editing |

Workspace settings (`.vscode/settings.json`):
```json
{
  "rust-analyzer.cargo.target": null,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[rust]": {
    "editor.defaultFormatter": "rust-lang.rust-analyzer"
  }
}
```

### 11.2 Android Studio

- Enable **NDK** support via SDK Manager > SDK Tools
- Import the `mobile/android` directory as a Gradle project
- Configure the Kotlin plugin if prompted

### 11.3 Xcode

- Open `mobile/ios/FindMyStar.xcworkspace`
- Standard configuration; no additional plugins required
- Enable **Address Sanitizer** in scheme settings for debugging memory issues in the Rust FFI layer

---

## 12. Related Documentation

- **[Contributing Guide](../CONTRIBUTING.md)** -- Workflow, PR process, and code review expectations
- **[CI/CD Pipeline](./ci-cd.md)** -- Automated build and test configuration
- **[Code Standards](./code-standards.md)** -- Formatting, linting, and style conventions
- **[Architecture Overview](../03-architecture/architecture-overview.md)** -- System layers and module organization
- **[Testing Strategy](../08-testing/overview.md)** -- Test categories and validation approach

---

**Last Updated**: February 2026
