# Release Checklist

Follow each section in order. Do not proceed to the next section until all items in
the current section are complete.

---

## 1. Pre-Release Checklist

### 1.1 Code Quality

- [ ] All CI checks pass on the release branch (lint, build, test)
- [ ] Test coverage meets targets: >90% Rust, >80% TypeScript
- [ ] No critical or high-severity bugs open in the issue tracker
- [ ] Code review completed and approved for all changes since last release
- [ ] Static analysis clean (Clippy for Rust, ESLint for TypeScript)

### 1.2 Functional Validation

- [ ] Ephemeris validation tests pass (RA/Dec within +/-1 arcminute)
- [ ] Rise/set computation matches USNO data within +/-2 minutes
- [ ] AR tracking lock achieves sub-1-degree accuracy on test devices
- [ ] Alarm notifications fire at the correct scheduled time
- [ ] Circumpolar and never-visible edge cases handled correctly
- [ ] Pro upgrade purchase flow works end to end (sandbox)

### 1.3 Performance Benchmarks

- [ ] Position computation <20ms (Rust core)
- [ ] AR frame rate sustained at 30+ FPS on minimum-spec devices
- [ ] Rise/set calculation <500ms per object
- [ ] App cold start <3 seconds
- [ ] Memory usage under 100MB during AR tracking

### 1.4 Documentation

- [ ] CHANGELOG.md updated with all changes
- [ ] Version numbers updated in `mobile/package.json`
- [ ] Version numbers updated in `core/Cargo.toml` (if core changed)
- [ ] Database migration scripts reviewed and tested

---

## 2. Build and Sign

### 2.1 Android

- [ ] `./gradlew bundleRelease` produces AAB
- [ ] AAB signed with correct upload key
- [ ] `libastronomy_engine.so` included for arm64-v8a, armeabi-v7a, x86_64
- [ ] AAB size within budget (<100MB installed)
- [ ] ProGuard mapping file saved for crash symbolication

### 2.2 iOS

- [ ] Archive created via Xcode or `xcodebuild archive`
- [ ] Archive validated in Xcode Organizer (no errors)
- [ ] Uploaded to App Store Connect
- [ ] `libastronomy_engine.a` linked for required architectures
- [ ] dSYM files saved for crash symbolication

### 2.3 Build Verification

- [ ] Both builds tested on at least one physical device each
- [ ] Fresh install tested (no previous app data)
- [ ] Upgrade install tested (from previous version)
- [ ] App launches without crashes on both platforms

---

## 3. Testing

### 3.1 Automated

- [ ] Smoke tests pass on Android emulator (API 29+)
- [ ] Smoke tests pass on iOS simulator (iOS 14+)
- [ ] Full integration test suite passes
- [ ] No regressions in automated results

### 3.2 Manual Device Testing

| Device | OS Version | Status | Tester | Notes |
|--------|------------|--------|--------|-------|
| Android (high-end) | Android 14 | [ ] | | |
| Android (mid-range) | Android 10 | [ ] | | |
| iPhone (current gen) | iOS 17 | [ ] | | |
| iPhone (minimum spec) | iOS 14 | [ ] | | |

### 3.3 Feature Verification

- [ ] Search: find objects by name, filter by type, browse catalog
- [ ] AR tracking: arrow guidance, angular distance, target lock
- [ ] Alarm notifications: schedule, receive, tap to open
- [ ] Object info: detail panel with rise/set times, magnitude
- [ ] Pro upgrade: purchase, feature unlock, restore purchases
- [ ] Settings: location, notifications, calibration

### 3.4 Edge Cases

- [ ] AR tracking verified outdoors under real sky
- [ ] Alarm notification verified after device reboot
- [ ] App works with location services disabled
- [ ] App works with camera permission denied
- [ ] App works in airplane mode (fully offline)
- [ ] Database migration from previous version
- [ ] Fresh install on a clean device

---

## 4. Store Submission

### 4.1 Google Play Store

