---
version: alpha
name: "Saathi"
description: "A calm, language-flexible cognitive-care companion that feels like opening a family photo album, not using a medical test."
colors:
  primary: "#35634B"
  canvas: "#FFFDF8"
  surface: "#F5F0E5"
  ink: "#243129"
  muted-ink: "#5B665E"
  leaf: "#35634B"
  leaf-soft: "#DCE9DD"
  amber: "#B96D18"
  amber-soft: "#F8E4BE"
  border: "#C9D0C5"
  focus: "#173F2D"
  danger: "#9B2C2C"
  white: "#FFFFFF"
typography:
  patient:
    fontFamily: "Saathi Patient, Noto Sans, sans-serif"
    fontSize: "24px"
    lineHeight: "1.45"
  display:
    fontFamily: "Saathi Display, Noto Serif, serif"
    fontSize: "40px"
    lineHeight: "1.2"
  utility:
    fontFamily: "Saathi Patient, Noto Sans, sans-serif"
    fontSize: "18px"
    lineHeight: "1.4"
rounded:
  DEFAULT: "12px"
  control: "12px"
  media: "16px"
spacing:
  page-gutter: "24px"
  patient-gap: "20px"
  section-gap: "32px"
components:
  app-shell: { backgroundColor: "canvas" }
  patient-action: { backgroundColor: "primary", textColor: "white", rounded: "control", height: "64px" }
  patient-copy: { textColor: "ink", typography: "patient" }
  helper-copy: { textColor: "muted-ink", typography: "utility" }
  photo-card: { backgroundColor: "surface", rounded: "media" }
  guardian-panel: { backgroundColor: "leaf-soft", rounded: "control" }
  support-notice: { backgroundColor: "amber-soft", textColor: "ink", rounded: "control" }
  support-icon: { textColor: "amber" }
  focus-indicator: { backgroundColor: "focus" }
  guardian-danger-action: { backgroundColor: "danger", textColor: "white", rounded: "control" }
---

# Saathi Design System

## Overview

### Creative North Star

Saathi should feel like a familiar family-photo album laid open on a quiet morning table: personal, unhurried, and tactile in its clarity. The patient never sees a clinical score or a test-taking surface. The one expressive device is the **Familiar Frame**: each memory is introduced as a large, well-lit portrait with a spoken relationship and a small contextual cue. Saathi's leaf mark is a quiet symbol of care and continuity; it replaces letterform monograms wherever the app name appears.

### Product context and register

- **Audience and primary job:** Elderly people living with dementia use a tablet or phone with a grandchild or caregiver to follow a familiar routine and revisit personal memories. Guardians configure content and review support-needed trends.
- **Target market and evidence:** North Eastern India. The product must support region-specific language and culture packs without changing the application UI.
- **Locale and language policy:** Saathi asks for the active language pack only on first launch and saves that choice on-device. It can later be changed from Member Settings or the caregiver dashboard, with the new language applied immediately. Every patient-facing string, voice prompt, date format, and font family comes from that pack; screens contain localization keys, never hardcoded language text. English may be used as a guardian fallback only where it does not block use. Each pack supplies `languageCode`, `displayFont`, `bodyFont`, `voicePromptPack`, `dateFormatter`, `localizedStrings`, and `textScaleAdjustment`.
- **Usage scene:** A shared mobile/tablet session at home, often in inconsistent connectivity and with low digital confidence. The patient experience is spacious; guardian tools may be denser.
- **Register:** Hybrid. Patient routes are warm, calm, and familiar; guardian routes are clear operational tools using the same palette and type family.
- **Memorable signature:** The Familiar Frame pairs an uncluttered personal photo with a spoken name, relationship, and optional memory cue.
- **Restraint:** Navigation, reminders, and answer choices stay plain. Never decorate a patient task with animation, charts, badges, or gamification.
- **Anti-references:** Hospital portals, colourful children’s games, analytics-heavy wellness apps, dark interfaces, glassmorphism, gradients, and score-driven brain-training products.
- **Token ownership/runtime mapping:** This file is the visual source of truth. `src/theme.ts` is its React Native runtime adapter; screens and shared components consume semantic theme values rather than new literal colors, radii, spacing, or patient text sizes.

## Colors

`canvas` and `surface` create a soft paper-and-linen base without becoming a nostalgic visual costume. `ink` carries all essential text and icon contrast. `leaf` is the primary action colour, while `amber` is reserved for calm assistance/reveal states, never failure. Use `amber` only for borders, icons, and large assistance cues; never use it as small text on a light surface. On `amber-soft`, use `ink` for all text. Do not encode meaning in blue or violet. Patient UI does not use red; `danger` is guardian-only for genuinely destructive actions. Use `focus` for a highly visible keyboard/switch focus ring.

## Typography

Each language pack declares its bundled `Saathi Patient` and optional `Saathi Display` font assets; the app must not download a font at runtime. Patient controls use `patient` typography with a 24px minimum; patient titles use `display` at 40px. Guardian utility text may use `utility`, but no patient UI text may fall below 20px. Use short, natural phrases in the selected language and two weights at most per patient screen. Never rely on italics, all caps, or thin strokes.

