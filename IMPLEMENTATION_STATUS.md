# Saathi Implementation Status

**Snapshot date:** 2026-09-09  
**Repository:** `sih_dementia`  
**Purpose:** implementation handoff and continuation map. This describes what is present in the repository now, what is only a contract or scaffold, and where the next implementation should land.

## 1. Current Product Shape

Saathi is currently a React Native / Expo app with Android, iOS, and web targets. The implemented product slice is a local-first **Who's Who** memory activity for a patient and caregiver:

1. Choose a language pack.
2. Enter caregiver and patient details.
3. Optionally create or sign in to a guardian account through Supabase.
4. Add familiar people or objects with a photo, relationship, personal note, and optional voice recordings.
5. Introduce each new memory through a learning screen before recall.
6. Run a gentle recall round using photo-to-name, name-to-photo, and clue-to-photo prompts.
7. Persist every session and event locally, update per-item review scheduling, and optionally schedule a local reminder.

The other five planned activities are not implemented in the current UI. The adaptive type contract exists, but the metrics extractors, controller module, caregiver analytics, and sync worker do not yet exist as separate implementations.

## 2. Canonical Runtime Entry Point

- `App.tsx` imports and exports `SaathiWorkflow` as the default app. The older `LegacyApp` implementation remains in the same file but is dead code because it is not exported.
- `src/SaathiWorkflow.tsx` owns the active screen-state router and the complete current user flow.
- `src/components/ui.tsx` owns the shared button, notice, form field, portrait, and Who's Who list-row primitives.
- `src/components/audio.tsx` owns recording and playback UI.
- `src/storage/localStore.ts` owns local persistence, review scheduling, event writes, session closing, and the current inline controller-state update.
- `src/adaptive/types.ts` is the canonical source for adaptive event, session, outcome, controller, and configuration types. Do not redeclare these types elsewhere.

Before adding a new feature, extend `SaathiWorkflow` only for small routing changes. Put game logic in a game module and persistence in `src/storage`; the current file is already carrying more flow logic than the final architecture should.

## 3. Implemented Capabilities

### App shell and patient experience

Implemented in `src/SaathiWorkflow.tsx`, `src/components/ui.tsx`, and `src/theme.ts`:

- Light theme and Saathi visual tokens.
- Safe-area layout with a single-column patient flow.
- Large action controls with 64px minimum height for the shared button.
- Patient home with patient/caregiver identity portraits, activity entry, caregiver-area entry, and no score display.
- Calm support messaging instead of visible wrong-answer or failure states.
- Home navigation out of an activity.
- A loading state while the local store initializes.

Important limitation: the current patient UI still contains hardcoded English copy in `SaathiWorkflow.tsx`; language packs currently provide metadata and English fallback copy, not complete translated strings or voice packs.

### Language and onboarding

Implemented:

- Language selection for English, Assamese, Bengali, and Hindi from `src/data/seed.js`.
- Local in-memory selection for the current app session.
- Caregiver name, relationship, and patient name form.
- Local persistence of the care profile and patient ID through `setLocalSetting`.
- Patient mode can be opened without guardian authentication.

Remaining in this area:

- Persist and restore the selected language explicitly.
- Replace hardcoded patient and caregiver strings with localized language-pack data.
- Add the promised caregiver PIN or biometric protection before treating Caregiver Area as protected.

### Guardian authentication and care-circle setup

Implemented in `src/SaathiWorkflow.tsx`, `src/lib/supabase.ts`, and `supabase/functions/create-care-circle/index.ts`:

- Supabase email/password sign-up and sign-in.
- Local persistence of the Supabase auth session through the local settings adapter.
- Sign-up metadata for display name and preferred language.
- Friendly handling for invalid credentials, unconfirmed email, network/fetch failure, and unavailable Supabase configuration.
- Active guardian-to-patient lookup on sign-in.
- Protected Edge Function call for first-time care-circle creation.
- Server-side validation of authorization, required patient fields, existing active links, and the RPC-based care-circle creation path.
- Local caching of the returned patient ID.

Remaining in this area:

- Add the database migrations/schema/RLS policy source and deployment instructions if they are not maintained outside this repository.
- Add sign-out/session-expiry recovery tests.
- Add caregiver-area PIN/biometric protection required by the UX contract.
- Build the actual remote family-media delivery flow; it is explicitly outside the current direct-device workflow.

### Who's Who content management

Implemented in `src/SaathiWorkflow.tsx`, `src/storage/localStore.ts`, `src/storage/media.ts`, and `src/components/ui.tsx`:

- Add and edit familiar people or objects.
- Required name and relationship validation.
- Photo picker with local document-directory copy on native platforms.
- Web photo fallback using a data URI or picker URI.
- Name audio and personal-note audio recording through Expo Audio.
- Learning-only flag on a memory.
- Soft archive; archived records are hidden from active patient choices and media/event history is not deleted.
- Local list, edit, and archive confirmation flow.
- Stable generated IDs for new memory records.
- Empty-library messaging.

Known limitation: a restore action is not exposed in the active workflow even though old seed copy includes a restore string. Archive is reversible at the storage-function level (`archiveWhosWhoItem(id, false)`), but there is no current UI path for restoring an item.

### Who's Who learning and recall

Implemented in `src/SaathiWorkflow.tsx`:

- New memories enter a learning screen before recall.
- Learning exposure is stored separately from scored recall.
- Familiar frame includes photo, name, relationship, personal note, and optional name replay.
- Recall modes:
  - photo to name
  - name to photo
  - relationship/personal-note clue to photo
- Prompt forms rotate during a round.
- The round attempts every active memory in all three prompt forms, preferring a different memory and prompt form for the next card.
- Two or three answer choices are built from stable memory IDs; learning-only items are excluded as distractors.
- Wrong taps are persisted as telemetry, then the UI gives a calm support/reveal message and allows the patient to tap the correct answer.
- Audio replay is available and recorded as assistance telemetry.
- Leaving an active activity persists abandonment and applies the distress review rule.
- Completion returns to patient home without showing a performance score.

Important behavior to verify before expanding this game:

- The current `answer` implementation uses placeholder tap coordinates `x: 0, y: 0` rather than the actual touch coordinates.
- It records one `hint_shown` event at level 4 after a wrong answer; the full four-level hint ladder is not implemented visually.
- The current recall outcome is constructed per prompt and is intentionally minimal; there is no standalone extractor that rebuilds outcomes from raw events.
- `answerState === 'complete'` is defined but the active flow moves directly to the next prompt, so the complete-state branch is effectively unused.
- Companion-assisted sessions are supported by the storage type but there is no active UI to mark a companion-present session.

### Local persistence and migrations

Implemented in `src/storage/localStore.ts` and `src/storage/types.ts`:

- Native persistence with Expo SQLite.
- Web-only AsyncStorage fallback for browser preview.
- SQLite WAL mode and foreign keys enabled.
- Ordered `PRAGMA user_version` migrations through version 3.
- Base tables for items, sessions, events, outcomes, controller state, controller trajectory, and sync queue.
- Who's Who detail table and app settings table.
- Immediate append of game events rather than buffering until session end.
- Serialized writes for the web snapshot and event persistence path.
- Session start, normal finish, and abandonment functions.
- Stable event sequence numbers per session.
- Soft archive and no event deletion.
- Local profile, patient ID, reminder ID, and Supabase auth settings.

The web snapshot mirrors the local data shape but is a development fallback, not a production sync store.

### Spaced review and reminders

Implemented in `src/storage/localStore.ts` and `src/storage/reminders.ts`:

- Per-item review intervals: 30 seconds, 1 minute, 2 minutes, 4 minutes, 8 minutes, 1 day, 3 days, 7 days, and 14 days.
- Independent success advances the review step.
- Supported, incorrect, and distress results shorten or reset the interval as appropriate.
- Three consecutive distress/support-like outcomes can pause an item.
- Due-item selection prioritizes unlearned items, then due items, then future items.
- Native local notifications are scheduled for the next Who's Who due time when the runtime supports Expo Notifications.
- Existing scheduled Who's Who reminder is cancelled before a new one is created.
- Web and Expo Go paths skip unsupported notification behavior without blocking local learning.

The intervals extend beyond the five-short-interval MVP described in `docs/GAMES.md`; confirm the desired demo behavior before presenting the long-term tiers as complete.

