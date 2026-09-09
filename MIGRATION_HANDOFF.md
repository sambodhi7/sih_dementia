# Saathi Migration Handoff

**Date:** 2026-09-09
**Destination:** `sih_dementia`
**Source:** `sih26`
**Status:** Core adaptive, metrics, and local-storage integration completed; several production integrations remain.

## Purpose

Useful completed functionality from `sih26` was adapted into `sih_dementia`. The destination architecture remains the authority. The old repository was treated as read-only and no runtime dependency on it was introduced.

The final application is intended to continue from `sih_dementia` after `sih26` is removed.

## Architecture Decision

The destination structure was preserved:

```text
src/
├── SaathiWorkflow.tsx
├── adaptive/              # compatibility exports and shared facade
├── components/
├── lib/
├── services/
│   ├── adaptive/
│   └── patient-metrics/
└── storage/
```

The active implementation lives under `src/services` and `src/storage`. The canonical adaptive contracts live in `src/services/adaptive/types.ts`.

## Functionality Migrated

### Adaptive controller

Migrated and adapted the pure TypeScript adaptive controller:

- calibration for the first five sessions;
- stochastic difficulty tracking;
- hint-time tracking;
- deadband and minimum sample safety rules;
- bounded and asymmetric updates;
- abandonment freeze behavior;
- per-patient, per-game controller state;
- controller registry for:
  - `days_plan`;
  - `whos_who`;
  - `recipe`.

Files:

- `src/services/adaptive/types.ts`
- `src/services/adaptive/tracker.ts`
- `src/services/adaptive/safety.ts`
- `src/services/adaptive/calibrate.ts`
- `src/services/adaptive/extract.ts`
- `src/services/adaptive/controller.ts`
- `src/services/adaptive/registry.ts`
- `src/services/adaptive/index.ts`

The controller does not include Song Circle, Packing, or Skill Transmission.

### Patient metrics

Migrated the event-to-outcome and patient aggregation pipeline:

```text
raw GameEvent records
        ↓
per-game extractor
        ↓
SessionOutcome
        ↓
patient-level aggregation
        ↓
PatientProfileMetrics
```

Files:

- `src/services/patient-metrics/types.ts`
- `src/services/patient-metrics/common.ts`
- `src/services/patient-metrics/extractors.ts`
- `src/services/patient-metrics/aggregate.ts`
- `src/services/patient-metrics/index.ts`

Metrics are rebuilt from persisted raw events. Companion-assisted sessions do not contribute latency samples.

### Local SQLite and browser storage

The destination keeps one local persistence boundary with a browser fallback.

Files:

- `src/storage/db.ts`
  - SQLite connection;
  - WAL mode;
  - foreign keys;
  - web snapshot access;
  - serialized web writes.

- `src/storage/migrations.ts`
  - ordered `PRAGMA user_version` migrations;
  - initial schema;
  - companion session field;
  - Who's Who details and settings.

- `src/storage/items.ts`
  - Who's Who item CRUD;
  - archive/restore behavior;
  - learning exposure;
  - spaced review scheduling;
  - local settings.

- `src/storage/sessions.ts`
  - session creation;
  - immediate raw event writes;
  - session completion;
  - outcome extraction;
  - controller-state persistence;
  - abandonment;
  - reconstruction of session records from raw events.

- `src/storage/controllerState.ts`
  - controller-state reads.

- `src/storage/patientMetrics.ts`
  - patient metric reads.

- `src/storage/sync.ts`
  - sync queue types;
  - enqueue;
  - pending-row reads;
  - source-record reads;
  - acknowledgement marking;
  - generic pending-row drain callback.

- `src/storage/localStore.ts`
  - compatibility barrel only;
  - existing callers should gradually import focused modules directly.

### Who's Who integration

The existing destination Who's Who workflow was preserved. It now records:

- `prompt_shown`;
- every tap attempt;
- actual screen coordinates where available;
- incremental hint levels;
- audio replay events;
- abandonment events.

The workflow continues to use stable memory IDs, local photos/audio, learning exposure, recall, review scheduling, and calm patient-facing feedback.

The active workflow is in `src/SaathiWorkflow.tsx`.

### Supabase

The existing Supabase authentication and care-circle Edge Function were preserved. Supabase remains a service/mirror layer; it is not the local source of truth.

The app uses:

- `EXPO_PUBLIC_SUPABASE_URL`;
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Do not place a service-role key in the Expo app or browser bundle.

## Storage Tables

Native SQLite currently contains:

- `items`;
- `sessions`;
- `events`;
- `session_outcomes`;
- `controller_state`;
- `controller_state_changed`;
- `sync_queue`;
- `whos_who_details`;
- `app_settings`.

Raw events are append-only in `events.payload` as JSON. Extracted per-session outcomes are stored in `session_outcomes`. Patient-level metrics are calculated from durable raw events and are not stored as a separate local table yet.

The browser fallback stores equivalent data in the AsyncStorage snapshot under `saathi.local.v1`.

## Import Rules

New application code should import from focused modules:

```ts
import type { GameEvent } from './services/adaptive/types'
import { onSessionEnd } from './services/adaptive'
import { extractSessionOutcome } from './services/patient-metrics'
import { appendEvent } from './storage/sessions'
import { readControllerState } from './storage/controllerState'
import { readPatientProfileMetrics } from './storage/patientMetrics'
```

Do not create another `GameEvent`, `ControllerState`, `SessionOutcome`, or metrics type definition.

`src/adaptive/types.ts` and `src/adaptive/index.ts` exist only for compatibility with older imports. Prefer `src/services` for new code.

## Verification Completed

The following commands currently pass from `sih_dementia`:

```powershell
npm run typecheck
npm test
```

The focused adaptive integration test covers:

- evening scoring;
- morning non-scoring behavior;
- companion latency exclusion;
- calibration advancement;
- abandonment freeze calculation;
- patient metric aggregation.

No `sih26` or `sih-26` runtime references were found in the destination.

## Known Gaps

These items are not yet complete and must be addressed before declaring the migration production-complete.

### 1. Abandoned-session controller persistence

`abandonWhosWhoSession` writes the abandonment event and closes the session, but it does not currently persist the frozen controller state and trajectory returned by `onSessionEnd`.

Required follow-up:

- run the controller freeze for the abandoned event;
- persist `controller_state`;
- insert `controller_state_changed`;
- enqueue the controller records;
- keep session abandonment atomic where practical.

### 2. Sync worker and server endpoint

`src/storage/sync.ts` provides the local outbox primitives, but no active worker calls `drainPending`.

The Supabase contract expects a dedicated authenticated `sync-device-outbox` Edge Function. That function and its deployed server schema are not present in the current checkout.

Required follow-up:

- add the server-side sync Edge Function;
- validate device ownership, event sequence, session relationships, and idempotency;
- connect a background/foreground-safe client drain;
- mark queue rows sent only after server acknowledgement;
- never write controller state from server back to the device during routine sync.

### 3. Day's Plan and Recipe producers

Their extractors and controller registry entries exist, but the destination UI currently exposes only Who's Who. Day's Plan and Recipe need real session producers before their end-to-end pipelines can be verified.

Day's Plan producers must always set `phase` to `morning` or `evening`.

### 4. Native SQLite integration tests

The current automated tests are pure TypeScript integration tests. Add device/runtime tests for:

- migrations from each schema version;
- WAL and foreign-key setup;
- immediate event persistence;
- stable per-session sequence numbers;
- atomic session completion;
- append-only event history;
- outbox enqueue and acknowledgement;
- browser fallback snapshot behavior.

### 5. Web phase preservation

The browser session snapshot path should preserve `phase` when reconstructing `GameSession`, matching native SQLite behavior. This matters when Day's Plan is implemented.

### 6. Full Who's Who hint UX

Telemetry levels now increment from 1 through 4, but the patient-facing UI does not yet display a complete visual/audio hint ladder for every level. Complete the UI and verify that `hintLevelAtTap` always matches the visible hint.

### 7. Supabase configuration for local preview

Guardian sign-in displays the unavailable message when `.env` is missing or contains placeholders. Configure a local `.env` with the public Supabase URL and publishable key before testing authentication.

Never use the Supabase service-role key in the app.

## Recommended Next Order

1. Fix abandoned-session controller persistence.
2. Preserve Day's Plan phase in web snapshots.
3. Add native SQLite/storage integration tests.
4. Implement and deploy `sync-device-outbox`.
5. Add foreground/background outbox draining.
6. Build Day's Plan and Recipe producers.
7. Complete the Who's Who hint ladder UI.
8. Replace remaining compatibility imports with focused module imports.
9. Re-run `npm run typecheck` and `npm test` after each major step.

## Final Principle

Keep `sih_dementia` as the destination architecture. Use `sih26` only as a read-only implementation reference. Extend the existing destination boundaries instead of copying the old repository structure wholesale.
