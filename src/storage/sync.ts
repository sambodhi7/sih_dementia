import type * as SQLite from 'expo-sqlite';

import { getDb, makeId } from './db';

export type SyncableTable = 'sessions' | 'events' | 'session_outcomes' | 'controller_state' | 'controller_state_changed' | 'skill_transmission_completions';

export type SyncQueueRow = {
  id: string;
  table_name: SyncableTable;
  row_id: string;
  status: 'pending' | 'sent';
  created_at: number;
};

export async function enqueue(db: SQLite.SQLiteDatabase, table: SyncableTable, rowId: string, at: number = Date.now()): Promise<void> {
  await db.runAsync('INSERT INTO sync_queue (id, table_name, row_id, status, created_at) VALUES (?, ?, ?, \'pending\', ?)', [makeId(), table, rowId, at]);
}

export async function listPending(limit = 200): Promise<SyncQueueRow[]> {
  return (await getDb()).getAllAsync<SyncQueueRow>('SELECT id, table_name, row_id, status, created_at FROM sync_queue WHERE status = \'pending\' ORDER BY created_at ASC LIMIT ?', [limit]);
}

export async function readSyncRecord(row: SyncQueueRow): Promise<Record<string, unknown> | null> {
  const db = await getDb();
  const queries: Record<SyncableTable, string> = {
    sessions: 'SELECT * FROM sessions WHERE id = ?',
    events: 'SELECT * FROM events WHERE id = ?',
    session_outcomes: 'SELECT * FROM session_outcomes WHERE session_id = ?',
    controller_state: 'SELECT * FROM controller_state WHERE patient_id || \':\' || game_id = ?',
    controller_state_changed: 'SELECT * FROM controller_state_changed WHERE id = ?',
    skill_transmission_completions: 'SELECT * FROM skill_transmission_completions WHERE id = ?',
  };
  return (await db.getFirstAsync<Record<string, unknown>>(queries[row.table_name], [row.row_id])) ?? null;
}

export async function markSent(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(', ');
  await (await getDb()).runAsync(`UPDATE sync_queue SET status = 'sent' WHERE id IN (${placeholders})`, ids);
}

export async function drainPending(upload: (row: SyncQueueRow, record: Record<string, unknown>) => Promise<void>, limit = 200): Promise<number> {
  const pending = await listPending(limit);
  const acknowledged: string[] = [];
  for (const row of pending) {
    const record = await readSyncRecord(row);
    if (!record) continue;
    await upload(row, record);
    acknowledged.push(row.id);
  }
  await markSent(acknowledged);
  return acknowledged.length;
}
