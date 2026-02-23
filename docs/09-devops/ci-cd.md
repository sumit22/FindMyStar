# Continuous Integration & Deployment

This document describes the FindMyStar CI/CD pipeline, branch strategy, and automated quality gates. All automation runs on GitHub Actions.

---

## 1. Pipeline Overview

Every push and pull request triggers the following pipeline:

```
Push / PR
    |
    v
+----------+     +---------+     +---------+     +----------+     +--------+
|   Lint   | --> |  Build  | --> |  Test   | --> | Validate | --> | Report |
+----------+     +---------+     +---------+     +----------+     +--------+
  clippy           cargo          cargo test      ephemeris        coverage
  rustfmt          build          npm test        benchmarks       artifacts
  eslint           gradlew                        cargo audit
  prettier         xcodebuild
```

- **Lint** and **Build** stages run in parallel for Rust and TypeScript.
- **Android** and **iOS** builds depend on both Rust tests and TypeScript tests passing.
- **Validate** runs ephemeris validation and security audits.
- **Report** publishes coverage reports and build artifacts.

---

## 2. GitHub Actions Configuration

### 2.1 Primary CI Workflow

The main workflow file lives at `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main, develop, 'release/*']
  pull_request:
    branches: [main, develop]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  rust-checks:
    name: Rust Lint & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt

      - name: Cache cargo registry
        uses: actions/cache@v4
        with:
          path: |
            ~/.cargo/registry
            ~/.cargo/git
            core/target
          key: ${{ runner.os }}-cargo-${{ hashFiles('core/Cargo.lock') }}

      - name: Check formatting
        run: cd core && cargo fmt -- --check

      - name: Run clippy
        run: cd core && cargo clippy -- -D warnings

      - name: Run unit tests
        run: cd core && cargo test --release

      - name: Run validation tests
        run: cd core && cargo test --test validation_tests

      - name: Security audit
        run: cd core && cargo audit

  typescript-checks:
    name: TypeScript Lint & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: mobile/package-lock.json

      - name: Install dependencies
        run: cd mobile && npm ci

      - name: Run ESLint
        run: cd mobile && npm run lint

      - name: Check Prettier formatting
        run: cd mobile && npx prettier --check "src/**/*.{ts,tsx}"

      - name: Run tests with coverage
        run: cd mobile && npm test -- --coverage --ci

      - name: Security audit
        run: cd mobile && npm audit --audit-level=high

      - name: Upload coverage report
        uses: actions/upload-artifact@v4
        with:
          name: ts-coverage
          path: mobile/coverage/

  android-build:
    name: Android Build
    runs-on: ubuntu-latest
    needs: [rust-checks, typescript-checks]
    steps:
      - uses: actions/checkout@v4

      - name: Setup JDK
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd mobile && npm ci

      - name: Build debug APK
        run: cd mobile/android && ./gradlew assembleDebug

      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: debug-apk
          path: mobile/android/app/build/outputs/apk/debug/app-debug.apk

  ios-build:
    name: iOS Build
    runs-on: macos-latest
    needs: [rust-checks, typescript-checks]
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: cd mobile && npm ci

      - name: Install CocoaPods
        run: cd mobile/ios && pod install

      - name: Build for simulator
        run: |
          xcodebuild -workspace mobile/ios/FindMyStar.xcworkspace \
            -scheme FindMyStar \
            -configuration Debug \
            -destination 'platform=iOS Simulator,name=iPhone 15' \
            -derivedDataPath build \
            build
```

### 2.2 Coverage Reporting Workflow

```yaml
  coverage:
    name: Code Coverage
    runs-on: ubuntu-latest
    needs: [rust-checks]
    steps:
      - uses: actions/checkout@v4

      - uses: dtolnay/rust-toolchain@stable

      - name: Install tarpaulin
        run: cargo install cargo-tarpaulin

      - name: Generate Rust coverage
        run: cd core && cargo tarpaulin --out xml --output-dir coverage

      - name: Upload coverage artifact
        uses: actions/upload-artifact@v4
        with:
          name: rust-coverage
          path: core/coverage/
```

---

## 3. Pipeline Stages in Detail

### 3.1 Lint Stage

Enforces code quality before compilation:

