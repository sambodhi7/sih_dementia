# Saathi Repository Structure

This document explains the current repository layout, what each file or directory owns, and where new work should go.

## Repository Overview

Saathi is an Expo / React Native TypeScript application for a local-first cognitive-care experience. The repository currently contains:

- A single Expo application entry point.
- A working Who's Who patient and caregiver flow.
- Shared patient/caregiver UI components.
- Local SQLite persistence with a browser fallback.
- Adaptive event and controller type contracts.
- Supabase authentication and one care-circle Edge Function.
- Product, UX, game, storage, and telemetry contracts.

The current implementation is smaller than the target architecture described in some planning documents. Use the actual directories below as the source of truth for current code placement.

## Top-Level Files

```text
.
|-- App.tsx
|-- package.json
|-- package-lock.json
|-- tsconfig.json
|-- app.json
|-- eas.json
|-- .env.example
|-- .gitignore
|-- AGENTS.md
|-- DESIGN.md
|-- UX-CONTRACT.md
|-- DEVICE-TEST.md
|-- IMPLEMENTATION_STATUS.md
|-- REPO_STRUCTURE.md
|-- docs/
|-- src/
`-- supabase/
```

### Application and build files

- `App.tsx`
  - Expo development entry point.
  - Imports and exports `src/SaathiWorkflow.tsx` as the active default app.
  - Contains an older `LegacyApp` prototype that is no longer exported. Do not extend it unless it is deliberately removed or revived.
- `package.json`
  - Defines Expo dependencies and scripts.
  - `npm run start`: starts Expo.
  - `npm run web`: starts the web preview.
  - `npm run typecheck`: runs TypeScript without emitting files.
  - `npm test`: currently only prints a placeholder message; it is not an automated test suite.
- `package-lock.json`
  - Locks npm dependency versions. Update it through npm when dependencies change.
- `tsconfig.json`
  - Extends Expo's TypeScript configuration.
  - Uses strict checking, allows the bundled JavaScript seed file, and includes `App.tsx` plus all `src` TypeScript/JavaScript files.
- `app.json`
  - Expo app identity, platform targets, permissions, native plugins, orientation, and light-theme configuration.
- `eas.json`
  - EAS build/submit profiles and release configuration.
- `.env.example`
  - Documents environment variables expected for Supabase configuration.
- `.gitignore`
  - Files and directories excluded from version control.

### Root guidance and product documents

- `AGENTS.md`
  - Primary repository rules for agents and contributors.
  - Defines architecture boundaries, patient-safety rules, telemetry requirements, storage rules, and handoff checks.
  - Read this before changing behavior.
- `DESIGN.md`
  - Visual design system and patient-experience rules.
  - Defines colors, typography, spacing, touch targets, motion, audio behavior, and forbidden UI patterns.
- `UX-CONTRACT.md`
  - Canonical UI ownership and user-flow ledger.
  - Identifies which component owns buttons, fields, notices, lists, and navigation.
- `DEVICE-TEST.md`
  - Manual device-testing guidance and expected hardware/runtime checks.
- `IMPLEMENTATION_STATUS.md`
  - Detailed status of implemented behavior, known gaps, risks, and recommended build order.
- `REPO_STRUCTURE.md`
  - This file: a map of the repository and code ownership.

## `src/`: Application Source

```text
src/
|-- SaathiWorkflow.tsx
|-- theme.ts
|-- env.d.ts
|-- adaptive/
|-- components/
|-- data/
|-- lib/
`-- storage/
```

### `src/SaathiWorkflow.tsx`

The active application workflow and screen-state router. It currently owns:

- Language selection.
- Caregiver onboarding.
- Guardian sign-in/sign-up.
- Caregiver dashboard shell.
- Who's Who memory manager and editor.
- Patient home.
- Who's Who learning and recall.
- Activity completion and abandonment actions.

This file is currently the main orchestration surface. Keep it focused on routing and coordination as new games are added; move game-specific behavior into dedicated modules when practical.

### `src/theme.ts`

Runtime React Native adapter for the semantic design tokens specified in `DESIGN.md`. New UI should consume these theme values instead of introducing unrelated colors, spacing, radii, or patient text sizes.

### `src/env.d.ts`

TypeScript declarations for environment-specific values and modules used by the app.

## `src/adaptive/`: Adaptive Contracts

