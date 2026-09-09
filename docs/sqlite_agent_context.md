# Task: Implement on-device SQLite storage layer — Saathi

You are implementing the persistence layer for a React Native + Expo app.
Everything you need is below — the type contract, the schema, the write
rules, and the file list. Do not invent additional tables, do not add fields
not listed here, do not guess at anything marked "decided" below — those are
final.

---

## 0. Non-negotiables (read first)

1. **The device is the source of truth.** Supabase (if/when wired) is a
   read-mirror for a caregiver dashboard, not a database of record.
2. **No in-memory event buffering, ever.** Every event is written the instant
   it happens, as its own `INSERT`. If the app is killed mid-session, nothing
   already written is lost.
3. **Session-end is one atomic transaction.** Four writes, all or nothing.
4. **`controller_state` syncs device → server only.** Nothing ever writes it
   back down to the device as part of routine sync.
5. **Never `DELETE` or `DROP`.** Event history is permanent; it's the only
   thing that can regenerate outcomes if a scoring bug is found later.

---

## 1. Engine

`expo-sqlite`. Enable WAL mode on database open.

---

## 2. Canonical types (already finalized — maintained in `src/services/adaptive/types.ts`)

```ts
export type GameId = 'days_plan' | 'whos_who' | 'recipe'

export type GameEvent =
  | { type: 'prompt_shown'; itemId: string; at: number }
  | {
      type: 'tap'
      itemId: string
      correct: boolean
      at: number
      x: number
      y: number
      hintLevelAtTap: 0 | 1 | 2 | 3 | 4
      solvedUnassisted: boolean
      sequenceViolation?: boolean   // recipe only
    }
  | { type: 'hint_shown'; itemId: string; level: number; at: number }
  | { type: 'audio_replayed'; itemId: string; at: number }
  | { type: 'abandoned'; at: number }

export type GameSession = {
  gameId: GameId
  startedAt: number
  phase?: 'morning' | 'evening'      // days_plan only
  companionPresent?: boolean         // dashboard metadata only — see §6
}

export type SessionRecord = {
  session: GameSession
  events: GameEvent[]
}

export type SessionOutcome = {
  scoredActions: number
  successRate: number | null
  unassistedRate: number | null
  medianLatencySeconds: number | null
  wasAbandoned: boolean
  unassistedLatencies: number[]
  successfulScoredActions: number
  unassistedScoredActions: number
}

export type ControllerState = {
  patientId: string
  gameId: GameId
  difficulty: number
  hintTimeSeconds: number
  sessionsObserved: number
  latencySamples: number[]     // capped at 40
  updatedAt: number
}

export type GameConfig = {
  gameId: GameId
  usesDifficulty: boolean
  usesHintTiming: boolean
  baseHintSeconds: number
  minHintSeconds: number
  maxHintSeconds: number
  startingDifficulty: number
}

export type NextConfig = {
  difficulty: number
  hintTimeSeconds: number | null
  factor: number
  source: 'calibration' | 'tracking' | 'frozen'
}
```

**Song circle, Packing, Skill transmission are NOT in `GameId`.** They are
dashboard-only games — they write `sessions` + `events` and stop. They never
call `onSessionEnd` and never get a `session_outcomes` or `controller_state`
row. Only `days_plan`, `whos_who`, `recipe` go through the controller.

---

## 3. Schema

```sql
CREATE TABLE items (
  id TEXT PRIMARY KEY,           -- stable itemId, matches producer contract
  patient_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  label TEXT,
  photo_uri TEXT,
  audio_uri TEXT,                -- family-recorded name/label, if present
  created_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,           -- client-generated UUID
  patient_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,   -- from the FIRST prompt_shown event, not mount time
  ended_at INTEGER,
  phase TEXT,                    -- 'morning' | 'evening', days_plan only
  abandoned INTEGER NOT NULL DEFAULT 0
  -- companion_present added in migration 2, see §6
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,          -- monotonic per session, assigned inside the INSERT via subquery
  type TEXT NOT NULL,
  payload TEXT NOT NULL,         -- full GameEvent as JSON, untouched
  at INTEGER NOT NULL
);
CREATE INDEX idx_events_session ON events(session_id, seq);

CREATE TABLE session_outcomes (
  session_id TEXT PRIMARY KEY REFERENCES sessions(id),
  scored_actions INTEGER NOT NULL,
  success_rate REAL,
  unassisted_rate REAL,
  median_latency_seconds REAL,
  was_abandoned INTEGER NOT NULL,
  successful_scored_actions INTEGER NOT NULL,
  unassisted_scored_actions INTEGER NOT NULL,
  unassisted_latencies TEXT NOT NULL   -- JSON array
);

CREATE TABLE controller_state (
  patient_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  difficulty REAL NOT NULL,
  hint_time_seconds REAL NOT NULL,
  sessions_observed INTEGER NOT NULL,
  latency_samples TEXT NOT NULL,       -- JSON array, capped at 40
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (patient_id, game_id)
);

CREATE TABLE controller_state_changed (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  game_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  difficulty REAL NOT NULL,
  hint_time_seconds REAL,
  source TEXT NOT NULL,          -- 'calibration' | 'tracking' | 'frozen'
  at INTEGER NOT NULL
);
CREATE INDEX idx_ctrl_traj ON controller_state_changed(patient_id, game_id, at);

CREATE TABLE sync_queue (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'sent'
  created_at INTEGER NOT NULL
);
```