### Audio and local media

Implemented in `src/components/audio.tsx` and `src/storage/media.ts`:

- Native voice-note recording with microphone permission handling.
- Name and personal-note recordings can be attached to a memory draft.
- Native photos are copied into the app document directory.
- Browser previews use a data URI when base64 is available.
- Audio replay uses Expo Audio and emits replay telemetry from the recall flow.

Remaining:

- Stop currently playing audio when another prompt starts.
- Add prompt audio packs for every supported language.
- Validate media cleanup/replacement behavior and permissions on real Android hardware.
- Implement the consented remote-upload/recovery flow described in the product rules.

## 4. Adaptive and Telemetry Status

### Present foundations

- `src/adaptive/types.ts` defines `GameId`, `GameEvent`, `GameSession`, `SessionRecord`, `SessionOutcome`, `PatientProfileMetrics`, `ControllerState`, `GameConfig`, and `NextConfig`.
- `docs/producer_contract.md` defines the required event semantics, item-ID rules, timestamp rules, `solvedUnassisted` rules, and the three controller-managed game IDs.
- `localStore.ts` writes raw events immediately and records outcomes/controller trajectory during native session close.
- Native session closing excludes companion-present latency samples from calibration.

### Not implemented as dedicated modules

There is currently no source module for:

- Event-to-outcome extraction for Day's Plan, Who's Who, or Recipe.
- Patient profile metric aggregation.
- Adaptive controller calibration/tracking/frozen decisions.
- A reusable `onSessionEnd` integration point returning `NextConfig`.
- Controller-state restoration/reading for configuring the next session.
- Dashboard trend or support-needed summaries.

`finishWhosWhoSession` currently contains a small inline difficulty update for native storage. Treat it as transitional. Move that logic into an adaptive controller after extractors and controller rules are implemented, keeping the canonical types in `src/adaptive/types.ts`.

### Contract risks to resolve

- `GameEvent.hintLevelAtTap` is typed as `0 | 1 | 2 | 3 | 4`, but the current Who's Who flow jumps from no hint to level 4 rather than implementing levels 1 through 4.
- Tap coordinates are always zero in the current producer.
- The producer contract requires an event for every attempt and stable asked-item IDs; new game producers must follow that exactly.
- Recipe's extractor is called out as needing a fix in the project guidance; no Recipe extractor is currently present, so do not infer that Recipe metrics are usable.
- The web persistence path stores outcomes but does not run the native controller-state update and trajectory writes.
- `sync_queue` rows are enqueued on native writes, but no queue-draining worker or Supabase upsert path is implemented.

## 5. Planned Games: Current State

The full design is in `docs/GAMES.md`. Only Who's Who has an active patient flow.

| Game | Current state | Next implementation owner |
|---|---|---|
| Who's Who | Implemented local-first learning, recall, review scheduling, audio/photo memory management, and telemetry path. Needs extractor/controller cleanup and UX hardening. | `src/SaathiWorkflow.tsx`, `src/storage/localStore.ts`, new `src/games/whosWho/*` or equivalent |
| Day's Plan | Types and design only. No morning/evening screens, caregiver plan editor, phase-aware sessions, or recall metrics. | New game module plus `src/storage` plan persistence |
| Recipe | Types/design only. No recipe screen, ingredient grid, narration, or sequence telemetry. Extractor is explicitly a known issue. | New Recipe game module and extractor; fix before trusting metrics |
| Song Circle | Seed card only (`coming soon`). No recorder list, suggested theme, or local recording library. It is dashboard/engagement data, not controller data. | New local audio-library module and patient screen |
| Packing | Design only. No occasion, item grid, suitcase strip, or omission telemetry. | New game module; reuse shared grid primitives |
| Skill Transmission | Design only. No skill cards, spoken prompt, completion action, or optional photo. | New game module and local activity persistence |

The product documentation says six MVP games are the target, but the active `seed.games` list currently exposes only Who's Who, Day's Plan, and Song Circle, with the latter two marked later/coming soon.

## 6. Storage and Sync Work Remaining

Priority work in `src/storage` and Supabase:

1. Implement an outbox drain that reads pending `sync_queue` rows, upserts device records to Supabase, and marks only confirmed rows as sent.
2. Keep sync one-way: events, sessions, outcomes, controller trajectory, and controller state go device-to-server; server controller state must never overwrite the patient device during routine sync.
3. Define or add the server schema and RLS policies for the synchronized tables.
4. Add retry/backoff and connectivity handling without losing queue rows.
5. Add explicit recovery for a replaced device; this is different from normal sync.
6. Add tests for interrupted sessions, migration upgrades, duplicate queue entries, and no event deletion.

Do not implement a second modified-at scan. The outbox is the required source of pending work.

## 7. Caregiver Dashboard Work Remaining

There is currently no implemented caregiver analytics screen. Still required:

- Read local or mirrored session outcomes and compute plain-language change from the patient's own baseline.
- Show support-needed and activity trends without diagnosis, cure, or clinical-improvement claims.
- Show activity count, completed/abandoned sessions, active days, independent performance, latency, and variability only where data is sufficient.
- Distinguish controller-managed games from dashboard-only games.
- Keep raw family photos, voice recordings, personal notes, and other private media out of normal analytics telemetry.
- Add loading, offline, insufficient-data, and error states.

The type target for the aggregate result is `PatientProfileMetrics` in `src/adaptive/types.ts`.

## 8. Testing and Verification Status

Current scripts in `package.json`:

- `npm run typecheck` runs TypeScript with `--noEmit`.
- `npm test` currently prints `UI demo: no automated tests configured yet`; it is not a real test suite.
- `npm run web` starts the Expo web preview.
- `npm start` starts the Expo development server.

No automated test files are currently present in the visible repository. Before extending the feature set, add focused tests for:

- Review interval transitions and pause behavior.
- Event sequencing and `solvedUnassisted` semantics.
- Session abandonment and incomplete-session handling.
- Migration behavior from schema versions 0, 1, and 2.
- Outbox enqueue/drain/retry behavior.
- Language selection persistence.
- Who's Who prompt-round selection and learning-only exclusion.

The next handoff should run `npm run typecheck`, then replace the placeholder test script with an actual runner before claiming behavioral coverage.

## 9. Recommended Continuation Order

1. **Stabilize the active Who's Who slice.** Extract it from the monolithic workflow, capture real tap coordinates, implement the visible hint ladder, clarify completion/abandonment behavior, and add unit tests for review and event semantics.
2. **Create adaptive modules.** Implement extractors first, then the controller, then make session close call those modules rather than updating difficulty inline.
3. **Finish the persistence contract.** Add controller-state reads, web parity where needed, migration tests, and the one-way outbox sync worker.
4. **Build Day's Plan.** It exercises phase-aware sessions and the most important recall metric without requiring new media infrastructure.
5. **Build Recipe.** Fix and test its extractor before relying on its metrics; keep sequence violations distinct from ordinary taps.
6. **Add Song Circle, Packing, and Skill Transmission.** These are dashboard/engagement or executive/procedural activities and must not be accidentally routed through the three-game controller union.
7. **Build the caregiver dashboard and remote media workflow.** Use baseline/support-needed language and preserve local device authority.
8. **Run device verification.** Test permissions, SQLite migrations, notification behavior, audio/photo persistence, app termination during a session, offline use, and large text scaling on a real Android device.

## 10. Source-of-Truth Checklist

Before changing a subsystem, read the relevant source of truth:

- Game scope and patient interaction rules: `docs/GAMES.md`, `DESIGN.md`, and `AGENTS.md`.
- Event and session semantics: `docs/producer_contract.md` and `src/adaptive/types.ts`.
- Persistence, migrations, session closing, and sync: `docs/storage_contract.md` and `src/storage/localStore.ts`.
- Patient data lifecycle and remote media constraints: `docs/supabase.md` and `AGENTS.md`.
- Shared UI and screen ownership: `UX-CONTRACT.md`, `src/components/ui.tsx`, and `src/SaathiWorkflow.tsx`.

The safest next code change is one that keeps these boundaries intact: patient device as source of truth, append-only telemetry, stable item IDs, no visible failure mechanics, and no diagnostic interpretation of game performance.
