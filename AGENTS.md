# Saathi — Agent Guide

Saathi is an Expo / React Native TypeScript cognitive-care app for elderly dementia patients and their families in the North Eastern Region. Build for dignity, low connectivity, and patient safety; do not treat game performance as a diagnosis.

## Sources of truth

Read the relevant source before changing a subsystem:

- `docs/GAMES.md` — game design, MVP scope, and patient-facing interaction rules.
- `docs/producer_contract.md` — canonical game-to-metrics event contract.
- `docs/storage_contract.md` — local persistence, session closing, migrations, and sync rules.
- `src/adaptive/types.ts` — canonical TypeScript definitions for events, sessions, outcomes, and controller state.

Do not copy or redeclare the canonical adaptive types elsewhere. Import them from `src/adaptive/types.ts`.

## Architecture boundaries

- `src/games` and `src/game`: patient-facing game modules, rendering contracts, and shared UI behavior.
- `src/adaptive`: event contracts, metrics extraction, safety rules, and the adaptive controller.
- `src/storage`: `expo-sqlite` persistence, migrations, controller-state writes, and the outbox sync flow.
- The patient device is the source of truth. Supabase is a one-way read mirror for the caregiver dashboard; it must never silently overwrite local controller state.

## Implementation rules

- Emit and persist every telemetry event immediately. Never accumulate game events in memory for a later flush.
- Use stable `itemId` values for the same real-world person, object, or activity across sessions. Never use array indexes or render keys as item IDs.
- Keep telemetry append-only. Never delete event history or use `DROP` against patient data.
- Reuse the existing session-end and sync-outbox path. Do not introduce a custom “recently changed” sync scan or a second persistence path.
- Keep raw family media and patient-visible personal notes out of normal analytics telemetry.
- Run `npm run typecheck` and `npm test` after relevant changes.

## Patient experience is a safety requirement

- No visible failure states: no red errors, X marks, score loss, timers, streaks, leaderboards, or guilt mechanics.
- Patient navigation and primary controls are tap-only, with at least 64px touch targets, large readable text, high contrast, and visual plus audio support for each prompt. A game may use a deliberately approved swipe or drag mechanic when it has a large forgiving gesture area and an accessibility activation path.
- Wrong answers are private telemetry facts, never patient feedback. Give a calm hint or reveal, then let the patient perform the correct response.
- Do not make diagnostic, curative, or clinical-improvement claims from telemetry. Dashboard output is a non-diagnostic support-needed or change-from-baseline signal.

## Who’s Who rules

- When a guardian adds media directly on the patient phone, it remains local to that device.
- Remote guardian uploads use temporary encrypted delivery storage only; verify download before purge. Any recovery copy requires guardian consent.
- Keep learning exposure separate from scored recall. New cards teach the association before asking for recognition.
- Keep spaced-repetition state per item on-device. Independent recall may advance an interval; supported recall should retain or shorten it.
- Grandchild-assisted sessions are valid engagement and correctness data, but exclude their latency from hint-time calibration and latency samples.
- Let guardians archive distressing content and designate content as learning-only; do not surface it as a patient quiz.

## Known design work — resolve deliberately

- Separate dashboard-capable game identifiers from controller-managed game identifiers; dashboard-only games must not be forced through the adaptive controller.
- Add explicit local persistence for Who’s Who learning/review state and for relationship/personal-note content before implementing the full workflow.
- Preserve interrupted sessions as incomplete and unscored. Do not infer abandonment when the operating system kills the app.
- Fix and test Recipe’s extractor before trusting its controller metrics.

## Before handoff

- Confirm all referenced contract paths still exist.
- Run typecheck and relevant tests.
- Keep changes scoped; do not modify contracts, migrations, or adaptive behavior as a side effect of a UI task.
