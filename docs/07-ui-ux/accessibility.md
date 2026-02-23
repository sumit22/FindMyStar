# Accessibility

> **Related Documents**: [UI/UX Architecture](./overview.md) | [SRS NFR-14](../02-requirements/srs.md) | [Design Principles](../03-architecture/design-principles.md) | [Tracking Mode States](./tracking-states.md)

This document defines the accessibility standards, implementation guidelines, and testing requirements for FindMyStar. The application targets **WCAG 2.1 Level AA** compliance across all non-AR screens and provides alternative modalities for the AR tracking experience.

---

## 1. Accessibility Principles

### 1.1 Compliance Target

FindMyStar targets WCAG 2.1 Level AA conformance for all standard (non-AR) screens. The AR tracking screen, which is inherently visual, provides alternative audio and haptic feedback channels to make celestial object finding accessible to users with visual impairments.

### 1.2 Design Goals

- **Perceivable**: All information is available through at least two sensory channels (visual + audio, or visual + haptic).
- **Operable**: Every interactive element can be activated through touch, screen reader gestures, and switch control.
- **Understandable**: Language is plain, navigation is consistent, and error messages include recovery actions.
- **Robust**: The interface works correctly with platform assistive technologies (VoiceOver, TalkBack) and adapts to user-configured accessibility settings (text size, display zoom, reduced motion).

### 1.3 Scope

Accessibility applies to all four primary screens (SearchScreen, ARScreen, ObjectInfoScreen, AlarmScreen), the Settings screen, all modal sheets and dialogs, and all OS-level notifications.

---

## 2. Screen Reader Support

### 2.1 General Guidelines

All interactive elements (buttons, inputs, list items, toggles) must have explicit accessibility labels that convey both the element's purpose and its current state. Labels are written in plain language, avoiding raw numeric values or astronomical jargon without context.

### 2.2 Per-Screen Announcements

**SearchScreen**:
- Search input: accessibilityLabel = "Search celestial objects", accessibilityHint = "Type a name to search stars, planets, and deep-sky objects".
- Each search result announces: "[Object name], [type], magnitude [value], [visibility status]".
  - Example: "Saturn, planet, magnitude negative 2.1, currently visible."
  - Example: "Andromeda Galaxy, galaxy, magnitude 3.4, rises at 9:30 PM."
- Empty state announces: "No search results. Type a name to begin."
- Error state announces: "Search failed. Double-tap to retry."

**ObjectInfoScreen**:
- Header announces: "[Object name], [type]".
- Position card announces: "Currently [altitude] degrees above the horizon, [direction]." Updated when the value changes by more than 1 degree.
- Visibility badge announces its text content directly: "Visible now" or "Below horizon" or "Rises at 9:30 PM".
- Rise/set times are grouped and announced: "Rises at [time], sets at [time], highest point at [time] reaching [altitude] degrees."
- Track button: accessibilityLabel = "Track [object name]", accessibilityHint = "Opens augmented reality tracking."
- Set Alert button: accessibilityLabel = "Set alert for [object name]", accessibilityHint = "Opens alert settings."

**ARScreen**:
- See section 5 (AR Mode Accessibility) for specialized audio guidance mode.
- Back button: accessibilityLabel = "Go back to object details".
- Stop button: accessibilityLabel = "Stop tracking".
- Angular distance is announced periodically (configurable interval, default 3 seconds): "4 degrees away, turn left."

**AlarmScreen**:
- Each alarm item announces: "[Object name] alarm, triggers [relative time], when above [threshold] degrees, [recurring or one-time]."
  - Example: "Saturn alarm, triggers tomorrow at 9:30 PM, when above 10 degrees, daily recurring."
- Delete action (revealed by swipe): accessibilityLabel = "Delete alarm for [object name]".
- Empty state announces: "No alarms set. Double-tap Search Objects to find an object."

### 2.3 Focus Order

Screen reader focus follows a logical top-to-bottom, left-to-right order on all screens. Specific ordering:

1. **SearchScreen**: Search input, then results list (top to bottom), then tab bar.
2. **ObjectInfoScreen**: Object name, position card, visibility badge, rise/set times, details, Track button, Set Alert button.
3. **AlarmScreen**: List items (sorted by time), then empty state or batch action bar, then tab bar.
4. **ARScreen**: Object label, angular distance, back button, stop button. (Minimal focus points; audio mode supplements visual.)

Skip navigation is not necessary given the simple, single-column layout of all screens.

---

