import { getDb, asBool, makeId, loadWeb, Platform, queuedWrite, reviewIntervals, saveWeb } from './db';
import type { ReviewResult, WhosWhoDraft, WhosWhoItem } from './types';

function itemFromRow(row: Record<string, unknown>): WhosWhoItem {
  return { id: String(row.id), patientId: String(row.patient_id), name: String(row.label ?? ''), relationship: String(row.relationship ?? ''), personalNote: String(row.personal_note ?? ''), photoUri: (row.photo_uri as string | null) ?? null, nameAudioUri: (row.audio_uri as string | null) ?? null, noteAudioUri: (row.note_audio_uri as string | null) ?? null, learningOnly: asBool(row.learning_only), archivedAt: (row.archived_at as number | null) ?? null, learnedAt: (row.learned_at as number | null) ?? null, reviewStep: Number(row.review_step ?? -1), dueAt: Number(row.due_at ?? Date.now()), consecutiveSupport: Number(row.consecutive_support ?? 0), paused: asBool(row.paused), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at ?? row.created_at) };
}

export async function initializeItems(seedItems: Array<Partial<WhosWhoItem>> = []) {
  if (Platform.OS === 'web') {
    const snapshot = await loadWeb();
    if (!snapshot.items.length && seedItems.length) {
      const now = Date.now();
      snapshot.items = seedItems.map((item, index) => ({ id: item.id ?? `demo-memory-${index + 1}`, patientId: item.patientId ?? 'local-demo-patient', name: item.name ?? '', relationship: item.relationship ?? '', personalNote: item.personalNote ?? '', photoUri: item.photoUri ?? null, nameAudioUri: null, noteAudioUri: null, learningOnly: false, archivedAt: null, learnedAt: null, reviewStep: -1, dueAt: now, consecutiveSupport: 0, paused: false, createdAt: now, updatedAt: now }));
      await saveWeb();
    }
    return;
  }
  const db = await getDb();
  const count = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM items WHERE game_id = ?', ['whos_who']);
  for (let index = 0; (count?.count ?? 0) === 0 && index < seedItems.length; index += 1) {
    const item = seedItems[index];
    await saveWhosWhoItem(item.patientId ?? 'local-demo-patient', { name: item.name ?? '', relationship: item.relationship ?? '', personalNote: item.personalNote ?? '', photoUri: item.photoUri ?? null, nameAudioUri: null, noteAudioUri: null, learningOnly: false }, item.id ?? `demo-memory-${index + 1}`);
  }
}

export async function listWhosWhoItems(includeArchived = false) {
  if (Platform.OS === 'web') return (await loadWeb()).items.filter((item) => includeArchived || !item.archivedAt).sort((a, b) => a.name.localeCompare(b.name));
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(`SELECT items.*, whos_who_details.* FROM items JOIN whos_who_details ON whos_who_details.item_id = items.id WHERE items.game_id = 'whos_who' ${includeArchived ? '' : 'AND whos_who_details.archived_at IS NULL'} ORDER BY items.label COLLATE NOCASE`);
  return rows.map(itemFromRow);
}

