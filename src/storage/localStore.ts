import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

import type { GameEvent, SessionOutcome } from '../adaptive/types';
import type { LocalSnapshot, ReviewResult, StoredSession, WhosWhoDraft, WhosWhoItem } from './types';

const DATABASE_NAME = 'saathi-local.db';
const WEB_KEY = 'saathi.local.v1';
export const reviewIntervals = [30_000, 60_000, 120_000, 240_000, 480_000, 86_400_000, 259_200_000, 604_800_000, 1_209_600_000];

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let webSnapshot: LocalSnapshot | null = null;
let writeTail: Promise<void> = Promise.resolve();

async function webStorage() {
  // Expo Go does not include the legacy AsyncStorage native module. Loading it
  // only for the browser preview keeps Android on SQLite from the first import.
  const module = await import('@react-native-async-storage/async-storage');
  return module.default;
}

const emptySnapshot = (): LocalSnapshot => ({ items: [], sessions: [], events: [], outcomes: [], settings: {} });
const makeId = () => Crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const asBool = (value: unknown) => Boolean(value);

async function nativeDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      const version = versionRow?.user_version ?? 0;
      if (version < 1) {
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
          PRAGMA user_version = 1;
        `);
      }
      if (version < 2) await db.execAsync('ALTER TABLE sessions ADD COLUMN companion_present INTEGER NOT NULL DEFAULT 0; PRAGMA user_version = 2;');
      if (version < 3) {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS whos_who_details (item_id TEXT PRIMARY KEY REFERENCES items(id), relationship TEXT NOT NULL, personal_note TEXT NOT NULL DEFAULT '', note_audio_uri TEXT, learning_only INTEGER NOT NULL DEFAULT 0, archived_at INTEGER, learned_at INTEGER, review_step INTEGER NOT NULL DEFAULT -1, due_at INTEGER NOT NULL, consecutive_support INTEGER NOT NULL DEFAULT 0, paused INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
          CREATE INDEX IF NOT EXISTS idx_whos_due ON whos_who_details(due_at, paused, archived_at);
          CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          PRAGMA user_version = 3;
        `);
      }
      return db;
    })();
  }
  return databasePromise;
}

async function loadWeb() {
  if (!webSnapshot) {
    try { webSnapshot = JSON.parse((await (await webStorage()).getItem(WEB_KEY)) ?? '') as LocalSnapshot; } catch { webSnapshot = emptySnapshot(); }
  }
  return webSnapshot;
}

async function saveWeb() { await (await webStorage()).setItem(WEB_KEY, JSON.stringify(webSnapshot ?? emptySnapshot())); }
function queuedWrite(work: () => Promise<void>) { writeTail = writeTail.then(work).catch(() => undefined); return writeTail; }

function itemFromRow(row: Record<string, unknown>): WhosWhoItem {
  return { id: String(row.id), patientId: String(row.patient_id), name: String(row.label ?? ''), relationship: String(row.relationship ?? ''), personalNote: String(row.personal_note ?? ''), photoUri: (row.photo_uri as string | null) ?? null, nameAudioUri: (row.audio_uri as string | null) ?? null, noteAudioUri: (row.note_audio_uri as string | null) ?? null, learningOnly: asBool(row.learning_only), archivedAt: (row.archived_at as number | null) ?? null, learnedAt: (row.learned_at as number | null) ?? null, reviewStep: Number(row.review_step ?? -1), dueAt: Number(row.due_at ?? Date.now()), consecutiveSupport: Number(row.consecutive_support ?? 0), paused: asBool(row.paused), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at ?? row.created_at) };
}