- [ ] AAB uploaded to appropriate track (Internal/Closed/Open/Production)
- [ ] Release notes written
- [ ] Screenshots updated if UI changed
- [ ] Content rating questionnaire current
- [ ] Privacy policy URL valid
- [ ] Target API level meets Play Store requirements

### 4.2 Apple App Store

- [ ] Build submitted via App Store Connect
- [ ] Release notes filled in
- [ ] Screenshots updated if UI changed
- [ ] Privacy nutrition labels accurate
- [ ] "What's New" text written
- [ ] Phased release enabled (start at 1% for major releases)

### 4.3 Timing

- Avoid Friday submissions (reduced review capacity on weekends)
- Allow 24-48 hours for Apple review, 1-3 hours for Google
- For coordinated launches, submit iOS first (longer review)

---

## 5. Post-Release

### 5.1 First 24 Hours

- [ ] Monitor crash rate (target <0.1% of sessions)
- [ ] Monitor app store reviews for new issues
- [ ] Verify download counts are tracking
- [ ] Confirm alarm notifications working in production
- [ ] Confirm Pro purchases processing correctly

### 5.2 First Week

- [ ] Respond to critical bug reports within 24 hours
- [ ] Respond to 1-2 star reviews within 48 hours
- [ ] If crash rate exceeds 0.5%, initiate rollback (see Section 6)

### 5.3 Git Housekeeping

- [ ] Tag release: `git tag -a v1.0.0 -m "Release 1.0.0: MVP launch"`
- [ ] Push tag: `git push origin v1.0.0`
- [ ] Update CHANGELOG.md with actual release date
- [ ] Merge release branch to `main`
- [ ] Close milestone; create next milestone

---

## 6. Rollback Procedure

### 6.1 Google Play

1. **Halt staged rollout** in Play Console
2. **Revert**: promote the previous stable version to Production
3. **Communicate**: update release notes if users are affected

### 6.2 Apple App Store

1. **Pause phased release** in App Store Connect
2. **Remove from sale** (extreme: data-loss or security issues only)
3. **Submit previous version** for expedited review

### 6.3 Decision Matrix

| Severity | Crash Rate | Action |
|----------|-----------|--------|
| Low (cosmetic) | < 0.1% | Fix in next patch |
| Medium (functional) | 0.1-0.5% | Halt rollout, prepare hotfix |
| High (data loss) | Any | Immediate rollback + hotfix |
| Critical (security) | Any | Remove from sale + emergency fix |

---

## 7. Hotfix Process

### 7.1 Branch and Fix

```bash
git checkout -b hotfix/1.0.1 v1.0.0
# Apply minimal fix only, then:
git commit -m "fix: resolve crash in AR tracking on Android 10"
```

Update version in `package.json` (1.0.0 -> 1.0.1) and `Cargo.toml` if core affected.

### 7.2 Expedited Testing

- [ ] Fix verified on the affected platform and OS version
- [ ] Smoke tests pass (search, AR, alarms)
- [ ] No regressions in core functionality

### 7.3 Submission

- **Google Play**: Upload to Production with staged rollout (start at 10%)
- **App Store**: Submit and request expedited review

### 7.4 Post-Hotfix

- [ ] Merge hotfix branch to `main`
- [ ] Tag: `git tag -a v1.0.1 -m "Hotfix: AR crash on Android 10"`
- [ ] Update CHANGELOG.md
- [ ] Conduct post-mortem; add regression tests

---

## 8. Related Documents

- [Android Deployment](./android-deployment.md) -- Android build and Play Store submission
- [iOS Deployment](./ios-deployment.md) -- iOS build and App Store submission
- [Version Strategy](./version-strategy.md) -- versioning policy and planned releases
- [CONTRIBUTING.md](../../CONTRIBUTING.md) -- contribution guidelines and code review
- [Testing Strategy](../08-testing/overview.md) -- test coverage targets

---

**Last Updated**: February 2026
