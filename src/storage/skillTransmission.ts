import { asBool, getDb, loadWeb, makeId, Platform, queuedWrite, saveWeb } from './db';
import type { SkillCatalogKey, SkillCompletion, SkillTransmissionItem } from './types';

export const SKILL_CATALOG: SkillCatalogKey[] = [
  'tie_shoes',
  'tie_knot',
  'tie_necktie',
  'fold_gamosa',
  'plant_seed',
  'button_shirt',
  'braid_hair',
  'brush_teeth',
];

const stableSkillId = (patientId: string, key: SkillCatalogKey) => `skill:${patientId}:${key}`;

function skillFromRow(row: Record<string, unknown>): SkillTransmissionItem {
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    catalogKey: String(row.catalog_key) as SkillCatalogKey,
    promptAudioUri: (row.prompt_audio_uri as string | null) ?? null,
    enabled: asBool(row.enabled),
    archivedAt: (row.archived_at as number | null) ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function initializeSkillTransmission(patientId: string) {
  const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      for (const catalogKey of SKILL_CATALOG) {
        const id = stableSkillId(patientId, catalogKey);
        if (!snapshot.skillTransmissionItems.some((item) => item.id === id)) {
          snapshot.skillTransmissionItems.push({ id, patientId, catalogKey, promptAudioUri: null, enabled: false, archivedAt: null, createdAt: now, updatedAt: now });
        }
      }
      await saveWeb();
    });
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    for (const catalogKey of SKILL_CATALOG) {
      const id = stableSkillId(patientId, catalogKey);
      await db.runAsync(`INSERT OR IGNORE INTO items (id, patient_id, game_id, label, created_at) VALUES (?, ?, 'skill-transmission', ?, ?)`, [id, patientId, catalogKey, now]);
      await db.runAsync('INSERT OR IGNORE INTO skill_transmission_details (item_id, catalog_key, updated_at) VALUES (?, ?, ?)', [id, catalogKey, now]);
    }
  });
}

export async function listSkillTransmissionItems(patientId: string, includeArchived = false): Promise<SkillTransmissionItem[]> {
  if (Platform.OS === 'web') {
    return (await loadWeb()).skillTransmissionItems.filter((item) => item.patientId === patientId && (includeArchived || !item.archivedAt));
  }
  const rows = await (await getDb()).getAllAsync<Record<string, unknown>>(`SELECT items.id, items.patient_id, items.created_at, skill_transmission_details.* FROM items JOIN skill_transmission_details ON skill_transmission_details.item_id = items.id WHERE items.patient_id = ? AND items.game_id = 'skill-transmission' ${includeArchived ? '' : 'AND skill_transmission_details.archived_at IS NULL'}`, [patientId]);
  return rows.map(skillFromRow);
}

export async function saveSkillPromptAudio(id: string, promptAudioUri: string) {
  const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      snapshot.skillTransmissionItems = snapshot.skillTransmissionItems.map((item) => item.id === id ? { ...item, promptAudioUri, updatedAt: now } : item);
      await saveWeb();
    });
    return;
  }
  await (await getDb()).runAsync('UPDATE skill_transmission_details SET prompt_audio_uri = ?, updated_at = ? WHERE item_id = ?', [promptAudioUri, now, id]);
}

export async function setSkillEnabled(id: string, enabled: boolean) {
  const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      snapshot.skillTransmissionItems = snapshot.skillTransmissionItems.map((item) => item.id === id && (!enabled || item.promptAudioUri) ? { ...item, enabled, updatedAt: now } : item);
      await saveWeb();
    });
    return;
  }
  await (await getDb()).runAsync('UPDATE skill_transmission_details SET enabled = ?, updated_at = ? WHERE item_id = ? AND (? = 0 OR prompt_audio_uri IS NOT NULL)', [enabled ? 1 : 0, now, id, enabled ? 1 : 0]);
}

export async function saveSkillCompletion(completion: Omit<SkillCompletion, 'id'>) {
  const saved: SkillCompletion = { id: makeId(), ...completion };
  if (Platform.OS === 'web') {
    await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.skillCompletions.push(saved); await saveWeb(); });
    return saved;
  }
  await (await getDb()).runAsync('INSERT INTO skill_transmission_completions (id, session_id, item_id, completed_at, duration_ms, photo_uri) VALUES (?, ?, ?, ?, ?, ?)', [saved.id, saved.sessionId, saved.itemId, saved.completedAt, saved.durationMs, saved.photoUri]);
  return saved;
}

export async function updateSkillCompletionPhoto(id: string, photoUri: string) {
  if (Platform.OS === 'web') {
    await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.skillCompletions = snapshot.skillCompletions.map((item) => item.id === id ? { ...item, photoUri } : item); await saveWeb(); });
    return;
  }
  await (await getDb()).runAsync('UPDATE skill_transmission_completions SET photo_uri = ? WHERE id = ?', [photoUri, id]);
}

/** Read locally stored shared-moment records for a patient, newest first. */
export async function listSkillCompletions(patientId: string): Promise<SkillCompletion[]> {
  if (Platform.OS === 'web') {
    const snapshot = await loadWeb();
    const itemIds = new Set(snapshot.skillTransmissionItems.filter((item) => item.patientId === patientId).map((item) => item.id));
    return snapshot.skillCompletions.filter((item) => itemIds.has(item.itemId)).sort((a, b) => b.completedAt - a.completedAt);
  }
  const rows = await (await getDb()).getAllAsync<Record<string, unknown>>(`SELECT c.id, c.session_id, c.item_id, c.completed_at, c.duration_ms, c.photo_uri FROM skill_transmission_completions c JOIN items i ON i.id = c.item_id WHERE i.patient_id = ? AND i.game_id = 'skill-transmission' ORDER BY c.completed_at DESC`, [patientId]);
  return rows.map((row) => ({ id: String(row.id), sessionId: String(row.session_id), itemId: String(row.item_id), completedAt: Number(row.completed_at), durationMs: Number(row.duration_ms), photoUri: (row.photo_uri as string | null) ?? null }));
}
