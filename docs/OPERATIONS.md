# Operational Runbooks

## 1. Overview

FindMyStar is a fully offline mobile application with no backend infrastructure. There are no servers to monitor, no databases to back up, and no APIs to keep running. "Operations" in this context means:

- **App quality monitoring**: crash rates, user reviews, rating trends
- **User support**: responding to bug reports and questions
- **Release management**: shipping updates, hotfixes, and incident response
- **Troubleshooting**: diagnosing reported issues and determining root causes

---

## 2. Monitoring

### 2.1 Crash Rate

**Target**: <0.1% crash rate (>99.9% crash-free sessions)

| Platform | Monitoring Tool | Dashboard |
|----------|----------------|-----------|
| Android | Google Play Console > Android Vitals | Crash rate, ANR rate, by device/OS |
| iOS | App Store Connect > Crashes | Crash logs, OS version, device model |
| iOS | Xcode Organizer | Symbolicated crash reports |

**Action thresholds**:

| Crash Rate | Action |
|-----------|--------|
| <0.1% | Normal operation. No action required. |
| 0.1% - 0.5% | Investigate top crash. Prioritize fix for next patch release. |
| 0.5% - 1.0% | Halt staged rollout (if active). Investigate immediately. |
| >1.0% | **P0 incident**. Halt rollout. Hotfix within 24 hours. See Section 5. |

### 2.2 App Store Rating

**Target**: 4.5+ stars (both platforms). Monitor overall rating weekly. If rating drops below 4.0, prioritize user-facing bug fixes. Respond to negative reviews within 48 hours.

### 2.3 User Review Categorization

| Category | Example | Action |
|----------|---------|--------|
| **Bug report** | "App crashes when I search for Mars" | File GitHub Issue, prioritize fix |
| **Feature request** | "Can you add satellite tracking?" | Note in backlog, respond with roadmap info |
| **Praise** | "Love this app, works great offline!" | Thank the user |
| **Confusion** | "Why does the arrow point the wrong way?" | Respond with calibration guidance; update FAQ |
| **Accuracy complaint** | "Rise time was off by 10 minutes" | Investigate; compare against USNO data |

---

## 3. Troubleshooting Guide

### 3.1 Issue: High Crash Rate

**Symptoms**: crash rate exceeds 0.5% in Play Console / App Store Connect.

**Diagnosis**:

1. Identify the top crash signature from crash reporting dashboard
2. Classify the crash type:

| Crash Type | Likely Cause | Investigation |
|-----------|-------------|---------------|
| `NullPointerException` / `EXC_BAD_ACCESS` | Null reference in JS or native code | Review null checks in recent changes |
| `OutOfMemoryError` | Memory leak or excessive allocation | Profile with Instruments / Android Profiler |
| `SIGABRT` / Rust panic | Domain engine assertion failure | Check FFI boundary; review `catch_unwind` |
| `ANR` (Android) | Main thread blocked | Check for synchronous FFI calls on UI thread |
| React Native red screen | Unhandled JS exception | Check error boundary; review recent JS changes |

3. If Rust crash: review input validation at FFI boundary; run `cargo test` with failing input
4. If JS crash: check React Native error boundary; test on affected device/OS version

**Resolution**: ship as hotfix if crash rate >1%. See Section 5.

### 3.2 Issue: Accuracy Degradation Reports

**Symptoms**: users report "arrow points the wrong way" or "rise time was way off."

**Diagnosis**:

1. **Device-specific** (single user): likely magnetometer interference or uncalibrated device
   - Ask: "Are you near metal objects or electronics?"
   - Recommend: figure-8 calibration motion, move outdoors
2. **Systematic** (multiple users): possible algorithm regression
   - Compare computed positions against USNO / JPL Horizons
   - Run validation suite: `cargo test --test validation_tests`
   - Check recent commits for changes to ephemeris or coordinate code
   - If regression confirmed: revert and ship hotfix

### 3.3 Issue: Battery Drain Complaints

**Symptoms**: users report excessive battery consumption.

**Expected consumption** (see [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md)): AR mode ~8%/hr, info screen ~3%/hr, background <0.5%/hr.

**Common causes**:

| Cause | Fix |
|-------|-----|
| GPS polling too frequent | Verify 1-minute interval in LocationService |
| Sensors not stopped on background | Check app lifecycle handlers (AppState listener) |
| Camera not released on AR exit | Verify camera cleanup in AR screen unmount |
| Excessive logging in release build | Ensure debug logging stripped in production |

### 3.4 Issue: GPS Not Available

The app should handle all GPS states gracefully:

- Permission granted + fix available: normal operation
- Permission granted + no fix: use last known location + warning
- Permission granted + no last known: prompt manual location entry
- Permission denied: prompt permission request + manual entry fallback

### 3.5 Issue: Notifications Not Firing

**Android**: check notification permission, battery optimization exceptions (add FindMyStar to "Don't optimize"), WorkManager constraints, Do Not Disturb mode.

