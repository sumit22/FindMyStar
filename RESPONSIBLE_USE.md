# Responsible Use Statement

FindMyStar is an open-source astronomy app and computation library. It is licensed under the MIT License, which permits broad reuse. This document is a non-binding statement of intent from the maintainer about uses the project is — and is not — designed for. It does not modify the license terms.

The repository contains components that could plausibly be adapted to purposes beyond celestial-object finding: a real-time sensor-fusion and target-tracking pipeline, sub-degree angular guidance, atmospheric refraction modeling, and a high-precision coordinate-transform engine. These same primitives have legitimate uses in education, citizen science, and amateur astronomy, but they also have potential dual-use risk. The maintainer asks users and downstream developers to read this document before deploying derivatives.

---

## What FindMyStar Is Designed For

- Helping individuals locate celestial objects (stars, planets, the Moon, deep-sky objects) by hand-pointing a consumer smartphone.
- Receiving local-only notifications when celestial objects become observable from the user's location.
- Educational use, public outreach, amateur astronomy, citizen science.
- Reuse of the Rust computation engine (`core/`) in any context that needs validated celestial ephemeris or coordinate math — desktop tools, planetarium software, embedded devices, research scripts.

---

## What FindMyStar Is Not Designed For — and Should Not Be Used For

The following uses are **explicitly outside the intended scope** of this project. The maintainer does not endorse, support, or accept liability for them. Some are illegal in most jurisdictions.

### 1. Aiming Lasers, Projectiles, or Directed Energy at Any Object
FindMyStar's "follow-me arrow" and target-lock UX is designed to walk a human eye to a point in the sky. It must not be used to aim a laser pointer, optical weapon, projectile, or any directed device at any object — terrestrial, airborne, or celestial. Lasing aircraft is a federal offense in the United States (18 U.S.C. § 39A) and similarly illegal in most countries. The same applies to aiming devices at drones, satellites, vehicles, persons, or wildlife.

### 2. Weapons Targeting, Fire Control, or Military Application
The sensor-fusion, angular-error, and target-lock components are not intended for weapons systems, fire-control software, or any military targeting application. The Rust core has not been validated for, and is not designed to satisfy, the safety, reliability, or accuracy requirements of such systems. Adapting this code for those purposes is discouraged. Users must independently comply with any applicable export controls (e.g., U.S. EAR / ITAR) before redistribution into restricted contexts.

### 3. Safety-Critical Navigation
FindMyStar must not be relied upon for:
- Aviation, marine, or vehicular navigation
- Search-and-rescue operations
- Emergency response
- Any situation where an inaccurate rise/set time, altitude, or heading could endanger life or property

The app computes celestial positions for casual observation. It is not certified as a navigation aid and does not meet any aviation, maritime, or surveying accuracy standard.

### 4. Surveillance, Tracking of Persons, or Harassment
The location and sensor primitives in this codebase must not be adapted to track, surveil, or identify individuals without their informed consent. Forks that add network telemetry, third-party data sharing, or person-tracking features are outside the project's scope and should not be represented as related to FindMyStar.

### 5. Misrepresentation as Authoritative Astronomical Data
The app's catalog is sourced from public datasets (Hipparcos, Messier, VSOP87) and validated against USNO and JPL Horizons references. It is accurate enough for visual observation but should not be cited as an authoritative ephemeris source in scientific publication, navigation charts, or legal/regulatory contexts. For those uses, consult the primary sources directly.

---

## Disclaimer of Liability

Per the [LICENSE](LICENSE), the software is provided "AS IS", without warranty of any kind. In particular, and without limiting the LICENSE:

- The maintainer makes no representation about the suitability of this software for any purpose other than casual amateur astronomy.
- Computed rise/set times, positions, and visibility windows may contain errors arising from sensor noise, GPS drift, model truncation, or software bugs. Verify against independent sources before relying on outputs for any consequential decision.
- The maintainer is not liable for any use of derivative works, forks, or adaptations of this codebase, including uses that violate this Responsible Use Statement.

---

## Reporting Concerns

If you become aware of a use of FindMyStar (or a derivative) that violates this statement or applicable law, please open an issue tagged `responsible-use` or contact the maintainer directly. Security-sensitive concerns should follow the disclosure process in [docs/SECURITY.md](docs/SECURITY.md).

---

## For Downstream Developers

If you fork FindMyStar or reuse the Rust core in another product, the maintainer asks (but does not legally require) that you:

1. Retain this Responsible Use Statement in your distribution, or replace it with an equivalent statement appropriate to your use case.
2. Make a good-faith assessment of whether your intended use fits within the "designed for" scope above. If it does not, take additional engineering, legal, and ethical steps appropriate to your context.
3. Independently verify any safety, accuracy, or compliance properties you depend on. The validation in this repo is for amateur astronomy, not for downstream certified or safety-critical applications.

---

*This statement reflects the maintainer's intent at the time of publication. It does not create a contract, warranty, or restriction beyond what the MIT License provides. It can and should be updated as the project evolves.*
