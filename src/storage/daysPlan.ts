import { getDb, loadWeb, makeId, Platform, queuedWrite, saveWeb } from './db';
import type { DaysPlanItem } from './types';

export async function listDaysPlanItems(patientId: string): Promise<DaysPlanItem[]> {
  if (Platform.OS === 'web') {
    return (await loadWeb()).daysPlanItems.filter((item) => item.patientId === patientId && !item.archivedAt).sort((a, b) => a.updatedAt - b.updatedAt);
  }
  const db = await getDb();
  const rows = await db.getAllAsync<DaysPlanItem>('SELECT id, patient_id as patientId, time, title, detail, image_uri as imageUri, audio_uri as audioUri, archived_at as archivedAt, updated_at as updatedAt FROM days_plan_items WHERE patient_id = ? AND archived_at IS NULL ORDER BY updated_at ASC', [patientId]);
  return rows;
}

export async function saveDaysPlanItems(patientId: string, items: Array<Omit<DaysPlanItem, 'patientId' | 'updatedAt'>>) {
  const now = Date.now();
  const nextItems: DaysPlanItem[] = items.map((item) => ({ ...item, patientId, updatedAt: now }));
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      const archivedAt = Date.now();
      const retained = snapshot.daysPlanItems.map((item) => item.patientId === patientId ? { ...item, archivedAt } : item);
      snapshot.daysPlanItems = [...retained, ...nextItems];
      await saveWeb();
    });
    return nextItems;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE days_plan_items SET archived_at = ? WHERE patient_id = ? AND archived_at IS NULL', [now, patientId]);
    for (const item of nextItems) {
      await db.runAsync('INSERT INTO days_plan_items (id, patient_id, time, title, detail, image_uri, audio_uri, archived_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?) ON CONFLICT(id) DO UPDATE SET time = excluded.time, title = excluded.title, detail = excluded.detail, image_uri = excluded.image_uri, audio_uri = excluded.audio_uri, archived_at = NULL, updated_at = excluded.updated_at', [item.id || makeId(), patientId, item.time, item.title, item.detail, item.imageUri, item.audioUri, item.updatedAt]);
    }
  });
  return nextItems;
}

export function makeDaysPlanItems(items: Array<{ id: string; time: string; title: string; detail: string; imageUri?: string | null; audioUri?: string | null }>, patientId: string): DaysPlanItem[] {
  const now = Date.now();
  return items.map((item) => ({ ...item, imageUri: item.imageUri ?? null, audioUri: item.audioUri ?? null, patientId, archivedAt: null, updatedAt: now }));
}