**iOS**: check notification permission, background app refresh, BGTaskScheduler registration, Focus mode settings.

**Both**: verify `alarm_enabled = 1` in tracked_objects table, check `next_visible_at` is populated and in the future, confirm midnight recalculation task is running.

---

## 4. Database Maintenance

### 4.1 Corruption Detection

`PRAGMA integrity_check` runs on every app launch. If it fails:

1. Attempt table-level integrity checks
2. Restore catalog from bundled backup if `objects` table is corrupt
3. Attempt row-level recovery for `tracked_objects`; inform user of potential data loss
4. Reset `user_preferences` to defaults if corrupt

### 4.2 Compaction

The app runs `VACUUM` when database file size exceeds 2x expected baseline (~200KB). At most once per month, during midnight background task. Impact: <1 second I/O spike, no user-visible effect.

---

## 5. Release Incident Response

### 5.1 Severity Classification

| Severity | Definition | Example | Response Time |
|----------|-----------|---------|---------------|
| **P0** | Crash rate >1% or data loss | App crashes on startup for Android 14 | Halt rollout; hotfix within 24h |
| **P1** | Functional bug affecting core feature | Rise/set calculation off by >30 min | Fix in next patch (1 week) |
| **P2** | Cosmetic or minor UX issue | Arrow color wrong in dark mode | Next minor release |
| **P3** | Enhancement or minor improvement | "Add sort by magnitude" | Prioritize in backlog |

### 5.2 P0 Incident Procedure

1. **Detect**: crash rate alert from Play Console / App Store Connect
2. **Halt**: stop staged rollout immediately
3. **Triage**: identify root cause from crash logs (see Section 3.1)
4. **Fix**: develop and test on affected device/OS combinations
5. **Ship**: submit hotfix with expedited review request
6. **Monitor**: track crash rate for 48 hours post-release
7. **Postmortem**: document root cause, impact, and prevention measures

### 5.3 Staged Rollout

| Day | Android | Action |
|-----|---------|--------|
| 1 | 5% | Monitor crash rate |
| 2 | 20% | Check reviews and vitals |
| 3 | 50% | Expand if stable |
| 5 | 100% | Full rollout |

iOS does not support staged rollout; releases go to all users immediately.

---

## 6. User Support

### 6.1 Support Channels

| Channel | Response Time | Use For |
|---------|--------------|---------|
| GitHub Issues | 48 hours | Bug reports, feature requests |
| GitHub Discussions | 1 week | Questions, community help |
| App Store Reviews | 1 week | User feedback |

### 6.2 Common Support Responses

**"Arrow isn't accurate"**: recommend figure-8 calibration, move away from metal. See [FAQ.md](./FAQ.md).

**"Object not visible"**: explain that some objects are below the horizon from the user's latitude. Suggest setting an alarm for when it rises.

**"Not getting notifications"**: guide through battery optimization exceptions (Android) or background app refresh (iOS). See [FAQ.md](./FAQ.md).

**"Too much battery drain"**: ~8%/hr in AR mode is expected. Recommend exiting AR when not tracking, reducing brightness.

---

## 7. Escalation Path

| Level | Handler | Scope |
|-------|---------|-------|
| **Level 1** | Community (GitHub Discussions) | General usage questions, known issues |
| **Level 2** | Developer investigation | Bug confirmation, reproduction, triage |
| **Level 3** | Algorithm review | Accuracy issues requiring domain expertise |

Escalation criteria: L1 to L2 when issue is confirmed as bug; L2 to L3 when issue involves mathematical correctness.

---

## 8. Routine Operational Tasks

### 8.1 Weekly

- Review crash rate in Play Console / App Store Connect
- Review and respond to negative reviews
- Triage new GitHub Issues

### 8.2 Monthly

- Run `cargo update` and `npm update`; run audits
- Review benchmark CI results for regressions
- Track 30-day rating average

### 8.3 Quarterly

- Full security audit (`cargo audit`, `npm audit`, dependency review)
- Performance profiling on reference devices
- Accuracy validation against current USNO/JPL data
- Documentation review

---

## 9. Cross-References

| Document | Relationship |
|----------|-------------|
| [SECURITY.md](./SECURITY.md) | Incident response, vulnerability reporting |
| [PERFORMANCE_OPTIMIZATION.md](./PERFORMANCE_OPTIMIZATION.md) | Battery drain investigation, performance budgets |
| [FAQ.md](./FAQ.md) | Common user questions and support responses |
| [Non-Functional Requirements](./02-requirements/non-functional-requirements.md) | NFR-7 (crash rate), NFR-4 (battery) |
| [Release Checklist](./10-deployment/release-checklist.md) | Pre-release verification steps |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Development workflow for fixes |
| [Database Schema](./05-data-model/schema.md) | SQLite structure for maintenance |

---

**Last Updated**: February 2026