| Check | Tool | Command | Policy |
|-------|------|---------|--------|
| Rust lint | clippy | `cargo clippy -- -D warnings` | Zero warnings |
| Rust format | rustfmt | `cargo fmt -- --check` | Must pass |
| TypeScript lint | ESLint | `npm run lint` | Zero warnings |
| TypeScript format | Prettier | `npx prettier --check` | Must pass |

### 3.2 Build Stage

Compiles all project targets:

| Target | Tool | Command |
|--------|------|---------|
| Rust (host) | cargo | `cargo build --release` |
| Android APK | Gradle | `./gradlew assembleDebug` |
| Android AAB | Gradle | `./gradlew bundleRelease` |
| iOS | xcodebuild | `xcodebuild ... build` |

### 3.3 Test Stage

Runs all automated test suites:

| Suite | Tool | Command | Scope |
|-------|------|---------|-------|
| Rust unit tests | cargo | `cargo test --release` | Domain engine |
| Rust validation | cargo | `cargo test --test validation_tests` | Ephemeris accuracy |
| TypeScript unit | Jest | `npm test -- --ci` | Services, components |
| TypeScript coverage | Jest | `npm test -- --coverage` | Coverage report |

### 3.4 Security Stage

Identifies known vulnerabilities in dependencies:

| Tool | Command | Frequency |
|------|---------|-----------|
| cargo audit | `cargo audit` | Every PR + weekly |
| npm audit | `npm audit --audit-level=high` | Every PR + weekly |

---

## 4. Branch Strategy

FindMyStar uses a modified Git Flow branching model:

```
main ─────────────────────────────────────────── stable, deployable
  \                                         /
   develop ──────────────────────────────── integration
     \          \          \          /
      feature/   feature/   feature/
      search     ar-view    alarms
```

### 4.1 Branch Purposes

| Branch | Purpose | Merges To | CI |
|--------|---------|-----------|-----|
| `main` | Stable, deployable releases | -- | Full pipeline |
| `develop` | Integration of completed features | `main` (via release branch) | Full pipeline |
| `feature/*` | Individual feature development | `develop` | Full pipeline |
| `release/*` | Release preparation and stabilization | `main` + `develop` | Full pipeline + release builds |
| `hotfix/*` | Urgent production fixes | `main` + `develop` | Full pipeline |

### 4.2 Branch Naming Conventions

```
feature/add-saturn-tracking
feature/improve-rise-set-accuracy
fix/incorrect-azimuth-calculation
refactor/extract-coordinate-transform
docs/update-algorithm-reference
release/1.2.0
hotfix/1.1.1-crash-on-search
```

### 4.3 Branch Protection Rules (main)

- Require pull request before merging
- Require at least 1 approving review
- Require all status checks to pass
- Require branch to be up to date before merging
- Do not allow force pushes
- Do not allow deletions

---

## 5. Pull Request Requirements

Every PR must satisfy the following before merge:

### 5.1 Automated Checks

- [ ] All CI pipeline stages pass (lint, build, test, validate)
- [ ] No decrease in code coverage (measured by tarpaulin + Jest)
- [ ] Zero clippy warnings
- [ ] Zero ESLint warnings
- [ ] Security audit reports no new high/critical vulnerabilities

### 5.2 Manual Review

- [ ] Code review approval from at least 1 team member
- [ ] Documentation updated if public API changed
- [ ] Commit messages follow conventional format (see [Code Standards](./code-standards.md))
- [ ] No hardcoded values or magic numbers without comments
- [ ] Error handling is complete (no bare `unwrap()` in production code)

### 5.3 PR Description Template

```markdown
## What Changed
Brief description of the change.

## Why
Motivation or issue reference.

## How to Test
Steps to verify the change locally.

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tested on Android emulator
- [ ] Tested on iOS simulator (if applicable)

Refs: #issue-number
```

---

## 6. Build Artifacts

### 6.1 Per-PR Artifacts

Every pull request produces:

| Artifact | Format | Retention |
|----------|--------|-----------|
| Debug APK | `.apk` | 14 days |
| Test coverage (Rust) | XML/HTML | 14 days |
| Test coverage (TypeScript) | HTML | 14 days |
| Lint reports | Text | 14 days |

### 6.2 Release Artifacts

Merges to `release/*` branches additionally produce:

| Artifact | Format | Retention |
|----------|--------|-----------|
| Release APK | `.apk` (signed) | 90 days |
| Release AAB | `.aab` (signed) | 90 days |
| Benchmark comparison | JSON | 90 days |
| Full coverage report | HTML | 90 days |

