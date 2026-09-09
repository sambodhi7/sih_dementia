# Storage Contract — On-Device SQLite + Supabase Sync

**Audience:** whoever builds the persistence/sync layer.
**Purpose:** the device is the source of truth. Supabase is a mirror for the caregiver dashboard, not a database of record. This doc governs how events, session outcomes, and controller state get written locally and synced up — get this wrong and you can silently lose the one session that mattered, or roll a patient's controller state back weeks with no error thrown anywhere.

Read alongside `producer_contract.md` (event shapes) and the Supabase schema notes. This doc is about *where those events live on-device* and *how they leave the device*.

---

## 1. Engine

`expo-sqlite`. Enable **WAL mode** on open — writes must not block the UI thread, and game screens are writing on every tap.

---

## 2. The one rule everything else follows

**The device never loses a session, even if the app is killed mid-session.**

That means: no in-memory event buffering, no "flush at session end." Every `GameEvent` is written the instant it's emitted, as its own insert. If you buffer and the app is killed by the OS — which happens constantly on the low-end Android devices this ships on — the most clinically important session (the one where the patient abandoned) is the one you lose.

---

## 3. Tables

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
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  phase TEXT,                    -- 'morning' | 'evening', days_plan only
  abandoned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,           -- client-generated UUID
  session_id TEXT NOT NULL REFERENCES sessions(id),
  seq INTEGER NOT NULL,          -- monotonic per session, assigned at insert
  type TEXT NOT NULL,
  payload TEXT NOT NULL,         -- full GameEvent as JSON
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

- `events.payload` is the raw `GameEvent` JSON, untouched. Don't decompose the union into columns — five event shapes into one normalized table is more code and buys nothing, since nothing queries individual event fields at the SQL level.
- `latency_samples` lives as JSON inside `controller_state`. It's capped at 40, never queried directly. Giving it its own table is unnecessary weight.
- No `DELETE` anywhere in this schema, ever. See §7.

---

## 4. Session-end is one transaction

When `onSessionEnd` runs, four things happen and they happen together or not at all:

1. Insert `session_outcomes` row
2. Upsert `controller_state`
3. Insert `controller_state_changed` row
4. Enqueue rows 2 and 3 (and the session/events) into `sync_queue`

Wrap all four in a single SQLite transaction. If this isn't atomic, you can end up with a `controller_state` that advanced but no corresponding `controller_state_changed` row — which means the decline-detector's trajectory has a silent gap in it that looks identical to "no session happened," not "something failed." That's a bug you will not catch by looking at the dashboard; you'll only catch it by noticing the numbers don't add up weeks later.

---

## 5. Sync — outbox pattern only

A background worker drains `sync_queue` when connectivity is available: read pending rows, push the referenced records to Supabase as an upsert (client UUID as the conflict key), mark `sent`.

**Do not sync by scanning for "recently modified" rows.** Device clocks on cheap Android hardware drift and get reset; a modified-time scan will silently skip rows or resend the same row forever depending on which way the clock is wrong. The outbox table is the only reliable record of what still needs to go.

**Direction matters, and it's asymmetric:**

- `events`, `sessions`, `session_outcomes`, `controller_state_changed` → device to server, one-way, append-only on both ends.
- `controller_state` → device to server **only**. The server-side copy is a read-only mirror for the caregiver dashboard. **Nothing ever writes it back down to the device as part of routine sync.** If a stale server copy overwrites a device that has since moved on, the patient's difficulty and hint timing silently roll back, and there is no error to alert anyone — the app just starts behaving as if the patient were worse off than they are.
- Restoring `controller_state` from Supabase onto a device (e.g. device replaced, app reinstalled) is a deliberate, explicit recovery action the caregiver initiates — never an automatic part of the sync loop.

---

## 6. Migrations

Use the `PRAGMA user_version` pattern: an ordered array of migration functions, current version compared against target on app start, missing steps applied in order.

Set this up **before** shipping the first build, not after. Two fields are already known to be coming — `companionPresent` on sessions, and possibly a Recipe mode flag — and they'll be added to devices that already hold real session history. A migration path that doesn't exist yet means writing one under pressure against live data instead of testing it against a fixture.

---

## 7. Never delete events

If on-device storage becomes a real constraint, the policy is *sync-then-archive* (move to a colder table or export-and-clear only after confirmed sync), never delete outright.

The raw event log is the only thing that can regenerate `session_outcomes` if an extractor bug is found and fixed later — and Recipe's extractor is already known to need a fix. Losing raw events means a corrected extractor has nothing to re-run against, and every affected patient's history is stuck wrong permanently.

---

## 8. Common mistakes

- Buffering events in memory and writing at session end — loses abandoned sessions, which are the sessions you most need.
- Non-atomic session-end writes — produces controller state with no matching trajectory row.
- Syncing `controller_state` bidirectionally — a stale mirror can roll a patient's adaptation back with no visible error.
- Scanning by modified-time instead of using the outbox table — breaks under clock drift, which is routine on this hardware.
- Deleting old events to save space — destroys the only source that can re-derive corrected outcomes later.
- Shipping without a migration path — the schema is known to change before the patient-facing fields are even finalized.