export async function initializeLocalStore(seedItems: Array<Partial<WhosWhoItem>> = []) {
  if (Platform.OS === 'web') {
    const snapshot = await loadWeb();
    if (!snapshot.items.length && seedItems.length) {
      const now = Date.now();
      snapshot.items = seedItems.map((item, index) => ({ id: item.id ?? `demo-memory-${index + 1}`, patientId: item.patientId ?? 'local-demo-patient', name: item.name ?? '', relationship: item.relationship ?? '', personalNote: item.personalNote ?? '', photoUri: item.photoUri ?? null, nameAudioUri: null, noteAudioUri: null, learningOnly: false, archivedAt: null, learnedAt: null, reviewStep: -1, dueAt: now, consecutiveSupport: 0, paused: false, createdAt: now, updatedAt: now }));
      await saveWeb();
    }
    return;
  }
  const db = await nativeDatabase();
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE game_id = ?', ['whos_who']);
  if ((count?.count ?? 0) === 0) for (let index = 0; index < seedItems.length; index += 1) {
    const item = seedItems[index];
    await saveWhosWhoItem(item.patientId ?? 'local-demo-patient', { name: item.name ?? '', relationship: item.relationship ?? '', personalNote: item.personalNote ?? '', photoUri: item.photoUri ?? null, nameAudioUri: null, noteAudioUri: null, learningOnly: false }, item.id ?? `demo-memory-${index + 1}`);
  }
}

export async function listWhosWhoItems(includeArchived = false) {
  if (Platform.OS === 'web') return (await loadWeb()).items.filter((item) => includeArchived || !item.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
  const db = await nativeDatabase();
  const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT items.*, whos_who_details.* FROM items JOIN whos_who_details ON whos_who_details.item_id = items.id WHERE items.game_id = 'whos_who' ${includeArchived ? '' : 'AND whos_who_details.archived_at IS NULL'} ORDER BY items.label COLLATE NOCASE`);
  return rows.map(itemFromRow);
}

export async function saveWhosWhoItem(patientId: string, draft: WhosWhoDraft, existingId?: string) {
  const id = existingId ?? makeId(); const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => { const snapshot = await loadWeb(); const existing = snapshot.items.find((item) => item.id === id); const item: WhosWhoItem = { id, patientId, ...draft, archivedAt: existing?.archivedAt ?? null, learnedAt: existing?.learnedAt ?? null, reviewStep: existing?.reviewStep ?? -1, dueAt: existing?.dueAt ?? now, consecutiveSupport: existing?.consecutiveSupport ?? 0, paused: existing?.paused ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now }; snapshot.items = existing ? snapshot.items.map((entry) => entry.id === id ? item : entry) : [...snapshot.items, item]; await saveWeb(); }); return id;
  }
  const db = await nativeDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT INTO items (id, patient_id, game_id, label, photo_uri, audio_uri, created_at) VALUES (?, ?, 'whos_who', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, photo_uri = excluded.photo_uri, audio_uri = excluded.audio_uri`, [id, patientId, draft.name, draft.photoUri, draft.nameAudioUri, now]);
    await db.runAsync(`INSERT INTO whos_who_details (item_id, relationship, personal_note, note_audio_uri, learning_only, due_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET relationship=excluded.relationship, personal_note=excluded.personal_note, note_audio_uri=excluded.note_audio_uri, learning_only=excluded.learning_only, updated_at=excluded.updated_at`, [id, draft.relationship, draft.personalNote, draft.noteAudioUri, draft.learningOnly ? 1 : 0, now, now]);
  });
  return id;
}

export async function archiveWhosWhoItem(id: string, archive = true) {
  const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.items = snapshot.items.map((item) => item.id === id ? { ...item, archivedAt: archive ? now : null, updatedAt: now } : item); await saveWeb(); }); return; }
  const db = await nativeDatabase(); await db.runAsync('UPDATE whos_who_details SET archived_at = ?, updated_at = ? WHERE item_id = ?', [archive ? now : null, now, id]);
}

export async function markLearningExposure(id: string) {
  const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.items = snapshot.items.map((item) => item.id === id ? { ...item, learnedAt: item.learnedAt ?? now, dueAt: now, updatedAt: now } : item); await saveWeb(); }); return; }
  const db = await nativeDatabase(); await db.runAsync('UPDATE whos_who_details SET learned_at = COALESCE(learned_at, ?), due_at = ?, updated_at = ? WHERE item_id = ?', [now, now, now, id]);
}

