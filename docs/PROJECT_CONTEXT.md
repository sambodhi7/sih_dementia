# Saathi Project Context

This document is the current implementation map for the prototype. Product and clinical rules remain in `CLAUDE.md`; this file records where those rules are implemented and which parts are still planned.

## Canonical Layout

```text
App.tsx                         development entry point
src/game/                       render contract for games
src/games/                      implemented game modules
src/content/                    illustrative regional demo content
src/ui/                         shared patient-facing controls
src/storage/                    SQLite database, migrations, sessions, items, sync
src/services/adaptive/          on-device controller and event extraction
src/services/patient-metrics/  derived profile and dashboard metrics
docs/                           product, storage, game, and controller contracts
```

There is no separate `backend/` copy of the adaptive or patient-metrics logic. Both services are TypeScript modules used by the app and can run offline.

## Implemented Today

- SQLite opens in WAL mode, enables foreign keys, and applies ordered migrations.
- Game events are written immediately to SQLite through a serialized promise tail.
- Session completion writes outcomes, controller state, trajectory state, and sync-queue rows atomically for controller games.
- Song Circle is wired through `GameHost` as a dashboard-only game. It records sessions and events but does not enter the adaptive controller.
- The adaptive controller has calibration, safety bounds, tracking, abandonment freeze, per-game registry, and pure event extraction.
- Controller state is read per patient and per controller-scoped game before the game renders.
- Patient metrics reconstruct sessions from SQLite's raw event log and calculate independent performance, support needed, latency, variability, activity, and a basic trend.
- The shared event contract includes hint level, unassisted solving, sequence violations, abandonment, and stable item IDs.
- The adaptive and patient-metrics integration tests plus TypeScript check run through `npm test`.

All demo content is illustrative. It is not real patient or family data.

## Controller Boundary

Controller-scoped games are exactly:

- `days_plan`
- `whos_who`
- `recipe`

Dashboard-only games are exactly:

- `song-circle`
- `packing`
- `skill-transmission`

Dashboard-only games may write sessions and events, but they do not receive a `GameId`, create `session_outcomes`, or update `controller_state`.

## Data Flow

```text
GameModule
  -> GameEvent
  -> useGameSession
  -> SQLite events
  -> session end reads the persisted event log
  -> src/services/adaptive extracts and updates controller state
  -> src/services/patient-metrics derives dashboard metrics
  -> sync outbox mirrors device records to the server
```

The device is the source of truth. Raw photos and audio stay on-device. Sync is an optimization and must never write routine controller state back down to the device.

## Known Gaps

- The repository currently contains only Song Circle as a renderable game module. The other five game designs are documented but are not yet implemented in `src/games`.
- The app entry point is still a development harness with a swatch screen and Song Circle; patient login, home, reminders, caregiver dashboard, and ASHA views are documented but not implemented.
- Voice output and family recordings are represented by content fields, but the demo pack has no audio URIs yet.
- The adaptive controller and patient-metrics reader are wired at the host boundary, but the current default app mounts only Song Circle, which is dashboard-only. Controller-game screens still need to pass the correct Day's Plan phase and their complete producer telemetry before the stochastic loop runs in the default demo.
- Patient metrics now have a SQLite read boundary but do not yet have a dashboard screen or server sync consumer.
- The current patient-metrics trend is a simple first/last success-rate comparison. The clinical design calls for a multi-metric rolling four-week referral signal, never a diagnosis.
- The current test command covers adaptive and patient-metrics domain paths, not device-level SQLite migration or concurrency behavior.

These are implementation gaps, not alternate architecture decisions. New work should extend the canonical folders above and update this document when a gap closes.