## 3. Visual Accessibility

### 3.1 Contrast Requirements

All text and interactive elements meet the WCAG AA minimum contrast ratios:

| Element Type      | Minimum Ratio | Achieved (Dark Theme) | Achieved (Night Mode) |
|-------------------|---------------|------------------------|------------------------|
| Normal text       | 4.5:1         | 15.3:1 (white on #0D0D0D) | 5.2:1 (red on #0D0000) |
| Large text (18pt+)| 3:1           | 15.3:1                 | 5.2:1                  |
| UI components     | 3:1           | 8.7:1 (amber on #1A1A1A) | 4.1:1 (red on #1A0000) |
| Focus indicators  | 3:1           | Custom 2px amber ring  | Custom 2px red ring    |

The dark theme naturally provides high contrast because it uses near-white text on near-black backgrounds. The night mode uses red text on very dark red backgrounds and has been validated to meet AA ratios.

### 3.2 Text Scaling

FindMyStar supports text scaling from 100% to 200% using the platform's native text scaling mechanism:

- **iOS**: Dynamic Type. All text components use `UIFontMetrics` or React Native's `allowFontScaling` (enabled by default).
- **Android**: System font scale (`Settings > Display > Font size`). Layout adapts to larger text without truncation or overlap.

At 200% text scale:
- Search results may show fewer items per screen but remain scrollable.
- Buttons expand vertically to accommodate larger labels.
- The AR screen distance badge increases in size proportionally.
- No horizontal scrolling is required on any screen.

### 3.3 No Reliance on Color Alone

Every status indicator uses multiple channels to convey meaning:

| Information          | Color    | Additional Indicator                        |
|----------------------|----------|---------------------------------------------|
| Visibility: Visible  | Green    | Text label "Visible", checkmark icon        |
| Visibility: Below    | Gray     | Text label "Below Horizon", down-arrow icon |
| Visibility: Rising   | Amber    | Text label "Rises at HH:MM", clock icon     |
| Arrow: Far           | Red      | Large arrow size, text "> 5°"               |
| Arrow: Approaching   | Yellow   | Medium arrow size, text "1-5°"              |
| Arrow: Near          | Green    | Small arrow size, text "< 1°"              |
| Target locked        | Green bg | "TARGET LOCKED" banner text, haptic pulse   |
| Alarm: Recurring     | N/A      | Repeating icon + "Daily" label              |
| Alarm: One-time      | N/A      | Single-dot icon + "One-time" label          |

### 3.4 Color-Blind Friendly Design

The AR directional arrow is designed to be distinguishable by users with common forms of color vision deficiency (protanopia, deuteranopia, tritanopia):

- **Shape**: The arrow size decreases as the user approaches the target (large when far, small when near), providing a shape-based cue independent of color.
- **Text**: The angular distance badge always displays the numeric value, making color a supplementary rather than primary information channel.
- **High contrast option**: An accessibility setting provides a white-outlined arrow with increased stroke width for maximum visibility regardless of color perception.

---

## 4. Motor Accessibility

### 4.1 Touch Target Sizes

All interactive elements meet platform minimum touch target guidelines:

| Platform | Minimum Target Size | FindMyStar Implementation |
|----------|--------------------|-----------------------------|
| iOS      | 44 x 44 points    | 44 x 44 pt minimum, 48 x 48 pt preferred |
| Android  | 48 x 48 dp        | 48 x 48 dp minimum                        |

Buttons, list items, toggle switches, and tab bar items all meet or exceed these minimums. Adjacent interactive elements have at least 8dp spacing to prevent accidental activation.

### 4.2 Gesture Alternatives

Every gesture-based interaction has a button alternative:

| Gesture            | Screen       | Button Alternative                          |
|--------------------|--------------|---------------------------------------------|
| Swipe left to delete | AlarmScreen | Long-press opens context menu with "Delete" |
| Pull to refresh    | AlarmScreen  | "Refresh" button in header                  |
| Swipe back         | All screens  | Back button in top-left corner              |
| Scroll to dismiss keyboard | SearchScreen | "Done" button on keyboard toolbar    |

### 4.3 One-Hand Operation

The interface is designed for one-hand use, particularly during AR tracking when the user holds the phone with one hand pointed at the sky:

- Primary actions are positioned in the bottom half of the screen, within thumb reach.
- The tab bar is at the bottom edge.
- The AR screen stop button is at bottom-center.
- No interactions require reaching the top-right corner (the hardest area to reach one-handed).

### 4.4 Time-Independent Interactions

No user interaction requires completion within a time limit. The AR target lock (0.5° for 2 seconds) is a feedback mechanism, not a user action -- the user does not need to hold the phone steady to proceed; the lock indicator is informational only and does not gate any functionality.

---

## 5. AR Mode Accessibility

The AR tracking screen is inherently visual. To make celestial object finding accessible to users with visual impairments, FindMyStar provides an **audio guidance mode** that can be enabled in Settings or activated via a screen reader gesture.

### 5.1 Audio Guidance Mode

When enabled, the system provides spoken guidance through the device speaker or connected headphones:

- **Direction**: "Turn left", "Turn right", "Look up", "Look down".
- **Distance**: "12 degrees away", "5 degrees", "2 degrees", "Almost there".
- **Lock**: "Target locked! You are pointing at Saturn."

**Announcement interval**: Configurable in Settings (1 second, 3 seconds, 5 seconds). Default is 3 seconds. When the angular distance is less than 5 degrees, the interval automatically decreases to 1 second for more responsive guidance.

**Voice**: Uses the platform's text-to-speech engine (AVSpeechSynthesizer on iOS, TextToSpeech on Android) with the user's preferred voice and language settings.

### 5.2 Haptic Feedback

Haptic feedback provides a tactile channel for tracking proximity:

| Angular Distance | Haptic Pattern                                | Description               |
|-----------------|-----------------------------------------------|---------------------------|
| > 10°           | No haptic                                     | Too far for haptic cues   |
| 5° to 10°       | Single light pulse every 2 seconds            | Slow, gentle indication   |
| 1° to 5°        | Single medium pulse every 1 second            | Increasing urgency        |
| < 1°           | Continuous light pulses every 0.5 seconds     | Rapid approach feedback   |
| Locked (< 0.5°) | Single strong pulse, then steady              | Confirmation of lock      |

Haptic feedback can be toggled independently in Settings. It is enabled by default and functions regardless of whether audio guidance is active.

### 5.3 High Contrast Arrow Option

An accessibility setting enables a high-contrast arrow variant:

- Arrow is drawn with a 4px white outline (instead of the default 2px).
- Arrow fill color uses saturated, high-contrast variants of red, yellow, and green.
- Arrow size is increased by 30% compared to the default.
- The angular distance badge uses a solid opaque background instead of semi-transparent.

---

## 6. Cognitive Accessibility

### 6.1 Simple, Consistent Navigation

- The same tab bar is present on every non-AR screen with the same order (Search, Alarms, Settings).
- Back navigation always returns to the previous screen in the stack.
- No hidden gestures, easter eggs, or non-obvious interactions.
- The app never rearranges UI elements based on learned behavior or A/B testing.

### 6.2 Clear Error Messages

Every error message follows a three-part structure:

1. **What happened**: "Unable to determine your location."
2. **Why it matters**: "Location is needed to compute object positions."
3. **What to do**: "Check that location services are enabled in Settings."

Error messages avoid technical jargon, error codes, or raw exception messages.

### 6.3 Astronomy Terms Explained

When an astronomy term is used for the first time in the user's session, a brief inline explanation is available:

- "Altitude (angle above the horizon)" -- shown as a subtitle on ObjectInfoScreen.
- "Magnitude (brightness -- lower is brighter)" -- shown next to the magnitude value.
- "Azimuth (compass direction)" -- shown as a subtitle.

These explanations can be hidden in Settings by experienced users.

### 6.4 Undo Support

Destructive actions (alarm deletion) include a brief undo window:

- After deleting an alarm, a snackbar appears for 5 seconds: "Alarm deleted. [Undo]".
- Tapping "Undo" restores the alarm to its previous state.
- After 5 seconds, the deletion is finalized and the OS notification is cancelled.

---

## 7. Testing

### 7.1 Manual Testing Protocol

Each release undergoes manual accessibility testing on both platforms:

**iOS (VoiceOver)**:
- Enable VoiceOver on test device.
- Navigate all four screens using swipe gestures only (no visual reference).
- Verify all elements are announced with correct labels and hints.
- Verify focus order is logical and complete (no orphaned elements).
- Test AR audio guidance mode with VoiceOver active.
- Test with Dynamic Type set to largest setting.

**Android (TalkBack)**:
- Enable TalkBack on test device.
- Navigate all four screens using swipe and double-tap gestures.
- Verify all elements have contentDescription attributes.
- Verify focus order matches logical reading order.
- Test AR audio guidance mode with TalkBack active.
- Test with font size set to largest system setting.

### 7.2 Text Scaling Test Matrix

| Scale | SearchScreen | ObjectInfoScreen | ARScreen | AlarmScreen |
|-------|-------------|------------------|----------|-------------|
| 100%  | Baseline    | Baseline         | Baseline | Baseline    |
| 125%  | Verify layout | Verify layout  | Verify badge | Verify layout |
| 150%  | Verify scroll | Verify scroll  | Verify badge | Verify scroll |
| 200%  | Verify no overflow | Verify no overflow | Verify readability | Verify no overflow |

### 7.3 Automated Testing

Automated accessibility checks run as part of the CI pipeline:

- **React Native**: Integration of `@testing-library/react-native` with accessibility queries (`getByA11yLabel`, `getByA11yRole`).
- **axe-core**: Where applicable, axe-core rules are applied to rendered component trees to detect missing labels, insufficient contrast, and role violations.
- **Custom lint rules**: ESLint rules enforce that all `TouchableOpacity`, `Pressable`, and `Button` components include `accessibilityLabel` props.

### 7.4 Test Coverage Requirements

| Category                | Requirement                                           |
|-------------------------|-------------------------------------------------------|
| Screen reader labels    | 100% of interactive elements have labels              |
| Contrast ratios         | 100% of text meets 4.5:1 AA minimum                  |
| Touch targets           | 100% of interactive elements meet size minimums       |
| Gesture alternatives    | 100% of gestures have button equivalents              |
| Audio guidance (AR)     | Verified on each release with VoiceOver and TalkBack  |

---

## 8. Platform-Specific APIs

### 8.1 iOS

| Feature             | API                                          | Usage                                    |
|---------------------|----------------------------------------------|------------------------------------------|
| Screen reader       | UIAccessibility / VoiceOver                  | Labels, hints, traits, notifications     |
| Dynamic Type        | UIFontMetrics                                | Scaled fonts via preferredFont(forTextStyle:) |
| Reduced Motion      | UIAccessibility.isReduceMotionEnabled        | Disable animations when true             |
| Bold Text           | UIAccessibility.isBoldTextEnabled            | Use heavier font weights when true       |
| Voice Control       | Full Accessibility support built in          | Navigate and activate by voice           |

### 8.2 Android

| Feature             | API                                          | Usage                                    |
|---------------------|----------------------------------------------|------------------------------------------|
| Screen reader       | AccessibilityNodeInfo / TalkBack             | contentDescription, actions, live regions |
| Font scale          | Configuration.fontScale                      | Scaled text via sp units                 |
| Reduce animations   | Settings.Global.ANIMATOR_DURATION_SCALE      | Skip animations when set to 0            |
| Switch Access       | AccessibilityService                         | Focus-based navigation                   |
| Voice Access        | Google Voice Access                          | Navigate and activate by voice           |

### 8.3 React Native

| Feature             | API / Prop                                   | Usage                                    |
|---------------------|----------------------------------------------|------------------------------------------|
| Label               | accessibilityLabel                           | Read by screen reader                    |
| Hint                | accessibilityHint                            | Additional context for screen reader     |
| Role                | accessibilityRole                            | Semantic role (button, header, image)    |
| State               | accessibilityState                           | Disabled, selected, checked, expanded    |
| Live region         | accessibilityLiveRegion                      | Announce dynamic content changes         |
| Value               | accessibilityValue                           | Current value of sliders, progress bars  |
| Focus               | accessible, onAccessibilityTap              | Control focusability and tap behavior    |

For dynamic content that changes without user interaction (e.g., the position card on ObjectInfoScreen), `accessibilityLiveRegion="polite"` is used to announce updates without interrupting the user's current screen reader context.

---

## 9. Cross-References

| Document                                                              | Relevance                                        |
|-----------------------------------------------------------------------|--------------------------------------------------|
| [SRS NFR-14](../02-requirements/srs.md)                              | Accessibility non-functional requirement         |
| [UI/UX Architecture](./overview.md)                                  | Screen specifications and layout details         |
| [Tracking Mode States](./tracking-states.md)                         | AR state machine and UI feedback per state       |
| [Alarm & Notification UX](./alarm-feedback.md)                       | Alarm list screen reader announcements           |
| [Design Principles](../03-architecture/design-principles.md)         | Separation of concerns and usability principles  |

---

**Document Status**: Complete
**Version**: 1.0
**Last Updated**: February 2026