export async function applyReviewResult(id: string, result: ReviewResult) {
  const now = Date.now();
  const update = (item: WhosWhoItem): WhosWhoItem => {
    const consecutiveSupport = result === 'independent' ? 0 : item.consecutiveSupport + 1;
    const paused = result === 'distress' && consecutiveSupport >= 3;
    const reviewStep = result === 'independent' ? Math.min(item.reviewStep + 1, reviewIntervals.length - 1) : result === 'supported' ? Math.max(item.reviewStep - 1, 0) : Math.max(item.reviewStep - 1, -1);
    const delay = result === 'incorrect' || result === 'distress' ? reviewIntervals[0] : reviewIntervals[Math.max(reviewStep, 0)];
    return { ...item, learnedAt: item.learnedAt ?? now, reviewStep, dueAt: now + delay, consecutiveSupport, paused, updatedAt: now };
  };
  if (Platform.OS === 'web') { let saved: WhosWhoItem | null = null; await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.items = snapshot.items.map((item) => { if (item.id !== id) return item; saved = update(item); return saved; }); await saveWeb(); }); return saved; }
  const current = (await listWhosWhoItems(true)).find((item) => item.id === id); if (!current) return null;
  const next = update(current); const db = await nativeDatabase(); await db.runAsync('UPDATE whos_who_details SET learned_at=?, review_step=?, due_at=?, consecutive_support=?, paused=?, updated_at=? WHERE item_id=?', [next.learnedAt, next.reviewStep, next.dueAt, next.consecutiveSupport, next.paused ? 1 : 0, next.updatedAt, id]); return next;
}

export async function chooseNextWhosWhoItem(excludedItemIds: string[] = []) {
  const now = Date.now();
  const candidates = (await listWhosWhoItems()).filter((item) => !item.paused).sort((a, b) => { const ar = !a.learnedAt ? 0 : a.dueAt <= now ? 1 : 2; const br = !b.learnedAt ? 0 : b.dueAt <= now ? 1 : 2; return ar - br || a.dueAt - b.dueAt; });
  return candidates.find((item) => !excludedItemIds.includes(item.id)) ?? null;
}

export async function setLocalSetting(key: string, value: string) {
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.settings[key] = value; await saveWeb(); }); return; }
  const db = await nativeDatabase(); await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
}
export async function getLocalSetting(key: string) {
  if (Platform.OS === 'web') return (await loadWeb()).settings[key] ?? null;
  const db = await nativeDatabase(); return (await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]))?.value ?? null;
}

export async function removeLocalSetting(key: string) {
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); delete snapshot.settings[key]; await saveWeb(); }); return; }
  const db = await nativeDatabase(); await db.runAsync('DELETE FROM app_settings WHERE key = ?', [key]);
}

export async function startWhosWhoSession(patientId: string, itemId: string, companionPresent = false) {
  const session: StoredSession = { id: makeId(), patientId, itemId, gameId: 'whos_who', startedAt: Date.now(), endedAt: null, abandoned: false, companionPresent };
  if (Platform.OS === 'web') await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.sessions.push(session); await saveWeb(); });
  else { const db = await nativeDatabase(); await db.withTransactionAsync(async () => { await db.runAsync('INSERT INTO sessions (id, patient_id, game_id, started_at, companion_present) VALUES (?, ?, ?, ?, ?)', [session.id, patientId, session.gameId, session.startedAt, companionPresent ? 1 : 0]); await db.runAsync('INSERT INTO sync_queue (id, table_name, row_id, created_at) VALUES (?, ?, ?, ?)', [makeId(), 'sessions', session.id, Date.now()]); }); }
  return session;
}

