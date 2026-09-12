import { getDb, loadWeb, Platform, queuedWrite, saveWeb } from '../../storage/db';
import { enqueue } from '../../storage/sync';
import type { StoredSession } from '../../storage/types';

// This first version offers family variations and scaffolded gestures, not a
// validated recall assessment. Retain raw events but do not advance a controller
// or create misleading cognitive scores. Reuse sessions + their sync outbox.
export async function closeRecipeSession(session: StoredSession, interrupted: boolean) {
  const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.sessions = snapshot.sessions.map(row => row.id === session.id ? {...row, endedAt: interrupted ? null : now} : row); await saveWeb(); });
  } else {
    const db = await getDb();
    await queuedWrite(async () => { await db.withTransactionAsync(async () => {
      // Incomplete stays unscored, never falsely labelled abandoned.
      await db.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', [interrupted ? null : now, session.id]);
      await enqueue(db, 'sessions', session.id, now);
    }); });
  }
}
