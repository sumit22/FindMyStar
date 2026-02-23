# User Personas

## 1. Overview

This document defines three primary user personas for FindMyStar, expanding on the user classes introduced in [SRS Section 2.2](../02-requirements/srs.md#22-user-classes). Each persona includes demographic background, goals, pain points, usage patterns, feature priorities, and a representative scenario. These personas inform feature prioritization in the [Feature Scope](./scope.md) and acceptance criteria in the [Functional Requirements](../02-requirements/functional-requirements.md).

### User Class Distribution

| Persona | User Class | Proportion | Primary Need |
|---------|-----------|-----------|-------------|
| Anika | Casual Stargazer | 40% | Find and identify bright objects quickly |
| Raj | Hobby Astronomer | 50% | Plan observation sessions with precision |
| Sam | Night Sky Enthusiast | 10% | Learn and teach astronomy interactively |

---

## 2. Persona 1: Anika -- The Casual Stargazer

### 2.1 Profile

| Attribute | Detail |
|-----------|--------|
| **Name** | Anika Sharma |
| **Age** | 29 |
| **Location** | Pune, India |
| **Occupation** | Marketing manager at a tech company |
| **Astronomy experience** | Beginner -- can identify the Moon and "that bright thing" (usually Venus or Jupiter) |
| **Equipment** | Smartphone (iPhone 14), no telescope or binoculars |
| **Tech comfort** | High with consumer apps; low with scientific tools |
| **Observing frequency** | 2-4 times per month, opportunistic (clear nights, camping trips, rooftop evenings) |

### 2.2 Goals

1. **Identify what she sees**: "What is that bright star near the Moon tonight?"
2. **Find specific objects on demand**: "My friend mentioned Saturn is visible -- where do I look?"
3. **Impress friends and family**: Share the experience of finding planets during social gatherings.
4. **Learn gradually**: Pick up astronomy knowledge without studying textbooks.

### 2.3 Pain Points

1. **Star map apps are overwhelming**: Too many objects, unfamiliar coordinate systems, tiny labels.
2. **Cannot translate map to sky**: "The app shows Saturn on screen but I don't know which direction to face."
3. **Gives up quickly**: If she cannot find an object within 2-3 minutes, she closes the app.
4. **Privacy concerns**: Uncomfortable creating accounts for an app she uses casually.
5. **Offline needs**: Often stargazes while camping where there is no cell signal.

### 2.4 Typical Session

**Duration**: 5-10 minutes.
**Context**: Evening on apartment rooftop with friends, or camping trip.
**Flow**:
1. Opens FindMyStar.
2. Searches for "Saturn" or "Jupiter."
3. Taps the result and enters AR tracking mode.
4. Follows the directional arrow, rotating phone until the arrow turns green.
5. Shows friends: "Look, that bright dot right there is Saturn!"
6. Possibly searches for one or two more objects before closing.

### 2.5 Feature Priorities

| Priority | Feature | Why |
|----------|---------|-----|
| 1 | AR directional guidance | Core need: "tell me where to point" |
| 2 | Simple object search | Must find objects by common name |
| 3 | Target lock feedback | Confirmation that she found the right object |
| 4 | Offline operation | Camping use case |
| 5 | Visibility status | Know if an object is even above the horizon before searching |

### 2.6 Scenario: Camping Trip

Anika is camping in the Western Ghats with friends. It is 9:30 PM, the sky is clear, and someone asks, "Can we see Saturn tonight?" Anika opens FindMyStar (no cell signal -- fully offline). She types "Saturn" and taps the result. The app shows "Visible now -- Alt 35 deg, look South-Southwest." She enters AR mode, holds up her phone, and follows the arrow. Within 90 seconds, the arrow turns green and "TARGET LOCKED" appears. She points to the spot in the sky and says, "Right there, that yellowish dot." Her friends are impressed. She then searches for "Andromeda" -- the app says "Rises at 11:45 PM" and she sets an alert. At 11:40 PM, her phone buzzes: "Andromeda Galaxy is now visible. Look Northeast."

### 2.7 Success Metrics for Anika

- Time to find first object: < 2 minutes (vs. 8-15 min with star map apps).
- Session satisfaction: "I found what I was looking for" > 80% of sessions.
- 30-day retention: > 40%.

---

## 3. Persona 2: Raj -- The Hobby Astronomer

### 3.1 Profile

| Attribute | Detail |
|-----------|--------|
| **Name** | Raj Patel |
| **Age** | 42 |
| **Location** | Austin, Texas, USA |
| **Occupation** | Software engineer |
| **Astronomy experience** | Intermediate -- 5 years of regular observing; understands RA/Dec, magnitudes, and sky mechanics |
| **Equipment** | 8" Dobsonian telescope, 10x50 binoculars, smartphone (Samsung Galaxy S24) |
| **Tech comfort** | Very high; comfortable with technical apps and data |
| **Observing frequency** | 8-12 times per month; plans sessions around object visibility |

### 3.2 Goals

1. **Plan efficient observation sessions**: Know exactly when each target is optimally visible.
2. **Automated reminders**: Get notified when a Messier object he is tracking rises above a useful altitude.
3. **Precision pointing**: Use the app to aim his Dobsonian at faint objects that are hard to star-hop to.
4. **Track multiple objects**: Maintain a list of 10-20 tracked objects with alerts for each.
5. **Reliable accuracy**: Trust that rise/set times and positions are within professional accuracy bounds.

### 3.3 Pain Points

1. **Planning is tedious**: Currently uses a combination of Stellarium (desktop), a rise/set website, and a weather app to plan each session. Takes 20-30 minutes.
2. **Missed opportunities**: Forgets to check visibility of faint Messier objects; misses narrow viewing windows.
3. **Phone orientation drift**: Has experienced magnetometer interference near his telescope's metal parts.
4. **Battery drain**: Previous AR apps drained his phone in under an hour.
5. **Existing app accuracy**: Some apps show rise times that differ from USNO data by 10+ minutes, which matters for short visibility windows.

### 3.4 Typical Session

**Duration**: 2-4 hours of observing; 15-minute pre-session planning.
**Context**: Backyard observatory or dark sky site 45 minutes from home.
**Flow**:
1. Before leaving home, opens FindMyStar and checks tonight's tracked objects.
2. Reviews the alarm list: M42 rises at 7:45 PM, Jupiter culminates at 10:15 PM, M81/M82 pair visible after 11 PM.
3. Drives to dark sky site.
4. At site, uses AR guidance to quickly locate M42 with binoculars for a visual check.
5. Switches to telescope. Uses the angular distance readout to nudge the Dob toward M42 (manual push-to guidance).
6. Over the next 3 hours, works through his target list. The app notifies him when each object reaches optimal altitude.
7. At midnight, receives notification: "M81 (Bode's Galaxy) now at 45 deg altitude -- optimal viewing."

### 3.5 Feature Priorities

| Priority | Feature | Why |
|----------|---------|-----|
| 1 | Visibility alerts (alarms) | Automates session planning |
| 2 | Rise/set accuracy | Trusts the data for planning |
| 3 | AR guidance for Messier objects | Locates faint objects faster |
| 4 | Multi-object alarm management | Tracks 10-20 objects simultaneously |
| 5 | Culmination time display | Plans around peak altitude windows |
| 6 | Battery efficiency | 3-hour sessions without charger |
| 7 | Calibration prompts | Handles magnetometer interference near telescope |

### 3.6 Scenario: Evening Observation Session

It is a Tuesday in March. Raj has been tracking the Messier Marathon list. At 6:00 PM, FindMyStar sends a notification: "M1 (Crab Nebula) visible tonight, rises at 6:35 PM. Best altitude at 11:20 PM." Raj decides to head out. At his dark sky site, he opens the alarm list and sees 8 objects visible tonight, sorted by optimal viewing time. He works through them sequentially. For M57 (Ring Nebula), the AR guidance shows it is 12 degrees away. He nudges his Dobsonian following the arrow direction until the angular distance reads < 1 degree. He looks through the eyepiece and confirms the Ring Nebula in view. Total time from "which way is it?" to eyepiece confirmation: under 60 seconds.

### 3.7 Success Metrics for Raj

- Objects located per session: 5-8 (vs. 3-4 with manual star-hopping).
- Planning time eliminated: 20 minutes per session saved.
- Rise/set accuracy: within +/- 2 minutes of USNO data.
- Alarm reliability: 100% of scheduled notifications delivered.

---

## 4. Persona 3: Sam -- The Night Sky Enthusiast

### 4.1 Profile

| Attribute | Detail |
|-----------|--------|
| **Name** | Sam Okonkwo |
| **Age** | 23 |
| **Location** | London, United Kingdom |
| **Occupation** | Physics undergraduate and part-time planetarium guide |
| **Astronomy experience** | Moderate -- understands theory well; limited practical observing due to urban light pollution |
| **Equipment** | Smartphone (Google Pixel 8), occasionally borrows university's 6" refractor |
| **Tech comfort** | High; uses apps for learning and teaching |
| **Observing frequency** | 4-6 times per month; often demonstrating to others |

### 4.2 Goals

1. **Teach others**: Use the app as a classroom or planetarium demonstration tool.
2. **Learn object locations**: Build practical sky knowledge to complement theoretical studies.
3. **Explore the catalog**: Browse Messier objects, learn their types, distances, and significance.
4. **Quick demos**: Show visiting school groups "where Jupiter is right now" in under a minute.
5. **Accessibility**: Needs the app to work with screen reader and high-contrast mode for inclusive teaching.

### 4.3 Pain Points

1. **Urban light pollution**: Can only see bright objects; needs the app to indicate what is actually visible given local conditions.
2. **Teaching time pressure**: Demonstrations must be fast and reliable; cannot spend 5 minutes searching.
3. **Audience diversity**: Students range from 10-year-olds to retired adults; the interface must be universally understandable.
4. **Information density**: Wants to show object details (distance, type, magnitude) on screen during demos.
5. **Cost sensitivity**: As a student, prefers free or low-cost tools.

### 4.4 Typical Session

**Duration**: 5-15 minutes per demonstration; 30-60 minutes personal exploring.
**Context**: University rooftop during astronomy club meetings; planetarium outreach events; personal learning sessions.
**Flow**:
1. During an astronomy club meeting, Sam opens FindMyStar to demonstrate real-time tracking.
2. Searches for "Jupiter" and shows the AR guidance on the phone screen to the group.
3. Passes the phone around; each person follows the arrow and confirms they see Jupiter.
4. Opens the object info screen to explain: "Jupiter is a gas giant at magnitude -2.3, currently 35 degrees above the horizon."
5. Searches for "M31 Andromeda Galaxy" to demonstrate a deep-sky object. The app shows "Not visible -- below horizon. Rises at 10:15 PM."
6. Uses this to teach about rise/set times and horizon constraints.

### 4.5 Feature Priorities

| Priority | Feature | Why |
|----------|---------|-----|
| 1 | Object info display | Educational content for demonstrations |
| 2 | AR guidance | Visual, intuitive for diverse audiences |
| 3 | Visibility status | Teaches why objects are/aren't visible |
| 4 | Search by name | Quick access during timed demos |
| 5 | Accessibility (screen reader, high contrast) | Inclusive teaching environments |
| 6 | Rise/set times | Educational illustration of Earth rotation |

### 4.6 Scenario: Astronomy Club Outreach

Sam is running an evening outreach event at the university for local secondary school students. The sky is partly cloudy and light-polluted. Sam opens FindMyStar and searches for "Venus." The app shows "Visible now -- Alt 22 deg, look West." Sam holds up the phone and the group watches the arrow guide toward Venus. A student asks, "Why can't we see the Milky Way?" Sam searches "M31" -- the app shows "Visible now -- Alt 55 deg" but notes the magnitude is 3.4. Sam explains: "It's above us, but at magnitude 3.4, London's light pollution makes it invisible to the naked eye. If we were in a dark sky area, you'd see it right where this arrow points." The app becomes a teaching tool for both sky mechanics and observing conditions.

### 4.7 Success Metrics for Sam

- Demo setup time: < 30 seconds from app open to AR guidance on screen.
- Student engagement: App used as visual aid in 80%+ of outreach sessions.
- Accessibility: All core features usable with VoiceOver / TalkBack enabled.

---

## 5. User Journey Map

The following text-based journey map illustrates how each persona moves through the core app flow.

```
STAGE          ANIKA (Casual)           RAJ (Hobby)              SAM (Enthusiast)
-------        -------------------      -------------------      -------------------

AWARENESS      Friend mentions Saturn   Reads about Messier      Prepares for outreach
               is visible tonight       marathon opportunity     event next week

INTENT         "I want to see Saturn"   "I need to track 20      "I need a quick demo
                                         Messier objects"         tool for students"

OPEN APP       Launches FindMyStar      Opens alarm list         Opens search screen
               for first time           (returning user)         (frequent user)

SEARCH         Types "Saturn"           Reviews pre-set          Types "Jupiter"
                                         alarms by time

EVALUATE       Reads: "Visible now,     Sees: "M42 optimal       Reads: "Alt 35 deg,
               Alt 35 deg, look SSW"    at 10:15 PM tonight"     magnitude -2.3"

TRACK (AR)     Follows arrow to Saturn  Uses AR to aim           Shows phone to group;
               in 90 seconds            Dob toward M42           students follow arrow

CONFIRM        "TARGET LOCKED" --       Eyepiece confirms        Student confirms:
               shows friends            M42 in view              "I see it!"

SET ALERT      Sets alert for           Already has recurring     N/A (demo use)
               Andromeda rise           alerts; adds M81

NOTIFY         Gets push notification   Gets 8 notifications     N/A
               at 11:40 PM             throughout evening

RETURN         Uses app next camping    Uses app next clear       Uses app at next
               trip (2 weeks later)     night (2 days later)      outreach (1 week)
```

---

## 6. Persona-to-Feature Mapping

This matrix shows which features each persona considers essential, important, or optional.

| Feature | Anika (Casual) | Raj (Hobby) | Sam (Enthusiast) |
|---------|----------------|-------------|-----------------|
| Object search | Essential | Essential | Essential |
| AR directional guidance | Essential | Essential | Essential |
| Target lock indicator | Essential | Important | Important |
| Visibility status | Important | Essential | Essential |
| Rise/set times | Optional | Essential | Important |
| Visibility alerts (alarms) | Important | Essential | Optional |
| Alarm management | Optional | Essential | Optional |
| Object info (metadata) | Optional | Important | Essential |
| Culmination time | Optional | Essential | Important |
| Offline operation | Essential | Essential | Important |
| Battery efficiency | Important | Essential | Optional |
| Accessibility | Optional | Optional | Essential |
| Calibration prompts | Optional | Essential | Optional |

---

## 7. Design Implications

### 7.1 For Anika (Casual)
- **Onboarding**: Must be zero-friction. No tutorial needed; first search within 10 seconds of opening the app.
- **AR screen**: Large, clear arrow. Minimal text. Color-coded distance.
- **Search**: Common names only (no catalog IDs like "HIP 11767" in results for casual users).

### 7.2 For Raj (Hobby)
- **Alarm management**: Must support 20+ simultaneous tracked objects with sorting and filtering.
- **Accuracy indicators**: Display confidence/precision information for rise/set times.
- **Info density**: Show RA/Dec, altitude, azimuth, magnitude, distance on detail screen.

### 7.3 For Sam (Enthusiast)
- **Accessibility**: Full VoiceOver/TalkBack support for all screens (NFR-14).
- **Info screen**: Rich educational content (object type, distance in light-years, description).
- **Demo mode**: Fast transitions between search, AR, and info screens.

---

## 8. Cross-References

| Document | Relationship |
|----------|-------------|
| [SRS Section 2.2](../02-requirements/srs.md#22-user-classes) | User class definitions this document expands |
| [Problem Statement](./problem-statement.md) | Problems each persona experiences |
| [Feature Scope](./scope.md) | Feature priorities informed by persona needs |
| [Functional Requirements](../02-requirements/functional-requirements.md) | Acceptance criteria shaped by persona scenarios |
| [Non-Functional Requirements](../02-requirements/non-functional-requirements.md) | NFR-13 (usability) and NFR-14 (accessibility) |
| [Product Vision](./vision.md) | Target market and value proposition alignment |

---

**Document Status**: Approved
**Version**: 1.0
**Last Updated**: February 2026
**Owner**: Product Team