Notes:
- `events.payload` is raw `GameEvent` JSON. Do not decompose the union into columns.
- No song-recording table. Song circle's family recordings are `items` rows
  (`id`, `patient_id`, `game_id`, `label` = singer name, `audio_uri`,
  `created_at`). No duration field — not in scope, do not add it.
- `latency_samples` is JSON inside `controller_state`. No separate table.

---

## 4. File layout

```
src/storage/
  db.ts                -- open connection, WAL pragma
  migrations.ts        -- PRAGMA user_version pattern, ordered migration list
  sessions.ts           -- session + event writes, per-event INSERT
  items.ts              -- items table CRUD
  controllerState.ts    -- controller_state recovery/read helpers
  sync.ts               -- outbox: enqueue / listPending / markSent / drain

src/services/
  adaptive/             -- on-device controller, extractor, calibration
  patient-metrics/      -- longitudinal dashboard metrics
```

Migration 1 = the schema in §3 exactly, transcribed 1:1 so it diffs cleanly
against this doc. Migration 2 = adds `companion_present` (see §6) — keep it
as a separate migration, not folded into migration 1, so the migration
harness is actually exercised now rather than left untested until a change
that matters under time pressure.

---

## 5. Write rules

**Every `GameEvent` gets its own `INSERT` at the moment it's emitted.** No
array, no flush-at-end. Serialize writes through a promise tail (or
equivalent) so `seq` stays monotonic and events can't interleave out of
order. A write failure should log and must not crash the game screen.

`seq` should be assigned inside the `INSERT` itself via a subquery
(`MAX(seq)+1 WHERE session_id = ?`), not tracked in a JS counter — a crash
between "read counter" and "write row" must not be able to produce a
duplicate or skipped `seq`.

**Session-end wraps exactly four writes in one transaction:**
1. Insert `session_outcomes`
2. Upsert `controller_state`
3. Insert `controller_state_changed`
4. Enqueue rows 2 and 3 (and the session + its events) into `sync_queue`

Dashboard-only games (song circle, packing, skill) take a shorter path:
write `sessions` + `events`, then return — no `session_outcomes`, no
`controller_state` touch, no `controller_state_changed` row.

`abandoned` is derived from the presence of an `abandoned` event in the
session's event stream, not from a settable flag — a flag can be forgotten
to set, an event either happened or didn't.

---

## 6. `companionPresent` — decided, implement exactly this

- Add `companion_present INTEGER` to `sessions` via migration 2.
- **It is dashboard metadata only.** It does not gate calibration, does not
  gate the controller, does not exclude any session from
  `latencySamples`. Every session's unassisted-correct latencies go into
  the array regardless of companion presence.
- Do not write any code path that branches controller behavior on this
  field. If you find yourself doing that, stop — it's out of scope for
  this pass and was explicitly designed out.

---

## 7. Sync (outbox pattern)

- A background worker drains `sync_queue` when connectivity is available:
  read `pending` rows, upsert the referenced record to Supabase keyed on the
  client-generated UUID, mark `sent`.
- **Never sync by scanning for "recently modified" rows.** Device clocks on
  this hardware drift; the outbox table is the only reliable record of
  what still needs to go.
- `controller_state` sync is one-directional, device → server. A function
  to restore `controller_state` from server onto a device may exist, but
  it must have **zero callers from the sync/drain loop** — it's an explicit,
  separately-invoked recovery action only.

---

## 8. Migrations

Set up the `PRAGMA user_version` migration harness in the first pass, not
after. `companion_present` (§6) is the first real migration to run through
it — treat it as the test case that proves the harness works before any
migration that matters under time pressure needs it.

---

## 9. Explicitly out of scope for this pass

- Recipe solo/shared mode flag — no solo Recipe variant exists yet; don't
  add a column for it.
- Song circle duration — not in the event contract; don't smuggle it into
  the payload or add a field for it.
- Any code that branches on `companionPresent` beyond writing/reading the
  column.
- Supabase schema/RLS itself — this task is the SQLite side only.

---

## 10. Verify before calling this done

- `PRAGMA user_version` reaches target after fresh install.
- Migration 2 correctly adds `companion_present` on top of migration 1.
- `events.seq` is monotonic per session under concurrent/rapid writes.
- `controller_state` upserts in place (no duplicate rows per patient+game).
- FK enforcement is on (`PRAGMA foreign_keys = ON`) and `events.session_id`
  is enforced.
- No `DELETE` or `DROP` statement exists anywhere in the module.
- `restoreFromServer`-type function (if written) has zero callers from the
  drain loop.