export async function persistGameEvent(sessionId: string, event: GameEvent) {
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); const seq = snapshot.events.filter((entry) => entry.sessionId === sessionId).length; snapshot.events.push({ id: makeId(), sessionId, seq, event }); await saveWeb(); }); return; }
  const db = await nativeDatabase(); await queuedWrite(async () => { await db.withTransactionAsync(async () => { const eventId = makeId(); await db.runAsync(`INSERT INTO events (id, session_id, seq, type, payload, at) VALUES (?, ?, (SELECT COALESCE(MAX(seq) + 1, 0) FROM events WHERE session_id = ?), ?, ?, ?)`, [eventId, sessionId, sessionId, event.type, JSON.stringify(event), event.at]); await db.runAsync('INSERT INTO sync_queue (id, table_name, row_id, created_at) VALUES (?, ?, ?, ?)', [makeId(), 'events', eventId, Date.now()]); }); });
}

export async function finishWhosWhoSession(session: StoredSession, outcome: SessionOutcome) {
  const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.sessions = snapshot.sessions.map((entry) => entry.id === session.id ? { ...entry, endedAt: now } : entry); snapshot.outcomes.push({ sessionId: session.id, outcome }); await saveWeb(); }); return; }
  const db = await nativeDatabase(); await queuedWrite(async () => { await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', [now, session.id]);
    await db.runAsync('INSERT OR REPLACE INTO session_outcomes (session_id, scored_actions, success_rate, unassisted_rate, median_latency_seconds, was_abandoned, successful_scored_actions, unassisted_scored_actions, unassisted_latencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [session.id, outcome.scoredActions, outcome.successRate, outcome.unassistedRate, outcome.medianLatencySeconds, outcome.wasAbandoned ? 1 : 0, outcome.successfulScoredActions, outcome.unassistedScoredActions, JSON.stringify(outcome.unassistedLatencies)]);
    const prior = await db.getFirstAsync<{ difficulty: number; hint_time_seconds: number; sessions_observed: number; latency_samples: string }>('SELECT difficulty, hint_time_seconds, sessions_observed, latency_samples FROM controller_state WHERE patient_id = ? AND game_id = ?', [session.patientId, session.gameId]);
    const independent = outcome.unassistedRate === 1;
    const missedBeforeSuccess = (outcome.successRate ?? 1) < 1;
    const delta = independent ? 0.05 : missedBeforeSuccess ? -0.05 : 0;
    const difficulty = Math.max(0, Math.min(1, (prior?.difficulty ?? 0.5) + delta));
    // A family member may help with a session. Preserve the engagement result,
    // but never add its timing to calibration samples.
    const priorLatencies = prior ? JSON.parse(prior.latency_samples) as number[] : [];
    const latencySamples = session.companionPresent ? priorLatencies : [...priorLatencies, ...outcome.unassistedLatencies].slice(-20);
    await db.runAsync('INSERT OR REPLACE INTO controller_state (patient_id, game_id, difficulty, hint_time_seconds, sessions_observed, latency_samples, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [session.patientId, session.gameId, difficulty, prior?.hint_time_seconds ?? 12, (prior?.sessions_observed ?? 0) + 1, JSON.stringify(latencySamples), now]);
    const trajectoryId = makeId();
    await db.runAsync('INSERT INTO controller_state_changed (id, patient_id, game_id, session_id, difficulty, hint_time_seconds, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [trajectoryId, session.patientId, session.gameId, session.id, difficulty, prior?.hint_time_seconds ?? 12, 'tracking', now]);
    await db.runAsync('INSERT INTO sync_queue (id, table_name, row_id, created_at) VALUES (?, ?, ?, ?)', [makeId(), 'session_outcomes', session.id, now]);
    await db.runAsync('INSERT INTO sync_queue (id, table_name, row_id, created_at) VALUES (?, ?, ?, ?)', [makeId(), 'controller_state_changed', trajectoryId, now]);
  }); });
}

export async function abandonWhosWhoSession(session: StoredSession) {
  await persistGameEvent(session.id, { type: 'abandoned', at: Date.now() }); const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.sessions = snapshot.sessions.map((entry) => entry.id === session.id ? { ...entry, endedAt: now, abandoned: true } : entry); await saveWeb(); }); return; }
  const db = await nativeDatabase(); await db.runAsync('UPDATE sessions SET ended_at = ?, abandoned = 1 WHERE id = ?', [now, session.id]);
}
