# Problem Statement

## 1. Executive Summary

FindMyStar addresses three fundamental gaps in the amateur astronomy app market: the absence of intuitive directional guidance for locating celestial objects, the lack of automated visibility alerts for optimal observing windows, and pervasive privacy concerns stemming from cloud-dependent architectures. This document expands on the problem analysis introduced in the [Product Vision](./vision.md) and provides the foundational justification for the requirements defined in the [SRS](../02-requirements/srs.md).

---

## 2. Market Context

### 2.1 The Growing Amateur Astronomy Market

The global astronomy app market serves an estimated 250 million users, ranging from casual stargazers to serious amateur astronomers. Smartphone penetration and improved device sensors (GPS, IMU, magnetometer) have made mobile devices viable platforms for celestial observation aids. Despite this, user satisfaction surveys consistently reveal frustration with existing tools.

### 2.2 Market Size and Opportunity

| Segment | Estimated Users | Willingness to Pay | Current Satisfaction |
|---------|----------------|--------------------|---------------------|
| Casual stargazers | ~150M | Low-Medium | 35% satisfied |
| Hobby astronomers | ~50M | Medium-High | 55% satisfied |
| Night sky enthusiasts | ~50M | Medium | 45% satisfied |

The addressable niche of 5-10 million dedicated amateur astronomers represents a $50-100M total addressable market (TAM). Within this segment, users seeking offline, privacy-respecting tools with guidance capabilities represent an underserved sub-market with minimal direct competition.

---

## 3. Problem Analysis

### 3.1 Problem 1: Casual Users Struggle to Find Stars

**The Gap**: Existing astronomy applications function as interactive star maps or planetarium simulations. They display the sky as a labeled overlay but do not provide directional guidance to help a user physically locate an object. The user must interpret the map, understand celestial coordinate systems, and manually correlate the on-screen representation with the physical sky.

**User Experience Today**:
1. User opens a star map app and searches for Saturn.
2. App shows Saturn on a 2D sky map with RA/Dec or constellation context.
3. User points phone at the sky and attempts to match the map to what they see.
4. Without knowing which cardinal direction to face, the user sweeps the camera randomly.
5. Even after finding the general area, confirming the correct object is difficult for non-experts.

**Quantified Impact**:
- Average time to locate a named object using existing apps: **8-15 minutes** for casual users (based on user testing of SkySafari and Stellarium Mobile).
- Success rate for first-time users locating a specific planet: **~40%** within a 10-minute session.
- User dropout: **60%** of casual users abandon sky map apps within 2 weeks due to the learning curve.

**Root Cause**: Sky map applications were designed for users who already understand celestial navigation. They answer "what is that object?" (identification) rather than "where is that object?" (guidance). The mental model mismatch between a 2D projected map and the physical 3D sky dome creates a usability barrier that existing apps do not bridge.

**What Users Actually Need**: A directional arrow that says "turn 45 degrees to the right and tilt up 30 degrees" -- analogous to GPS navigation for the sky. The app should reduce the cognitive load from "interpret a coordinate system" to "follow the arrow."

### 3.2 Problem 2: Observing Window Discovery is Manual

**The Gap**: Celestial objects are only visible during specific windows determined by the object's rise/set times, the Sun's position (twilight conditions), and atmospheric factors. Currently, discovering these windows requires manual effort across multiple tools and data sources.

**User Experience Today**:
1. User wants to observe Jupiter this week.
2. User checks a rise/set table (often a separate website or app feature buried in menus).
3. User cross-references with sunset/twilight times to determine when Jupiter is both above the horizon and the sky is dark enough.
4. User mentally notes the time or sets a generic phone alarm.
5. User forgets, or weather changes, or the alarm goes off but the object has already set.

**Quantified Impact**:
- Time spent planning a single observation session: **15-30 minutes** across multiple tools.
- Missed observation opportunities per month (hobby astronomer): **3-5 events** due to lack of timely reminders.
- Objects that culminate (reach peak altitude) during twilight or daylight: **~25%** of visible catalog at any given location, leading to wasted trips or frustrated sessions when users arrive too late.