## Layout

Patient screens use a single-column composition with 24px side gutters, 20px gaps, and safe-area padding. The member dashboard uses a three-item bottom navigation—Games, Routine, and Settings—while the caregiver dashboard uses Games, Insights, and Settings. Each label is always visible; tabs have a visually compact treatment with a 64px interactive target, and the active state is leaf green, never colour alone. Keep the current activity above the fold. On a tablet, preserve one primary activity column rather than adding information beside it. Who’s Who uses a large photo frame followed by two or three full-width answer tiles; do not use a compact grid for names. Guardian screens may use cards and charts, but their primary actions remain visible without horizontal scrolling.

Patient navigation is deliberately shallow: the member dashboard provides Games, Routine, and Settings, while active memory activities retain a persistent localized Games action and Hear again action. Leaving an activity returns directly to Games without a score or performance summary. Caregiver Area is visually separate, always labelled, and protected by PIN or device biometrics. Caregiver Games contains only activity editors, all non-diagnostic support summaries live in Insights, and Settings shows the assigned member and invite identifier. Routine and medication reminders are caregiver-authored on-device data; patient-facing reminders provide calm guidance, never medical advice or confirmation that medication was taken.

Support 200% system text scaling: cards grow vertically, labels wrap, and controls retain their minimum 64px height. Reserve image aspect ratio and feedback-space geometry so hints, audio replay, and sync changes do not shift controls unexpectedly.

## Elevation & Depth

Use flat tonal surfaces, 1px `border` dividers, and spacing for hierarchy. Static cards have no drop shadow. Use a scrim and accessible app-owned sheet/dialog only for guardian-confirmed sensitive actions; patient routes avoid modal dialogs.

## Shapes

Use 12px corners for controls and panels, and 16px for personal media. Shapes are stable and quiet; do not use pills as decoration. Icons are always paired with words in patient UI. A photo is never clipped into a circle unless it is clearly a profile identity marker.

## Components

### Foundational visual states

Every patient control has default, pressed, disabled, and focus-visible states. Wrong answers never produce a red/error state: the selected wrong tile remains calm, then an amber assistance cue highlights the correct tile. Loading uses a stable, labelled progress region; avoid skeletons on patient tasks. Offline status appears only when an action needs connectivity and never blocks local play.

### Buttons and actions

The patient’s primary action is a full-width leaf button with an optional localized, word-labelled audio icon. Secondary actions are outlined, equal-height buttons. The localized equivalent of “Hear again” remains visible and does not auto-play endlessly. Guardian danger actions use a separate, labelled danger treatment and require an app-owned confirmation flow.

### Navigation and data display

Patient home shows a spoken greeting, the next reminder, and no more than three large activity cards. Caregiver access is a quiet but visible bottom action protected by PIN or device biometrics. Guardian dashboards use an explanatory trend label and plain-language evidence; they must never show a diagnostic score.

### Forms and overlays

Guardian setup may be text-rich and step-based. Use explicit labels, inline validation, saved-progress feedback, and a large media-preview area. For remote family media, explain temporary encrypted delivery and recovery consent before upload. Patient routes use no modal dialogs; guardian dialogs are accessible and restore focus when closed.

### Iconography

Use one rounded-stroke icon family at 24–26px. Icons never stand alone for patient actions: pair them with a localized text label. Speaker, home, reminder, and caregiver symbols must have localized accessible names.

### Motion

Motion is limited to 150–200ms pressed feedback and the gentle appearance of an assistance cue. Skill Transmission may additionally use one-time 250–500ms fades and small object movement for one clear swipe or drag action at a time. These are symbolic rehearsals, not scored or prescriptive real-world tutorials. No confetti, bouncing, countdown, failure animation, or decorative ambient animation. Respect reduced-motion settings.

### Audio behavior

Each patient prompt may play once when its activity state opens. A visible, localized Hear again action is always available. Audio never loops, never auto-advances the task, and never competes with another prompt: starting new audio cleanly stops the previous playback. Audio replay remains assistance telemetry, not patient-visible failure.

### Content and data visualization

Voice is gentle, specific, and non-judgmental: “Let’s hear it together,” never “Incorrect.” Guardian setup, medication controls, and forms use at least 18px body text; compact dashboard metadata may use 16px only when it remains supplementary. Guardian charts use leaf/amber/neutral tones plus direct labels and textual summaries; never use colour as the only trend indicator. The dashboard reports change from a personal baseline and support needed, never diagnosis or cure.

## Do's and Don'ts

- **Do:** Make personal media large, crisp, and central; it is the emotional interface of Who’s Who.
- **Do:** End every patient activity with an easy, familiar success and an explicit next step.
- **Don't:** Turn the patient experience into a dashboard, game arcade, or hospital chart.
- **Don't:** Use red, score loss, timers, or compact controls to communicate cognitive difficulty.
