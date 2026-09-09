import { getDb, loadWeb, makeId, Platform, queuedWrite, saveWeb } from './db';
import { enqueue } from './sync';
import type { ActivitySession, EngagementEvent, SkillCompletion } from './types';
import { saveSkillCompletion } from './skillTransmission';

export async function startSkillTransmissionSession(patientId: string, itemId: string): Promise<ActivitySession> {
  const session: ActivitySession = { id: makeId(), patientId, activityId: 'skill-transmission', itemId, startedAt: Date.now(), endedAt: null, interrupted: false, companionPresent: true };
  if (Platform.OS === 'web') {
    await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.activitySessions.push(session); await saveWeb(); });
  } else {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync('INSERT INTO sessions (id, patient_id, game_id, started_at, companion_present) VALUES (?, ?, ?, ?, 1)', [session.id, patientId, session.activityId, session.startedAt]);
      await enqueue(db, 'sessions', session.id);
    });
  }
  return session;
}

export async function persistEngagementEvent(sessionId: string, event: EngagementEvent) {
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      const seq = snapshot.activityEvents.filter((entry) => entry.sessionId === sessionId).length;
      snapshot.activityEvents.push({ id: makeId(), sessionId, seq, event });
      await saveWeb();
    });
    return;
  }
  const db = await getDb();
  await queuedWrite(async () => {
    await db.withTransactionAsync(async () => {
      const eventId = makeId();
      await db.runAsync(`INSERT INTO events (id, session_id, seq, type, payload, at) VALUES (?, ?, (SELECT COALESCE(MAX(seq) + 1, 0) FROM events WHERE session_id = ?), ?, ?, ?)`, [eventId, sessionId, sessionId, event.type, JSON.stringify(event), event.at]);
      await enqueue(db, 'events', eventId);
    });
  });
}

export async function completeSkillTransmissionSession(session: ActivitySession, durationMs: number, photoUri: string | null): Promise<SkillCompletion> {
  const completedAt = Date.now();
  if (Platform.OS === 'web') {
    const completion = await saveSkillCompletion({ sessionId: session.id, itemId: session.itemId, completedAt, durationMs, photoUri });
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      snapshot.activitySessions = snapshot.activitySessions.map((item) => item.id === session.id ? { ...item, endedAt: completedAt } : item);
      await saveWeb();
    });
    return completion;
  }
  const completion: SkillCompletion = { id: makeId(), sessionId: session.id, itemId: session.itemId, completedAt, durationMs, photoUri };
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO skill_transmission_completions (id, session_id, item_id, completed_at, duration_ms, photo_uri) VALUES (?, ?, ?, ?, ?, ?)', [completion.id, completion.sessionId, completion.itemId, completion.completedAt, completion.durationMs, completion.photoUri]);
    await db.runAsync('UPDATE sessions SET ended_at = ? WHERE id = ?', [completedAt, session.id]);
    await enqueue(db, 'sessions', session.id, completedAt);
    await enqueue(db, 'skill_transmission_completions', completion.id, completedAt);
  });
  return completion;
}

export async function interruptSkillTransmissionSession(session: ActivitySession) {
  const at = Date.now();
  await persistEngagementEvent(session.id, { type: 'interrupted', itemId: session.itemId, at });
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      snapshot.activitySessions = snapshot.activitySessions.map((item) => item.id === session.id ? { ...item, endedAt: at, interrupted: true } : item);
      await saveWeb();
    });
    return;
  }
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sessions SET ended_at = ?, abandoned = 1 WHERE id = ?', [at, session.id]);
    await enqueue(db, 'sessions', session.id, at);
  });
}
