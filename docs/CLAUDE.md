# Saathi

Cognitive care app for elderly dementia patients in the North Eastern Region.
SIH problem statement 26003 (MDoNER). Prototype stage.

## What this is

Not a brain-training app. A therapeutic protocol with a games layer on top.
The unit of use is a **family**, not a patient: a grandparent with dementia and
a grandchild play together. The grandchild is the tech operator and the social
mechanism; the grandparent is the expert.

Demo region is Tripura / Barak Valley. Demo language is Bengali.

---

## The problem statement

**ID 26003** — AI-Based Cognitive Gaming and Memory Assistance Platform for
Elderly Dementia Patients in North Eastern Region (NER).
Organisation: Ministry of Development of North Eastern Region (MDoNER).
Category: Software. Theme: MedTech / BioTech / HealthTech.

### Background

NER is seeing a rise in age-related cognitive disorders among the elderly.
Families in remote and rural areas struggle to access specialist neurological
care, cognitive therapy, and long-term elderly support because of limited
healthcare infrastructure and geography. Patients experience memory decline,
confusion, anxiety, and social isolation; caregivers struggle with continuous
monitoring and engagement. Affordable, culturally inclusive digital therapeutics
for NER elderly are scarce.

### Required capabilities

- (a) Interactive cognitive games for: memory improvement, attention and
  concentration, daily routine recall, pattern and object recognition,
  emotional and mental engagement
- (b) AI/ML to adapt difficulty to patient performance and cognitive condition
- (c) Multilingual and voice-assisted interaction suitable for NER elderly
- (d) Culturally familiar themes, visuals, sounds, regional language support
- (e) Reminders for medicines, hydration, daily activities, medical appointments
- (f) Caregiver and healthcare worker monitoring via dashboards and activity levels
- (g) Works in low-connectivity environments with offline functionality
- (h) Mobile/tablet, simple elderly-friendly interface

Expected solution: adaptive gaming and memory training modules; voice-enabled
multilingual interface; cognitive performance tracking and analytics dashboard;
caregiver monitoring and alert system; offline synchronisation; secure patient
data management; accessible UI/UX for elderly users. It should support early
cognitive intervention, improve quality of life, and strengthen digital
healthcare accessibility across NER.

### How we cover it

| PS requirement | Where it lives |
|---|---|
| Memory improvement | Who's who, Day's plan |
| Attention and concentration | Recipe, Packing |
| Daily routine recall | Day's plan |
| Pattern and object recognition | Packing, Recipe ingredients |
| Emotional and mental engagement | Song circle, Skill transmission |
| Adaptive difficulty | Difficulty controller, on-device |
| Multilingual, voice-assisted | Tiered language stack; voice output ships, input is roadmap |
| Cultural themes and regional language | Regional content profiles, family-generated content |
| Reminders (all four types) | Medicines, hydration, daily activities, appointments |
| Caregiver and health worker dashboards | Two roles: family caregiver, ASHA multi-patient view |
| Offline | Local-first; device is source of truth |
| Elderly-friendly mobile UI | Design rules below |

Framing beyond the PS, and our main differentiators: the dyad model as the
answer to social isolation; errorless design and morning orientation as the
answer to anxiety and confusion; the stigma and faith-healer routing strategy
as the answer to why adoption fails without it.

---

## Hard design rules

Non-negotiable. If a change would violate one, stop and flag it.

- **No failure states. Ever.** A wrong answer produces a gentle spoken hint and
  highlights the correct option. Never an error.
- No red, no X marks, no "incorrect", no score decreasing, no timers,
  no countdowns, no streaks, no leaderboards, no guilt mechanics.
- Base font 24px, large 32px, title 40px. Never below 20px in patient UI.
- Minimum touch target 64px.
- **Tap only.** No swipe, long-press, double-tap, or drag. Tremor and arthritis.
- High contrast. **Never encode meaning in blue or violet** — lens yellowing
  degrades blue discrimination in elderly users.
- Audio and visual redundancy on every prompt. Assume both presbycusis and
  cataracts.
- No modal dialogs. Generous or absent timeouts.
- Test at 200% system font scaling. Elderly users run max display size.
- Two type weights only. Sentence case. No decorative animation.

