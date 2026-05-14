# FindMyStar

**Precision offline celestial-object finder for mobile.**
AR-guided arrow that walks you to any star, planet, or deep-sky object. Smart visibility alerts. 100% offline. Rust-powered.

> Status: MVP, targeting Q2 2026 launch on iOS 14+ and Android 10+.

---

## What it does

- **Find anything in the sky.** Search 620+ catalogued objects (Sun, Moon, planets, bright stars, Messier deep-sky). The app shows a directional arrow on a live camera feed and walks you to it — sub-degree precision, target-lock confirmation.
- **Know when to look.** Schedule rise-time alarms for any object. The app pushes a local notification when it becomes observable from your exact location. No accounts, no servers.
- **Trust the math.** Positions computed in Rust against VSOP87 / Hipparcos / Messier data, validated against USNO and JPL Horizons references.
- **Zero data collection.** No analytics, no telemetry, no network calls. App Store privacy label: "Data Not Collected." See [docs/SECURITY.md](docs/SECURITY.md).

---

## Architecture

```
React Native + TypeScript  ──┐
                              ├──  FFI (JNI / static lib)
Rust core (ephemeris, math) ──┘
                              ↓
                          SQLite (catalog, cache, alarms)
```

Four-layer architecture, dependencies point downward only. Full breakdown in [docs/03-architecture/](docs/03-architecture/).

---

## Build

```bash
# Rust core
cd core
cargo test
cargo build --release

# Mobile app
cd ../mobile
npm install
npm run android        # or npm run ios
```

Full prerequisites and setup (including the optional entitlement signing key) in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

---

## Documentation

| | |
|---|---|
| [docs/README.md](docs/README.md) | Documentation index |
| [docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md) | Full technical brief |
| [docs/03-architecture/](docs/03-architecture/) | System design, C4 diagrams, ADRs |
| [docs/04-domain-engine/](docs/04-domain-engine/) | Rust engine internals, ephemeris algorithms |
| [docs/08-testing/](docs/08-testing/) | Validation methodology, error bounds |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model and security posture |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Setup, workflow, code style |

---

## Responsible Use

The sensor-fusion, target-lock, and angular-guidance components in this project have potential dual-use risks beyond casual astronomy. Before using or forking the code, please read **[RESPONSIBLE_USE.md](RESPONSIBLE_USE.md)**.

In short: this project is built for finding stars by eye. It is **not** designed for aiming lasers or projectiles at any object, for weapons targeting, for safety-critical navigation (aviation, marine, emergency), or for tracking people. The maintainer asks downstream developers to apply the same restraint and propagate the statement.

---

## Sponsored Development & Engagement

FindMyStar is built and maintained by an independent engineer. If you want a roadmap feature delivered sooner, need a custom fork for your use case (telescope hardware, planetarium hardware, education platforms), or want to engage on contract work, see **[docs/ENGAGEMENT.md](docs/ENGAGEMENT.md)**.

---

## License

[MIT](LICENSE). See also [RESPONSIBLE_USE.md](RESPONSIBLE_USE.md) for the maintainer's (non-binding) statement on acceptable use.
