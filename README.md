# FindMyStar

**Precision offline celestial-object finder for mobile.**
AR-guided arrow that walks you to any star, planet, or deep-sky object. Smart visibility alerts. 100% offline. Rust-powered.

[![Rust Checks](https://github.com/sumit22/FindMyStar/actions/workflows/rust-checks.yml/badge.svg)](https://github.com/sumit22/FindMyStar/actions/workflows/rust-checks.yml)
[![TypeScript Checks](https://github.com/sumit22/FindMyStar/actions/workflows/typescript-checks.yml/badge.svg)](https://github.com/sumit22/FindMyStar/actions/workflows/typescript-checks.yml)
[![Mobile Build](https://github.com/sumit22/FindMyStar/actions/workflows/mobile-build.yml/badge.svg)](https://github.com/sumit22/FindMyStar/actions/workflows/mobile-build.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> Supports iOS 14+ and Android 10+. See the [CHANGELOG](CHANGELOG.md) for what's included.

---

## What it does

- **Find anything in the sky.** Search ~620 catalogued objects (Sun, Moon, planets, ~500 bright Hipparcos stars, all 110 Messier deep-sky objects). The AR screen overlays a directional arrow on a live camera feed and walks you to the target — sub-degree precision, lock-on confirmation, and a sky guide that orients you as you pan.
- **See what's up right now.** The search screen surfaces a "Visible Now" section computed from your location, backed by a pre-computed visibility cache so it's instant.
- **Know when to look.** Schedule rise-time alarms for any object. The app fires a local notification when it becomes observable from your exact location — recalculated in the background, no accounts, no servers.
- **Trust the math.** Positions computed in Rust against VSOP87 / Hipparcos / Messier data, with analytical and iterative rise/set solvers, atmospheric refraction, and a validation suite checked against USNO and JPL Horizons references.
- **Zero data collection.** No analytics, no telemetry, no network calls. Location never leaves the device. App Store privacy label: "Data Not Collected." See [docs/SECURITY.md](docs/SECURITY.md).

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

### Repository layout

| | |
|---|---|
| [core/](core/) | Rust engine — ephemeris, coordinate transforms, rise/set, FFI exports |
| [mobile/](mobile/) | React Native app — screens, services, state, native bridge |
| [db/](db/) | SQLite schema and seed catalogs (~620 objects) |
| [scripts/](scripts/) | Catalog build, release checklist, dev environment setup |
| [docs/](docs/) | Requirements, architecture, algorithms, testing methodology |

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

Full prerequisites and setup (Rust targets, NDK/Xcode, the optional entitlement signing key) in [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

---

## Contributing

Contributions are welcome — issues, discussions, and pull requests.

1. Read [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) for setup, workflow, and code style.
2. Run `scripts/setup-hooks.sh` once; pre-commit hooks enforce `cargo fmt`, Clippy, ESLint, Prettier, and `tsc`.
3. CI must pass: Rust checks, TypeScript checks, and mobile builds run on every PR.
4. Changes to the astronomy math must include validation tests against published references (USNO, JPL Horizons, Hipparcos).

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
