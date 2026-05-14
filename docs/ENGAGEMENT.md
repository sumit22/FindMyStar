# FindMyStar — Engagement & Sponsored Development

**Precision Celestial Finder for Mobile**
*A working open-source project, available for sponsored development.*

---

## What This Is

FindMyStar is an offline, AR-guided mobile app for locating celestial objects and scheduling visibility alerts. It is built on a Rust computation engine validated against NASA/JPL ephemeris data, with a React Native UI on top.

The repository is fully open source. The codebase is production-quality (60+ design docs, ~185 tests, layered architecture, CI/CD pipelines). It is currently in MVP — iOS 14+ / Android 10+, targeting public launch in Q2 2026.

If you want a feature on the roadmap delivered sooner, or need a customized fork for a specific use case, I'm available for sponsored work.

---

## Roadmap & Sponsorship Tracks

The project ships in phases. Each phase is a coherent unit of work that can be funded independently to accelerate delivery.

| Phase | Default Timeline | Scope |
|-------|------------------|-------|
| **Phase 1 — MVP** | Q2 2026 | AR guidance, visibility alarms, 620+ object catalog, offline operation |
| **Phase 2 — Dynamic Sky** | Q3 2026 | Satellite tracking (ISS / Starlink passes), comet predictions, meteor shower alerts, observation logging |
| **Phase 3 — Instrument Tier** | Q4 2026 | Telescope integration (digital setting circles), astrophotography planning, optional encrypted cloud sync |

**Sponsorship accelerates a phase.** Funded tracks ship in weeks instead of quarters, with the sponsor's priorities weighted in the feature design.

---

## Engagement Models

### 1. Sponsored Feature
Fund a specific feature from the roadmap (e.g., "satellite passes for Starlink") or propose a new one. The feature ships in the public app under the project's open-source license; you get priority on scope, naming credit if desired, and direct input on the implementation.

### 2. Custom Fork / White-Label
A private fork tailored to your use case: rebranded UI, additional object catalogs (asteroids, exoplanets, observatory targets), domain-specific computations, integration with your hardware (telescope mounts, planetarium dome controllers). Source delivered under a separate commercial license.

### 3. Contract Engineering
Time-boxed engagements on the same tech stack: Rust computation engines, offline-first mobile apps, sensor fusion, astronomical or geospatial math, FFI between Rust and React Native / Kotlin / Swift.

### 4. Technical Advisory
For teams building adjacent products (planetarium hardware, telescope control software, education platforms): code review, architecture consultation, ephemeris/coordinate-math review.

---

## Why This Project Is a Credible Foundation

Concrete signals of quality, in case you're evaluating whether to invest time talking:

- **Validated math.** The Rust core is tested against ~4,800 reference cases across 10 global locations and 48 dates, with positions cross-checked against the USNO Astronomical Almanac and JPL Horizons. Star positions ±0.5°, planets ±1.0°, rise/set times ±2 minutes.
- **Real performance budget.** AR loop runs at 60+ FPS on commodity Android hardware; position computation <2 ms; rise/set for a star <10 ms; catalog search <5 ms. All measured, not estimated.
- **Layered architecture.** Domain logic (Rust) has zero I/O — it's a pure math library, reusable in any context (CLI, server, desktop, embedded). The mobile app is a thin presentation layer over it.
- **Operational rigor.** GitHub Actions CI/CD with rust-checks, typescript-checks, scheduled audits, and a release pipeline producing signed AABs and iOS archives. Pre-commit hooks for formatting, linting, type-checking.
- **Documentation.** Full SRS, ADRs, sequence diagrams, validation reports, performance benchmarks. Walk-in cost for a new contributor (or your team's reviewer) is hours, not weeks.

The full technical brief lives in [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) for deeper review.

---

## Working Together — What to Expect

- **Discovery call (free, ~30 min).** Scope, constraints, and whether it's a fit.
- **Written proposal.** Deliverables, milestones, fixed-fee or time-and-materials, IP terms.
- **Iterative delivery.** Public commits on a sponsor-tagged branch (or private fork for white-label), reviewed weekly.
- **Handoff.** Documentation, test coverage, and CI parity with the rest of the project. No black-box code.

I work as a solo engineer with deep ownership of the stack — Rust, TypeScript, Kotlin, Swift, mobile build systems, astronomical algorithms. For multi-engineer scopes, I can scale through a trusted network.

---

## Get in Touch

- **Email:** _add your contact email_
- **GitHub:** _add link to your profile_
- **Project repo:** _add link once published_

Open an issue tagged `engagement` or `sponsorship` and I'll respond within 48 hours.

---

*FindMyStar is built and maintained by an independent engineer. Sponsorship and contract income directly funds continued open-source development of the project.*
