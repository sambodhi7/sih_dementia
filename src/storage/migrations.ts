import type * as SQLite from 'expo-sqlite';

export type Migration = {
  version: number;
  name: string;
  up: (db: SQLite.SQLiteDatabase) => Promise<void>;
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, game_id TEXT NOT NULL, label TEXT, photo_uri TEXT, audio_uri TEXT, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, game_id TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, phase TEXT, abandoned INTEGER NOT NULL DEFAULT 0);
        CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id), seq INTEGER NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id, seq);
        CREATE TABLE IF NOT EXISTS session_outcomes (session_id TEXT PRIMARY KEY REFERENCES sessions(id), scored_actions INTEGER NOT NULL, success_rate REAL, unassisted_rate REAL, median_latency_seconds REAL, was_abandoned INTEGER NOT NULL, successful_scored_actions INTEGER NOT NULL, unassisted_scored_actions INTEGER NOT NULL, unassisted_latencies TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS controller_state (patient_id TEXT NOT NULL, game_id TEXT NOT NULL, difficulty REAL NOT NULL, hint_time_seconds REAL NOT NULL, sessions_observed INTEGER NOT NULL, latency_samples TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (patient_id, game_id));
        CREATE TABLE IF NOT EXISTS controller_state_changed (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, game_id TEXT NOT NULL, session_id TEXT NOT NULL REFERENCES sessions(id), difficulty REAL NOT NULL, hint_time_seconds REAL, source TEXT NOT NULL, at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_ctrl_traj ON controller_state_changed(patient_id, game_id, at);
        CREATE TABLE IF NOT EXISTS sync_queue (id TEXT PRIMARY KEY, table_name TEXT NOT NULL, row_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL);
      `);
    },
  },
  {
    version: 2,
    name: 'sessions.companion_present',
    up: async (db) => {
      await db.execAsync('ALTER TABLE sessions ADD COLUMN companion_present INTEGER NOT NULL DEFAULT 0;');
    },
  },
  {
    version: 3,
    name: 'whos_who.details_and_settings',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS whos_who_details (item_id TEXT PRIMARY KEY REFERENCES items(id), relationship TEXT NOT NULL, personal_note TEXT NOT NULL DEFAULT '', note_audio_uri TEXT, learning_only INTEGER NOT NULL DEFAULT 0, archived_at INTEGER, learned_at INTEGER, review_step INTEGER NOT NULL DEFAULT -1, due_at INTEGER NOT NULL, consecutive_support INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_whos_due ON whos_who_details(due_at, paused, archived_at);
        CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `);
    },
  },
  {
    version: 4,
    name: 'days_plan.items',
    up: async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS days_plan_items (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL, time TEXT NOT NULL, title TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL);
        CREATE INDEX IF NOT EXISTS idx_days_plan_patient ON days_plan_items(patient_id, updated_at);
      `);
    },
  },
  {
    version: 5,
    name: 'days_plan.archive_removed_items',
    up: async (db) => {
      await db.execAsync('ALTER TABLE days_plan_items ADD COLUMN archived_at INTEGER;');
    },
  },
];

export const TARGET_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function migrate(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (const migration of MIGRATIONS.filter((entry) => entry.version > current).sort((a, b) => a.version - b.version)) {
    await db.withTransactionAsync(async () => {
      await migration.up(db);
    });
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
  }
  return TARGET_VERSION;
}
