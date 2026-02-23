# C4 Model - Context Diagram (Level 0)

Shows the system in the context of its users and external systems.

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌──────────────────┐         ┌──────────────────┐           │
│   │ Mobile User      │         │ Stargazer/       │           │
│   │ (Casual)         │         │ Astronomer       │           │
│   │                  │         │                  │           │
│   └────────┬─────────┘         └────────┬─────────┘           │
│            │                            │                      │
│            │                            │                      │
│            └────────────┬───────────────┘                      │
│                         │                                      │
│                    ┌────▼──────┐                              │
│                    │ FindMyStar │                              │
│                    │   Mobile   │                              │
│                    │    App     │                              │
│                    │            │                              │
│                    └────┬───────┘                              │
│                         │                                      │
│                         ▼                                      │
│                                                                 │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐     │
│   │ Device GPS   │   │ Device IMU   │   │ System Time  │     │
│   │ (Location)   │   │ (Heading)    │   │ (UTC)        │     │
│   └──────────────┘   └──────────────┘   └──────────────┘     │
│                                                                 │
│   ┌──────────────────────────────────────────────────────┐   │
│   │      OS Notification Service                         │   │
│   │      (Local alerts when objects rise)                │   │
│   └──────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

External Systems:
- Device sensors (read-only)
- OS notifications (write-only)
- App Store (distribution only)

NO external backend, API calls, or network dependencies.
```

**Key Characteristics**:
- ✅ Local only
- ✅ GPS-enabled location awareness
- ✅ Real-time device orientation
- ✅ System time for astronomical calculations
- ❌ No backend server
- ❌ No cloud storage
- ❌ No network required