### Screens

1. **Photo login** — the patient taps their own photograph. No password, no PIN.
   A person with dementia cannot manage credentials. This single detail
   communicates the whole design philosophy.
2. **Patient home** — greeting in the local language, the current reminder as a
   tinted card, three large activity cards, a voice button.
3. **Game screen** — prompt at top, 2x2 or 3x2 option grid with generous tiles,
   hint region below, "again" and "next" as equal-weight controls.
4. **Caregiver dashboard** — trend chart, decline flag, reminder adherence,
   escalation to ASHA.
5. **ASHA multi-patient view** — patient list, status dot, flag count.

### The hint state

The most important screen state in the app, and the one to build first and
polish hardest. When the patient taps a wrong option:

- The wrong tap is not marked. No colour change on it, no shake, no sound of failure.
- The correct option gains a warm highlight (amber tint, 2px border).
- A hint card appears below in a calm tint with a spoken line and a short
  instruction, e.g. "The fish goes in after the oil is hot. Tap when you're ready."
- Nothing advances until the patient acts. No timeout, no auto-correct.

This is a four-second interaction and it is the thesis of the product.

### Visual language

Flat surfaces, no gradients or shadows. Rounded 12px cards. Tinted status cards
rather than coloured text. Icons are large (24–26px) and always paired with a
word — never icon-only in patient UI. Content imagery is regional and real:
local dishes, produce, festivals, landmarks, family photographs.

---

## Clinical basis

Every game maps to a preserved cognitive system, not a deficit.

- **Errorless learning** — errors get encoded and repeated in dementia, so the
  app must never let one stand. This is why difficulty exists.
- **Spaced retrieval** — expanding intervals 30s, 1m, 2m, 4m, 8m, 1d, 3d.
  Success steps up. Failure shows the answer immediately, drops to the previous
  interval, and re-asks now.
- **Reality orientation** — the morning half of Day's plan. Gentle, never
  corrective. Dropped at severe stage, where validation-based approaches are
  preferred and rigid correction causes distress.
- **CST principles** — opinions not facts, implicit not explicit learning,
  consistent session structure, social interaction as the mechanism. Group CST
  is unavailable in rural NER, so we use the dyad; the individual variant
  (iCST) is caregiver-delivered and maps to what we build. Claim
  "CST-informed", never "we deliver CST".
- **Procedural and musical memory** — preserved latest, so they carry the
  moderate and severe stages.

Context figures: dementia prevalence for 60+ in India is 7.4% (about 8.8m);
NE states excluding Assam sit at 7.35%. Mild neurocognitive disorder is 17.6%
versus 7.2% major — the pre-dementia population we target is far larger than
the diagnosed one.

---

## The six games

| Game | Cognitive target | Stage |
|---|---|---|
| Recipe | Sequencing, categorisation, procedural | Mild, moderate |
| Who's who | Face-name recall, carries spaced retrieval | Mild, moderate |
| Day's plan | Orientation, daily episodic recall | All |
| Packing | Executive function, planning | Mild |
| Skill transmission | Procedural memory | All |
| Song circle | Musical memory, engagement | All, primary at severe |

Design constraints shared by all six: the elder holds knowledge the child does
not; there is no single right answer; the activity is something the family
would plausibly do anyway; families generate the content.

Scope is frozen at six. Do not add games.

---

## Architecture

React Native + Expo, TypeScript. Zustand for state. expo-sqlite for local
storage. expo-audio for voice packs. Supabase for sync, auth, and RLS.
Caregiver dashboard is React + Vite, deployed separately.

**Local-first.** The device is the source of truth. Everything works with the
radio off. Sync is an optimisation, never a dependency.

**Sync is an append-only event log.** Events carry a UUID and a device
timestamp; the server dedupes on UUID. Store both `occurred_at` (device) and
`synced_at` (server) — an offline phone has a drifted clock. One caregiver
phone writes per patient, so CRDTs are unnecessary.

**Stage is a config object, not code branches.** Same components, different
config for mild / moderate / severe.

Canonical service layout:

```text
src/services/adaptive/          on-device difficulty and hint controller
src/services/patient-metrics/   derived patient and dashboard metrics
src/storage/                    SQLite, migrations, sessions, and sync outbox
```