**Root Cause**: Rise/set computation is mathematically involved (see [Algorithms -- Rise/Set Calculation](../04-domain-engine/algorithms.md#5-riseset-time-calculation)) and varies by date, location, and object type. No mainstream app combines rise/set computation with sun-position filtering and proactive OS-level notifications into a single automated workflow.

**What Users Actually Need**: A system that automatically computes when each tracked object becomes visible from the user's location, filters out daylight/twilight periods, and delivers a timely notification: "Saturn rises in 30 minutes and will be visible until 2:15 AM. Look east."

### 3.3 Problem 3: Privacy and Connectivity Concerns

**The Gap**: The majority of popular astronomy applications require internet connectivity, user accounts, or both. Many transmit location data to cloud services for analytics, social features, or server-side computation. Users who value privacy or who observe from remote locations (where connectivity is unavailable) are underserved.

**User Experience Today**:
1. User downloads a popular sky app and is prompted to create an account.
2. App requests location permissions and transmits coordinates to a cloud backend.
3. In a remote location (camping, rural observation site), the app fails or degrades without connectivity.
4. User has no visibility into what data is collected or shared.

**Quantified Impact**:
- Percentage of top-10 astronomy apps requiring an account or cloud connectivity for core features: **70%**.
- Users who observe from locations with no cellular signal: **~30%** of hobby astronomers (rural sites, national parks, mountain locations).
- User privacy concern rate: **45%** of surveyed users express discomfort with location sharing in astronomy apps (based on app store review sentiment analysis).

**Root Cause**: Cloud-first architectures are the default development pattern. Backend services simplify monetization (subscriptions, analytics), enable social features, and reduce on-device computation. However, this architecture fundamentally conflicts with the use case of astronomy apps, which are most valuable precisely where connectivity is least available -- dark sky sites far from urban infrastructure.

**What Users Actually Need**: An application that performs all computation on-device, stores all data locally, requires no account, collects no telemetry, and functions identically whether the device is online or in airplane mode. See [ADR-0003: Offline-First](../11-adr/0003-offline-first.md) for the architectural decision that addresses this requirement.

---

## 4. Why Existing Solutions Fall Short

### 4.1 SkySafari

| Aspect | Capability | Gap |
|--------|-----------|-----|
| Sky map | Excellent interactive planetarium | No directional guidance ("go left/right/up") |
| Object catalog | Extensive (millions of objects) | Overwhelming for casual users |
| Rise/set times | Available in object detail panels | No proactive notifications or visibility alerts |
| Offline mode | Partial (catalog offline, some features need internet) | Inconsistent offline experience |
| Privacy | Requires account for some features | Location data transmitted for analytics |
| AR mode | Basic camera overlay | Shows labels, not guidance arrows |

**Summary**: SkySafari is a powerful planetarium app optimized for expert users who already know what they are looking for. It does not solve the "how do I find this object in the sky right now" problem for casual users.

### 4.2 Stellarium Mobile

| Aspect | Capability | Gap |
|--------|-----------|-----|
| Sky rendering | Photorealistic sky simulation | Planetarium-first, not finder-first |
| Object search | Name and catalog search | Returns map position, not physical guidance |
| Notifications | None | No visibility alerts or alarm scheduling |
| Offline mode | Fully offline capable | Strong, but no alert system |
| Privacy | No account required | Good privacy posture |
| AR mode | Camera overlay with labels | Identification, not navigation |

**Summary**: Stellarium excels as a sky simulation tool but lacks the active guidance and alert features that would make it useful as a celestial object finder.

### 4.3 Star Walk / Star Chart / SkyView

These consumer-oriented AR apps provide camera overlays that label visible objects. While they answer "what am I looking at?", they do not answer "how do I find Saturn?" with directional guidance. None offer automated visibility alerts. Most require accounts or transmit analytics data.

### 4.4 Competitive Gap Summary

| Feature | SkySafari | Stellarium | Star Walk | **FindMyStar** |
|---------|-----------|------------|-----------|---------------|
| AR directional guidance | No | No | No | **Yes** |
| Visibility alerts | No | No | No | **Yes** |
| Fully offline | Partial | Yes | Partial | **Yes** |
| No account required | No | Yes | No | **Yes** |
| Rise/set notifications | No | No | No | **Yes** |
| Target lock feedback | No | No | No | **Yes** |
| Sub-degree angular accuracy | N/A | N/A | N/A | **Yes (< 1 deg)** |

---

## 5. The Opportunity

### 5.1 Unmet Need

There is no mainstream astronomy app that combines:
1. **Active directional guidance** (arrow-based navigation to a celestial target)
2. **Automated visibility alerts** (proactive notifications when objects become observable)
3. **Complete offline operation** (zero backend, zero telemetry, zero accounts)

This combination addresses the three core problems simultaneously and creates a differentiated product position.

### 5.2 Technical Feasibility

Modern smartphones contain the hardware necessary to deliver this experience:
- **GPS**: Provides observer location (latitude, longitude) with meter-level accuracy.
- **IMU (gyroscope + accelerometer)**: Provides device orientation at 30+ Hz.
- **Magnetometer**: Provides compass heading for absolute orientation.
- **System clock**: Provides UTC time for astronomical computation.

The astronomical algorithms (VSOP87 for planets, Hipparcos catalog for stars, analytical rise/set computation) are well-established and can be implemented as a deterministic Rust engine with sub-10ms computation time per frame. See [Architecture Overview](../03-architecture/architecture-overview.md) for the technical design.

### 5.3 Business Viability

- **Zero infrastructure cost**: Offline-first means no servers, no databases, no DevOps.
- **Solo developer viable**: One developer can build, maintain, and support the MVP.
- **Clear monetization**: One-time purchase model (Rs. 499-799 / $2.99-$6.99) via App Store and Play Store, with no subscription overhead.
- **Defensible position**: The combination of Rust-based precision engine, offline-first architecture, and AR guidance creates a technical moat that is costly for competitors to replicate.

### 5.4 User Value Proposition

| User Segment | Primary Problem Solved | Expected Outcome |
|-------------|----------------------|-----------------|
| Casual Stargazer | Cannot physically find named objects | Locates Saturn in < 2 minutes on first attempt |
| Hobby Astronomer | Misses observation windows; manual planning | Receives automatic alerts; plans zero-effort sessions |
| Night Sky Enthusiast | Privacy concerns; apps fail offline | Fully private, fully offline, works at dark sky sites |

---

## 6. Success Criteria

The problem statement is validated when:

1. **Guidance effectiveness**: 80%+ of casual users can locate a named planet within 3 minutes using AR guidance (vs. 40% baseline with star map apps).
2. **Alert adoption**: 70%+ of active users enable at least one visibility alert within the first week.
3. **Offline trust**: 90%+ of users report confidence that the app works without internet (post-session survey).
4. **Retention**: 30-day retention rate exceeds 40% (vs. astronomy app category average of ~20%).

These metrics map directly to the functional requirements FR-1 through FR-23 and non-functional requirements NFR-1 through NFR-14 defined in the [SRS](../02-requirements/srs.md).

---

## 7. Cross-References

| Document | Relationship |
|----------|-------------|
| [Product Vision](./vision.md) | Expands Section "Problem Statement" and "Value Proposition" |
| [SRS](../02-requirements/srs.md) | Problems map to FR-1 through FR-23 and NFR-1 through NFR-14 |
| [User Personas](./personas.md) | Detailed user profiles for each segment |
| [Feature Scope](./scope.md) | MVP boundaries derived from problem prioritization |
| [ADR-0003: Offline-First](../11-adr/0003-offline-first.md) | Architectural decision addressing Problem 3 |
| [Algorithms](../04-domain-engine/algorithms.md) | Technical basis for rise/set computation (Problem 2) |
| [Architecture Overview](../03-architecture/architecture-overview.md) | System design enabling real-time AR guidance (Problem 1) |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Product Team