```text
src/adaptive/
`-- types.ts
```

- `types.ts`
  - Canonical definitions for `GameId`, `GameEvent`, `GameSession`, `SessionRecord`, `SessionOutcome`, `PatientProfileMetrics`, `ControllerState`, `GameConfig`, and `NextConfig`.
  - Import adaptive types from this file. Do not copy or redeclare them in game, storage, or UI modules.

Current limitation: this directory contains the type contract only. Dedicated event extractors, patient metrics, and adaptive-controller modules are not yet present in the current checkout.

## `src/components/`: Shared UI and Audio

```text
src/components/
|-- audio.tsx
`-- ui.tsx
```

### `src/components/ui.tsx`

Shared visual primitives:

- `ActionButton`: primary, secondary, quiet, and guardian danger-style actions.
- `Notice`: neutral and calm-support messages.
- `Field`: labelled text input with optional password visibility control.
- `Portrait`: photo or initials fallback.
- `MemberRow`: caregiver Who's Who list row with edit/archive actions.

Add shared controls here when they are used by multiple patient or caregiver flows. Preserve the minimum touch target and patient-safe feedback rules.

### `src/components/audio.tsx`

Shared audio controls:

- `AudioCapture`: microphone permission, recording, stop/save, and error handling.
- `AudioReplay`: playback and optional replay callback for telemetry.

Audio is currently used for family voice notes and Who's Who name replay. Prompt packs for the supported languages are not yet implemented.

## `src/data/`: Bundled Seed and Copy

```text
src/data/
`-- seed.js
```

- `seed.js`
  - Bundled app copy, language-pack metadata, initial patient/guardian defaults, and game-card metadata.
  - Does not contain real family data.
  - New content should remain illustrative or family-generated; never add real patient or family media.

The current language entries provide labels and metadata, but much of the active workflow still uses hardcoded English strings. Full localization should extend this data shape and update the consuming screens.

## `src/lib/`: External Service Clients

```text
src/lib/
`-- supabase.ts
```

- `supabase.ts`
  - Creates the Supabase client only when the public URL and publishable key are configured.
  - Persists Supabase auth tokens through the local settings adapter.
  - Keeps auth unavailable gracefully when environment variables are absent.

This directory is for service-client setup, not for patient-domain logic or local database queries.

## `src/storage/`: Device-First Persistence

```text
src/storage/
|-- localStore.ts
|-- media.ts
|-- reminders.ts
`-- types.ts
```

### `src/storage/localStore.ts`

The patient device is the source of truth. This module owns:

- Expo SQLite database opening and WAL configuration.
- Browser AsyncStorage fallback for web preview.
- Ordered schema migrations through the current database version.
- Who's Who item CRUD and soft archiving.
- Learning exposure and review scheduling.
- Local settings.
- Session start, event persistence, normal finish, and abandonment.
- Native sync-queue inserts.
- Current transitional inline controller-state update during native session finish.

Rules for changes here:

- Persist every telemetry event immediately.
- Keep event history append-only.
- Use stable item IDs.
- Preserve the existing session-end and outbox path.
- Do not make Supabase authoritative over local controller state.

### `src/storage/types.ts`

Storage-specific types:

- `ReviewResult`.
- `WhosWhoItem` and `WhosWhoDraft`.
- `StoredSession`.
- Browser `LocalSnapshot` shape.

Use `src/adaptive/types.ts` for shared adaptive/game contracts and this file for persistence-domain types.

### `src/storage/media.ts`

Photo selection and local persistence:

- Uses Expo Image Picker.
- Copies native images into the app document directory.
- Uses a browser data URI or picker URI fallback.

Remote media upload is not implemented here. Any future remote family-media path must follow the encrypted temporary-delivery and consent rules in `AGENTS.md` and `docs/supabase.md`.

### `src/storage/reminders.ts`

Who’s Who local reminder scheduling:

- Requests notification permissions when supported.
- Replaces the previous scheduled Who's Who reminder.
- Skips unsupported web and Expo Go paths without blocking local use.

General medicine, hydration, appointment, and activity reminders are not implemented yet.

## `docs/`: Product and Technical Contracts

```text
docs/
|-- CLAUDE.md
|-- PROJECT_CONTEXT.md
|-- GAMES.md
|-- producer_contract.md
|-- storage_contract.md
|-- sqlite_agent_context.md
|-- adaptive_controller_spec.md
`-- supabase.md
```

- `CLAUDE.md`
  - Product context, clinical framing, hard design rules, six-game scope, and target architecture.
  - Treat its patient-safety and product rules as authoritative.
