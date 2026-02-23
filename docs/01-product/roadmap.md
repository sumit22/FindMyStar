# Product Roadmap

## Timeline Overview

```
Phase 1 (MVP)        Phase 2              Phase 3              Future
├─ 3 months          ├─ 3 months          ├─ 3 months           Expansion
│                    │                    │                     &
├─ Core              ├─ Enhancements      ├─ Advanced           Specialization
├─ AR Guidance       ├─ More Objects      ├─ Telescope          
├─ Alarms            ├─ Satellites        ├─ Astrophotography   
├─ Offline           ├─ Analytics         ├─ History/Cloud      
└─ Local Storage     └─ Polish            └─ Community
```

---

## Phase 1: MVP (3 months)

### Core Astronomy
- **Sun, Moon, Planets** (8)
- **Bright Stars** (100-500 Hipparcos)
- **Messier Objects** (~110)
- **Rise/Set Calculation** for stars & planets
- **Circumpolar Detection**

### User Features
- **Object Search** by name
- **Real-Time AR Guidance** with arrow
- **Target Lock** indicator (< 0.5°)
- **Visibility Status** (visible now / not visible / rise at TIME)
- **Smart Alarms** for rise/set

### Technical
- **Rust Domain Engine** (complete)
- **React Native App** (Android + iOS)
- **SQLite Database** (local only)
- **Device Orientation Fusion** (IMU)
- **OS Notifications** (local)

### Target Release
**Q2 2026** (June)

---

## Phase 2: Growth & Satellite Tracking (3 months)

### Astronomy Additions
- **Satellite Tracking** (ISS, Starlink, etc.)
- **TLE-based Orbital Computation**
- **Comet Predictions**
- **Meteor Shower Alerts**
- **Variable Star Magnitude Changes**

### User Features
- **Pass Predictions** (when will ISS be visible)
- **Brightness Alerts** (when object reaches peak)
- **Observation Logging** (local history)
- **Advanced Calibration** (manual alignment mode)
- **Altitude Threshold Customization**

### Analytics & Polish
- **App Usage Analytics** (local, hashed)
- **Crash Reporting** (local logging)
- **UI Polish** based on user feedback
- **Dark Mode** refinement
- **Accessibility** improvements

### Technical
- **Background Task Updates** for TLE data
- **Advanced Caching** for orbit predictions
- **Performance Optimization** (60 FPS baseline)
- **Unit Test Coverage** >90%

### Target Release
**Q3 2026** (September)

---

## Phase 3: Advanced & Ecosystem (3 months)

### Telescope Integration (Opt-in for now)
- **Digital Setting Circles** (manual telescope guidance)
- **Alignment Solver** (2-star / 3-star calibration)
- **Field of View Preview** (what telescope sees)
- **Polar Alignment Assistant**

### Astrophotography Tools
- **Exposure Time Recommendations**
- **Optimal Altitude Alerts**
- **Meridian Flip Prediction**
- **Light Pollution Awareness**

### Cloud Sync (Optional Premium)
- **Observation History Cloud Backup**
- **Multi-Device Sync** (if user opts in)
- **Shareable Observation Links** (privacy controlled)

### Community (Light Integration)
- **Public Sighting Map** (anonymous, aggregated)
- **Trending Objects** (what's visible tonight)
- **Simple Social Sharing** (external, not in-app)

### Technical
- **Optional Backend** (Firebase) for paid features
- **Plate Solving Integration** (on-device)
- **Export/Import Functionality**
- **Extensible Plugin System**

### Target Release
**Q4 2026** (December)

---

## Long-Term Vision (2027+)

### Research & Academic
- **Published Astronomical Library** (Rust crate)
- **API for Educational Institutions**
- **Research Partnerships** (universities)
- **Academic Papers** on accuracy validation

### Platform Expansion
- **Web Version** (WebAssembly core)
- **Desktop Companion** (Windows/Mac)
- **AR Glasses Support** (HoloLens, Magic Leap)
- **IoT Integration** (telescope mounts)

### Monetization
- **Freemium → Premium Tier**
- **Professional License** (educational institutions)
- **OEM Partnerships** (telescope manufacturers)
- **Consulting Services** (custom integrations)

---

## Feature Priority Matrix

### Must Have (MVP)
```
✅ Object Search
✅ AR Guidance  
✅ Rise/Set Times
✅ Alarms
✅ Offline Operation
```

### Should Have (Phase 2)
```
🟡 Satellite Tracking
🟡 Observation Logging
🟡 Advanced Calibration
🟡 Performance Optimization
```

### Nice to Have (Phase 3+)
```
⚪ Telescope Integration
⚪ Cloud Sync
⚪ Community Features
⚪ Astrophotography Tools
```

### Explicitly NOT Planned
```
❌ Telescope Motor Control (too niche)
❌ Real-time Image Processing (too heavy)
❌ Social Network (out of scope)
❌ Subscription-only Model (not for MVP)
```

---

## Metrics + Success Criteria

### Phase 1 (MVP)
| Metric | Target |
|--------|--------|
| Downloads | 10k |
| App Store Rating | 4.0+ |
| Daily Active Users | 500 |
| Crash Rate | <0.1% |
| Session Duration | 10+ min |
| Positional Accuracy | ±1° |

### Phase 2 (Growth)
| Metric | Target |
|--------|--------|
| Downloads | 100k |
| App Store Rating | 4.3+ |
| Pro Conversion | 10-15% |
| Revenue | $50k/year |
| Monthly Active Users | 5k |

### Phase 3 (Scale)
| Metric | Target |
|--------|--------|
| Downloads | 500k |
| App Store Rating | 4.5+ |
| Pro Conversion | 15-20% |
| Revenue | $500k+/year |
| Community Size | 50k+ users |

---

## Dependency Management

### Phase 1 → Phase 2
```
Phase 1 must be stable before Phase 2 starts.
Key dependency: Rise/set algorithms must be <500ms.
Phase 2 satellites depend on this performance.
```

### Phase 2 → Phase 3
```
Phase 2 telescope features ready.
TLE updates need background task infrastructure (Phase 2).
Phase 3 can build on this.
```

### Technical Debt
- Keep <20% of sprint capacity for refactoring
- Review architecture quarterly
- Address performance regressions immediately

---

## Risk Management

### Phase 1 Risks
| Risk | Probability | Mitigation |
|------|-----------|-----------|
| IMU/Orientation errors | High | Build calibration mode early |
| Accuracy validation delays | Medium | Use known test data set |
| App Store approval | Low | Follow guidelines strictly |

### Phase 2 Risks
| Risk | Probability | Mitigation |
|------|-----------|-----------|
| TLE data staleness | Medium | Plan backend strategy Phase 1 |
| Performance regression | Medium | Continuous benchmarking |
| User privacy concerns | Low | Clear privacy policy |

### Phase 3 Risks
| Risk | Probability | Mitigation |
|------|-----------|-----------|
| Backend costs growth | Medium | Pricing strategy clear |
| Feature scope creep | High | Strict issue requirements |
| Team expansion needs | Medium | Document architecture well |

---

## Go-to-Market

### Phase 1 Launch
- Soft launch in US + India
- Astronomy community outreach
- Reddit /r/astronomy promotion
- TikTok demo videos

### Phase 2 Expansion
- International App Store optimization
- Influencer partnerships (astronomers)
- YouTube tutorial series
- Academic partnerships

### Phase 3 Premium
- Professional tier pricing
- Institutional partnerships
- Premium features announcement
- Community event sponsorships

---

**Status**: Approved  
**Last Updated**: February 2026  
**Next Review**: Q1 2026
