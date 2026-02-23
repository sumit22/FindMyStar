# ADR 0003: Offline-First with SQLite Only

## Status

**Accepted**

## Context

FindMyStar is positioned as a **precision offline celestial finder**. The core proposition includes:
1. **Privacy**: All data stays on device
2. **Reliability**: Works anywhere (no connectivity required)
3. **Performance**: No network latency
4. **Simplicity**: No backend infrastructure cost
5. **Scalability**: Solo developer can maintain indefinitely

## Problem

### Temptations We're Rejecting

1. **Firebase / Cloud Sync**
   - "Store observation history in cloud"
   - "Sync alarms across devices"
   - Introduces: Account management, privacy concerns, data centers

2. **Real-Time Satellite Data**
   - "Live ISS tracking needs fresh TLE data"
   - Introduces: Network dependency, update mechanism

3. **Community Features**
   - "Share sightings with friends"
   - "View friend's observation locations"
   - Introduces: Backend, auth, servers, legal liability

4. **Cloud Notifications**
   - "More reliable on iOS"
   - Introduces: Cloud service dependency, data processing

## Decision

**Zero backend.** All features work with local SQLite only.

### Data Stays Local

```
┌─────────────────┐
│  Mobile Device  │
│  ┌───────────┐  │
│  │ SQLite DB │  │───→ Local Notifications (OS)
│  └───────────┘  │
└─────────────────┘
     ⬆️ ⬇️
  Device Sensors
  (GPS, IMU, Time)

NO ☁️ Backend
NO 🔐 API Keys
NO 📡 Network Calls
```

### Architectural Constraint

**Every feature** must work offline. If it requires backend:
- ❌ Don't build it in MVP
- ✅ Move to Phase 2+

## Consequences

### Positive

✅ **Privacy by Design**
- Zero telemetry collected
- No user accounts
- No data shared with backend
- GDPR/CCPA irrelevant
- Users can trust us

✅ **Operational Simplicity**
```
No backend = no:
  - Server maintenance
  - Database backups
  - Scaling concerns
  - DDoS protection
  - SSL certificates
  - Uptime monitoring
```

✅ **Development Velocity**
- Solo developer sustainable
- No DevOps overhead
- Deploy = Submit to App Store
- No staging/production database sync

✅ **Cost Efficiency**
```
Backend cost: $0/month
Infrastructure cost: $0/month
Maintenance: ~5 hours/week (solo)
```

✅ **User Experience**
- Instant app responsiveness
- Works in airplane mode
- Works in remote locations
- No waiting for network

✅ **Monetization Simplicity**
```
Payment flow:
  User → App Store / Play Store → Us
No authentication servers needed
No subscription verification servers needed
```

### Negative

❌ **Feature Limitations**
- Can't add real-time satellite updates (Phase 2)
- Can't build community features
- Can't offer cloud backup / multi-device sync
- Can't enable observation sharing

❌ **Data Loss Risk**
- User deletes app → all tracked alarms gone
- If database corrupts → loss of alarm history
- No cloud backup fallback
- Education required: backup local DB

❌ **Single-Device Only**
- Set alarm on iPhone, goes off on iPad? No.
- Observation log on Android, view on Web? No.
- This is Phase 3+ scope anyway

❌ **Offline Satellite TLEs**
- ISS orbits decay (TLE validity ~5 days)
- Can't provide fresh data without network
- Trade-off: Accept outdated TLE or wait for Phase 2

## MVP Scope Boundary

### ✅ In Scope (Purely Local)

```
☀️ Sun Position → Precomputed formulas → No data needed
🌙 Moon Position → Formulas → No data needed
🪐 Planet Positions → VSOP87 coefficients (bundled) → No data needed
⭐ Star Positions → Hipparcos catalog (bundled) → No data needed
🌌 Messier Objects → Static catalog (bundled) → No data needed
⏰ Rise/Set Times → Computed locally → No data needed
🔔 Alarms → Stored in SQLite → Scheduled locally
📍 Location → From device GPS → No sharing
```

### ❌ Out of Scope (Need Phase 2+)

```
🛰️ ISS Tracking → Needs live TLE data
💬 Share Sightings → Needs backend + auth
📊 Observation History Cloud Sync → Needs backend
👥 Social Features → Needs server infrastructure
☁️ Cloud Backup → Needs S3 or equivalent
```

## Data Integrity & Backup

### Corruption Detection

```rust
// On app startup
if !db.integrity_check() {
    restore_from_bundled_backup();
}
```

### User Backup Strategy

We offer **export functionality** (Phase 2):
```typescript
export function exportTrackedObjects(): string {
    const objects = db.all("SELECT * FROM tracked_objects");
    return JSON.stringify(objects);  // User can save locally
}
```

But: **No cloud sync** in MVP

## Authentication & Privacy

**We don't store anything about users:**
- No email
- No username
- No analytics
- No crash reporting (local only)

**Result**: Zero privacy concerns

```
GDPR Compliance: ✅ Not applicable (no user data)
CCPA Compliance: ✅ Not applicable (no personal data)
COPPA Compliance: ✅ Not applicable (no children targeted)
```

## Future Escape Hatches

### If We Change My Mind

**Option 1: Add Optional Sync (Phase 3)**
```
User can opt-in to cloud backup
Store encrypted JSON on user's own S3 bucket
No untrusted backend
User controls data
```

**Option 2: Extend for Pro Tier**
```
Free: Fully offline (current)
Pro Paid: Optional cloud features
Backend cost → Pro subscriber only
```

### Why Escape Hatches Hurt

Adding backend later:
- ❌ Loses privacy positioning
- ❌ Introduces complexity
- ❌ Adds maintenance burden
- ❌ Requires auth system

**Better design**: Be offline-first forever

## Alternatives Considered

### Alternative 1: Optional Backend

```
if (user_wants_cloud_sync) {
    backend.sync_alarms()
}

❌ Rejected
Still requires server maintenance
Mixed complexity (offline + online)
Privacy concerns remain
```

### Alternative 2: Peer-to-Peer Sync

```
User A ↔️ Bluetooth ↔️ User B
Share observations locally

⚠️ Deferred to Phase 3
Adds complexity without MVP value
```

### Alternative 3: Service Provider Model

```
User pays → We handle backend
"Managed service" SaaS

❌ Rejected
Contradicts offline-first philosophy
Users lose control of data
Not scalable for solo developer
```

## Implementation Guidelines

### Every New Feature

Ask: **"Does this work offline?"**

| Feature | Offline? | Decision |
|---------|----------|----------|
| Search objects | ✅ | Include |
| AR guidance | ✅ | Include |
| Rise/set times | ✅ | Include |
| Alarms | ✅ | Include |
| Satellite tracking | ❌ | Phase 2 |
| Share sightings | ❌ | Phase 3 |
| Cloud backup | ❌ | Phase 3 |

## References

- [Privacy by Design](https://www.ncsc.gov.uk/guidance/privacy-design-guide)
- [Offline-First Apps](https://offlinefirst.org/)
- [Resilient Web Design](https://resilientwebdesign.com/)
- [SQLite as Application File Format](https://www.sqlite.org/appfileformat.html)

---

**Status**: Accepted  
**Related ADRs**: None (foundational decision)