- `PROJECT_CONTEXT.md`
  - Intended implementation map and future architecture notes.
  - Some sections describe directories that do not exist yet, such as `src/game`, `src/games`, `src/services/adaptive`, and `src/services/patient-metrics`. Treat those as planned destinations, not current paths.
- `GAMES.md`
  - Detailed design and MVP requirements for Song Circle, Day's Plan, Who's Who, Recipe, Packing, and Skill Transmission.
- `producer_contract.md`
  - Required event shapes and semantics from games to metrics/controller.
  - Defines controller-scoped games and dashboard-only games.
- `storage_contract.md`
  - Local SQLite schema, migration requirements, immediate event persistence, atomic session closing, and one-way outbox sync rules.
- `sqlite_agent_context.md`
  - SQLite implementation context and guidance for persistence work.
- `adaptive_controller_spec.md`
  - Adaptive controller behavior and configuration expectations.
- `supabase.md`
  - Supabase data model, access, sync, and patient-data lifecycle context.

When documents disagree with the code, resolve the discrepancy deliberately and update the relevant map/status document after the change.

## `supabase/`: Server-Side Functions

```text
supabase/
`-- functions/
    `-- create-care-circle/
        `-- index.ts
```

### `supabase/functions/create-care-circle/index.ts`

Supabase Edge Function for first-time guardian setup:

- Requires an Authorization header.
- Verifies the authenticated user.
- Validates patient display name and guardian relationship.
- Reuses an existing active patient link when one exists.
- Calls the server-side care-circle RPC with the service role client.
- Returns the patient ID to the app.

This is the only visible Edge Function currently in the repository. The event/session sync worker, dashboard query functions, and remote media delivery functions are not present.

## Data Flow

```text
Patient or caregiver UI
        |
        v
src/SaathiWorkflow.tsx
        |
        +--> src/components/      shared controls and audio
        +--> src/lib/supabase.ts   optional account/service access
        +--> src/storage/          local items, sessions, events, media, reminders
        |       |
        |       +--> SQLite on native devices
        |       `--> AsyncStorage snapshot on web preview
        |
        `--> src/adaptive/types.ts  canonical telemetry/controller contracts

Native local writes
        |
        v
sync_queue
        |
        `--> future one-way Supabase outbox worker
```

The device remains authoritative for patient activity data and controller state during normal operation. Supabase is a mirror and service layer, not a replacement for local persistence.

## Where New Work Belongs

| Work | Current destination |
|---|---|
| New patient or caregiver screen | `src/SaathiWorkflow.tsx` initially; extract a feature module as complexity grows |
| Reusable button, input, notice, portrait, or list control | `src/components/ui.tsx` |
| Shared recording/playback behavior | `src/components/audio.tsx` |
| New game-specific implementation | Create a dedicated game directory under `src/` and keep event production close to that game |
| Game event/session types | `src/adaptive/types.ts` |
| Metrics extraction or adaptive controller | Add dedicated modules under `src/adaptive/` or the agreed future adaptive service boundary |
| SQLite schema, migrations, sessions, events, outbox | `src/storage/localStore.ts` and related storage modules |
| Photo/audio device persistence | `src/storage/media.ts` |
| Local notifications | `src/storage/reminders.ts` or a new reminder module if scope expands |
| Bundled language/content metadata | `src/data/seed.js` until a content module is introduced |
| Supabase client configuration | `src/lib/supabase.ts` |
| Supabase server function | `supabase/functions/<function-name>/index.ts` |
| Product or contract rule | Relevant file under `docs/`, plus `AGENTS.md` when it changes repository-wide rules |

## Current Missing Areas

The following are planned but not represented by complete current modules:

- Day's Plan.
- Recipe.
- Song Circle.
- Packing.
- Skill Transmission.
- Dedicated adaptive extractors and controller.
- Patient metrics and caregiver dashboard.
- Outbox sync worker.
- Remote family-media delivery.
- General reminders.
- Automated tests.
- Full language localization and voice prompt packs.
- Caregiver PIN or biometric protection.

For the detailed implementation state and recommended build order, see `IMPLEMENTATION_STATUS.md`.

## Common Commands

Install dependencies before running project commands:

```text
npm install
```

Then use:

```text
npm run start       # Expo development server
npm run web         # Expo web preview
npm run typecheck   # TypeScript check without emitting files
npm test            # Currently a placeholder; no real test suite yet
```

For native/device verification, follow `DEVICE-TEST.md` and the Expo/EAS configuration in `app.json` and `eas.json`.