The adaptive and patient-metrics services are pure TypeScript domain logic;
SQLite remains the persistence boundary. Do not create a parallel `backend/`
copy of either service.

**Every game implements `GameModule` and emits telemetry.** Telemetry hooks
live in the interface. Do not build a game without them — retrofitting across
six games will get cut.

Reuse one grid component across Packing, Who's who and Recipe. If you are
writing three game engines, you have misread the problem.

---

## The AI

All on-device. Personalised per patient, built from their own baseline.
There is no NER-representative dementia dataset in existence, so a pretrained
population model is not the unavailable option — it is the wrong one.

1. **Difficulty controller** — one 0–1 float per patient per game, nudged
   toward an **85% success rate**, not toward "harder when they win". Slow
   learning rate; dementia performance is noisy day to day.
2. **Spaced retrieval scheduler** — intervals as above, with the drop-back rule.
3. **Telemetry and trend detection** — reaction time, intra-individual
   variability (SD within session), hesitation, corrections, tap scatter,
   abandonment. Per game: sequence edit distance, category omission, evening
   recall proportion. Rolling 4-week linear fit; flag only when multiple
   metrics decline together.

Output is a **referral signal, never a diagnosis**.

---

## Language

Tiered, because most NER languages have no speech stack.

- **Tier 1** (Assamese, Bengali, Bodo, Manipuri, Nepali) — Bhashini / Indic-TTS.
- **Tier 2** (Khasi, Garo, Mizo, Nagamese, Kokborok) — community voice packs.
  A family member records ~200 prompts once; the app plays real human audio.
  Roughly 5MB per pack as mono Opus.
- Reminders can use a family member's own recorded voice.

Bhashini covers Khasi and Mizo for translation but not speech, which is exactly
the gap voice packs fill. Bhashini calls go through a Supabase Edge Function;
the key never enters the RN bundle. Translations are cached to a table and then
live on-device.

Clinically: people with dementia regress to their mother tongue and lose
later-acquired languages. A Hindi or English UI is not merely inconvenient, it
is wrong.

---

## Privacy

Raw audio and photos **never leave the device**. Only derived features and
metadata sync. On-device inference is a privacy property, not just an offline one.

Dementia patients may lack capacity to consent. Guardian proxy consent with
patient assent, per DPDP Act 2023. Supabase RLS enforces per-patient isolation
at the database.

---

## Never

- No LLM calls anywhere. Breaks offline, costs per user, sends patient data
  off-device, and is worse than a function at controlling a 0–1 float.
- No raw audio or photo sync.
- No new games. Scope is frozen at six.
- No seeded or illustrative data presented as real. Label it.
- No claim of diagnosis.
- No commercial music in Song circle. Family recordings only.

---

## Scoped out (roadmap, do not build)

On-device keyword spotting. Speech biomarkers. Wi-Fi Direct sneakernet sync.
ABHA / ABDM linkage. e-Sanjeevani handoff. Group CST sessions. Video calling.
Solo mode with voice input.

Voice output ships. Voice input is roadmap — today the grandchild is the
interaction layer.

---

## Build order

Song circle, Day's plan, Who's who, Recipe, Packing, Skill.

Cheapest first, flagship in the middle. Song circle de-risks the audio stack
on day one. If time runs out, the two simplest games are lost, not the one
the demo depends on.

Seed an eight-week fake history early, clearly labelled illustrative, so the
dashboard is not empty.

**One game must look finished.** Recipe. If it is still rough late, cut a game
and fix Recipe instead.

Freeze code at 80% of available time. The rest is polish and rehearsal.

---

## Demo sequence

1. Open with the phone already in airplane mode. Do not announce it.
2. Patient logs in by tapping her own photograph.
3. Greeting speaks in Bengali from the recorded voice pack.
4. Recipe game with real regional content.
5. **She taps the wrong ingredient.** Show the hint. Pause and explain why
   there is no error. This is the moment.
6. Reminder fires in a family member's recorded voice.
7. Switch to the caregiver view: trend, flag, escalation.
8. Turn connectivity on. Sync. Data appears on the health worker dashboard.

Record a video backup.

---

## Full rationale

See `docs/thread.md`.