export async function saveWhosWhoItem(patientId: string, draft: WhosWhoDraft, existingId?: string) {
  const id = existingId ?? makeId(); const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); const existing = snapshot.items.find((item) => item.id === id); const item: WhosWhoItem = { id, patientId, ...draft, archivedAt: existing?.archivedAt ?? null, learnedAt: existing?.learnedAt ?? null, reviewStep: existing?.reviewStep ?? -1, dueAt: existing?.dueAt ?? now, consecutiveSupport: existing?.consecutiveSupport ?? 0, paused: existing?.paused ?? false, createdAt: existing?.createdAt ?? now, updatedAt: now }; snapshot.items = existing ? snapshot.items.map((entry) => entry.id === id ? item : entry) : [...snapshot.items, item]; await saveWeb(); }); return id; }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT INTO items (id, patient_id, game_id, label, photo_uri, audio_uri, created_at) VALUES (?, ?, 'whos_who', ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label, photo_uri = excluded.photo_uri, audio_uri = excluded.audio_uri`, [id, patientId, draft.name, draft.photoUri, draft.nameAudioUri, now]);
    await db.runAsync(`INSERT INTO whos_who_details (item_id, relationship, personal_note, note_audio_uri, learning_only, due_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET relationship=excluded.relationship, personal_note=excluded.personal_note, note_audio_uri=excluded.note_audio_uri, learning_only=excluded.learning_only, updated_at=excluded.updated_at`, [id, draft.relationship, draft.personalNote, draft.noteAudioUri, draft.learningOnly ? 1 : 0, now, now]);
  });
  return id;
}

export async function archiveWhosWhoItem(id: string, archive = true) {
  const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.items = snapshot.items.map((item) => item.id === id ? { ...item, archivedAt: archive ? now : null, updatedAt: now } : item); await saveWeb(); }); return; }
  await (await getDb()).runAsync('UPDATE whos_who_details SET archived_at = ?, updated_at = ? WHERE item_id = ?', [archive ? now : null, now, id]);
}

export async function markLearningExposure(id: string) {
  const now = Date.now();
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.items = snapshot.items.map((item) => item.id === id ? { ...item, learnedAt: item.learnedAt ?? now, dueAt: now, updatedAt: now } : item); await saveWeb(); }); return; }
  await (await getDb()).runAsync('UPDATE whos_who_details SET learned_at = COALESCE(learned_at, ?), due_at = ?, updated_at = ? WHERE item_id = ?', [now, now, now, id]);
}

export async function applyReviewResult(id: string, result: ReviewResult) {
  const now = Date.now();
  const update = (item: WhosWhoItem): WhosWhoItem => { const consecutiveSupport = result === 'independent' ? 0 : item.consecutiveSupport + 1; const paused = result === 'distress' && consecutiveSupport >= 3; const reviewStep = result === 'independent' ? Math.min(item.reviewStep + 1, reviewIntervals.length - 1) : result === 'supported' ? Math.max(item.reviewStep - 1, 0) : Math.max(item.reviewStep - 1, -1); const delay = result === 'incorrect' || result === 'distress' ? reviewIntervals[0] : reviewIntervals[Math.max(reviewStep, 0)]; return { ...item, learnedAt: item.learnedAt ?? now, reviewStep, dueAt: now + delay, consecutiveSupport, paused, updatedAt: now }; };
  if (Platform.OS === 'web') { let saved: WhosWhoItem | null = null; await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.items = snapshot.items.map((item) => { if (item.id !== id) return item; saved = update(item); return saved; }); await saveWeb(); }); return saved; }
  const current = (await listWhosWhoItems(true)).find((item) => item.id === id); if (!current) return null;
  const next = update(current); await (await getDb()).runAsync('UPDATE whos_who_details SET learned_at=?, review_step=?, due_at=?, consecutive_support=?, paused=?, updated_at=? WHERE item_id=?', [next.learnedAt, next.reviewStep, next.dueAt, next.consecutiveSupport, next.paused ? 1 : 0, next.updatedAt, id]); return next;
}

export async function chooseNextWhosWhoItem(excludedItemIds: string[] = []) {
  const now = Date.now();
  const candidates = (await listWhosWhoItems()).filter((item) => !item.paused && !item.learningOnly).sort((a, b) => { const ar = !a.learnedAt ? 0 : a.dueAt <= now ? 1 : 2; const br = !b.learnedAt ? 0 : b.dueAt <= now ? 1 : 2; return ar - br || a.dueAt - b.dueAt; });
  return candidates.find((item) => !excludedItemIds.includes(item.id)) ?? null;
}

export async function setLocalSetting(key: string, value: string) { if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.settings[key] = value; await saveWeb(); }); return; } await (await getDb()).runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]); }
export async function getLocalSetting(key: string) { if (Platform.OS === 'web') return (await loadWeb()).settings[key] ?? null; return (await (await getDb()).getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]))?.value ?? null; }
export async function removeLocalSetting(key: string) { if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); delete snapshot.settings[key]; await saveWeb(); }); return; } await (await getDb()).runAsync('DELETE FROM app_settings WHERE key = ?', [key]); }