### 6.3 Downloading Artifacts

Artifacts are available via the GitHub Actions UI under each workflow run, or via the GitHub CLI:

```bash
gh run download <run-id> --name debug-apk
```

---

## 7. Scheduled Jobs

### 7.1 Nightly Full Validation

Runs the complete ephemeris validation suite against known astronomical data:

```yaml
name: Nightly Validation

on:
  schedule:
    - cron: '0 3 * * *'  # 03:00 UTC daily

jobs:
  full-validation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - name: Run full validation suite
        run: cd core && cargo test --test validation_tests --release -- --ignored
      - name: Run benchmarks
        run: cd core && cargo bench
      - name: Upload benchmark results
        uses: actions/upload-artifact@v4
        with:
          name: nightly-benchmarks
          path: core/target/criterion/
```

### 7.2 Weekly Dependency Audit

Checks for newly disclosed vulnerabilities in project dependencies:

```yaml
name: Weekly Security Audit

on:
  schedule:
    - cron: '0 6 * * 1'  # 06:00 UTC every Monday

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Rust dependency audit
        run: cd core && cargo audit
      - name: Node.js dependency audit
        run: cd mobile && npm audit --audit-level=moderate
```

If vulnerabilities are found, the workflow creates a GitHub Issue automatically for triage.

---

## 8. Environment Configuration

### 8.1 CI Secrets

The following secrets are configured in the GitHub repository settings:

| Secret | Purpose | Used By |
|--------|---------|---------|
| `ANDROID_KEYSTORE_BASE64` | Release signing keystore | Android release build |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Android release build |
| `ANDROID_KEY_ALIAS` | Signing key alias | Android release build |
| `ANDROID_KEY_PASSWORD` | Key password | Android release build |

> **Note**: iOS signing is handled via Xcode Cloud or Fastlane Match for release builds, which is documented in [iOS Deployment](../10-deployment/ios-deployment.md).

### 8.2 Caching Strategy

CI builds use aggressive caching to reduce build times:

| Cache | Key | Expected Savings |
|-------|-----|-----------------|
| Cargo registry | `Cargo.lock` hash | ~2 minutes |
| Cargo build artifacts | `Cargo.lock` hash + OS | ~5 minutes |
| npm packages | `package-lock.json` hash | ~1 minute |
| Gradle dependencies | `build.gradle` hash | ~3 minutes |
| CocoaPods | `Podfile.lock` hash | ~2 minutes |

---

## 9. Pipeline Timing

Typical CI pipeline execution times:

| Stage | Duration | Runs On |
|-------|----------|---------|
| Rust lint + test | ~4 minutes | ubuntu-latest |
| TypeScript lint + test | ~3 minutes | ubuntu-latest |
| Android build | ~6 minutes | ubuntu-latest |
| iOS build | ~10 minutes | macos-latest |
| Coverage report | ~5 minutes | ubuntu-latest |
| **Total (parallel)** | **~15 minutes** | -- |

The Rust and TypeScript stages run in parallel. Mobile builds start after both complete. Total wall-clock time for a full PR pipeline is approximately 15 minutes.

---

## 10. Failure Handling

### 10.1 Flaky Test Policy

- Tests that fail intermittently must be marked with `#[ignore]` (Rust) or `.skip` (Jest) and tracked as a GitHub Issue.
- Ignored tests must include a comment with the issue number.
- Nightly builds run ignored tests to detect when underlying issues are resolved.

### 10.2 Build Failure Notifications

- PR authors are notified via GitHub check status on the PR.
- Failures on `main` or `develop` trigger a notification to the team channel.
- Nightly failures create a GitHub Issue automatically.

### 10.3 Recovery Process

1. Identify the failing step in the GitHub Actions log.
2. Reproduce locally using the same commands documented in [Build Process](./build-process.md).
3. Fix the issue on the feature branch.
4. Push the fix; CI re-runs automatically.

---

## 11. Related Documentation

- **[Build Process](./build-process.md)** -- Local development setup and build commands
- **[Code Standards](./code-standards.md)** -- Formatting, linting, and commit message conventions
- **[Code Quality Metrics](./metrics.md)** -- Coverage targets and quality thresholds
- **[Contributing Guide](../CONTRIBUTING.md)** -- PR workflow and review expectations
- **[Testing Strategy](../08-testing/overview.md)** -- Test categories and validation criteria

---

**Last Updated**: February 2026
