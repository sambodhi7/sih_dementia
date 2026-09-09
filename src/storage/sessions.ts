import { createInitialState, onSessionEnd, REGISTRY } from '../services/adaptive';
import { calculatePatientProfileMetrics, extractSessionOutcome } from '../services/patient-metrics';
import type { ControllerState, GameEvent, GameId, GameSession, SessionRecord } from '../services/adaptive/types';
import { getDb, loadWeb, makeId, Platform, queuedWrite, saveWeb } from './db';
import { enqueue } from './sync';
import type { StoredSession } from './types';

export async function startWhosWhoSession(patientId: string, itemId: string, companionPresent = false) {
  const session: StoredSession = { id: makeId(), patientId, itemId, gameId: 'whos_who', startedAt: Date.now(), endedAt: null, abandoned: false, companionPresent };
  if (Platform.OS === 'web') await queuedWrite(async () => { const snapshot = await loadWeb(); snapshot.sessions.push(session); await saveWeb(); });
  else { const db = await getDb(); await db.withTransactionAsync(async () => { await db.runAsync('INSERT INTO sessions (id, patient_id, game_id, started_at, companion_present) VALUES (?, ?, ?, ?, ?)', [session.id, patientId, session.gameId, session.startedAt, companionPresent ? 1 : 0]); await enqueue(db, 'sessions', session.id); }); }
  return session;
}

export async function persistGameEvent(sessionId: string, event: GameEvent) {
  if (Platform.OS === 'web') { await queuedWrite(async () => { const snapshot = await loadWeb(); const seq = snapshot.events.filter((entry) => entry.sessionId === sessionId).length; snapshot.events.push({ id: makeId(), sessionId, seq, event }); await saveWeb(); }); return; }
  const db = await getDb(); await queuedWrite(async () => { await db.withTransactionAsync(async () => { const eventId = makeId(); await db.runAsync(`INSERT INTO events (id, session_id, seq, type, payload, at) VALUES (?, ?, (SELECT COALESCE(MAX(seq) + 1, 0) FROM events WHERE session_id = ?), ?, ?, ?)`, [eventId, sessionId, sessionId, event.type, JSON.stringify(event), event.at]); await enqueue(db, 'events', eventId); }); });
}

function outcomeFromEvents(events: GameEvent[], session: StoredSession) { return extractSessionOutcome(events, { gameId: session.gameId, startedAt: session.startedAt, companionPresent: session.companionPresent }); }

export async function finishWhosWhoSession(session: StoredSession) {
  const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      if (snapshot.outcomes.some((entry) => entry.sessionId === session.id)) return;
      const events = snapshot.events.filter((entry) => entry.sessionId === session.id).sort((a, b) => a.seq - b.seq).map((entry) => entry.event);
      const prior = snapshot.controllerStates.find((state) => state.patientId === session.patientId && state.gameId === session.gameId);
      const initial = prior ?? createInitialState(session.patientId, REGISTRY[session.gameId], session.startedAt);
      const result = events.length ? onSessionEnd(events, initial, REGISTRY[session.gameId], now, undefined, session.companionPresent) : { state: initial, next: { difficulty: initial.difficulty, hintTimeSeconds: initial.hintTimeSeconds, factor: 1, source: 'tracking' as const } };
      snapshot.sessions = snapshot.sessions.map((entry) => entry.id === session.id ? { ...entry, endedAt: now, abandoned: events.some((event) => event.type === 'abandoned') } : entry);
      snapshot.outcomes.push({ sessionId: session.id, outcome: outcomeFromEvents(events, session) });
      snapshot.controllerStates = [...snapshot.controllerStates.filter((state) => !(state.patientId === session.patientId && state.gameId === session.gameId)), result.state];
      snapshot.controllerStateChanges.push({ id: makeId(), state: result.state, sessionId: session.id, source: result.next.source, at: now });
      await saveWeb();
    });
    return;
  }
  const db = await getDb(); await queuedWrite(async () => { await db.withTransactionAsync(async () => {
    if (await db.getFirstAsync('SELECT session_id FROM session_outcomes WHERE session_id = ?', [session.id])) return;
    const eventRows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM events WHERE session_id = ? ORDER BY seq', [session.id]);
    const events = eventRows.map((row) => JSON.parse(row.payload) as GameEvent);
    const outcome = outcomeFromEvents(events, session);
    await db.runAsync('UPDATE sessions SET ended_at = ?, abandoned = ? WHERE id = ?', [now, outcome.wasAbandoned ? 1 : 0, session.id]);
    await db.runAsync('INSERT OR REPLACE INTO session_outcomes (session_id, scored_actions, success_rate, unassisted_rate, median_latency_seconds, was_abandoned, successful_scored_actions, unassisted_scored_actions, unassisted_latencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [session.id, outcome.scoredActions, outcome.successRate, outcome.unassistedRate, outcome.medianLatencySeconds, outcome.wasAbandoned ? 1 : 0, outcome.successfulScoredActions, outcome.unassistedScoredActions, JSON.stringify(outcome.unassistedLatencies)]);
    const prior = await db.getFirstAsync<{ difficulty: number; hint_time_seconds: number; sessions_observed: number; latency_samples: string }>('SELECT difficulty, hint_time_seconds, sessions_observed, latency_samples FROM controller_state WHERE patient_id = ? AND game_id = ?', [session.patientId, session.gameId]);
    const state: ControllerState = prior ? { patientId: session.patientId, gameId: session.gameId, difficulty: prior.difficulty, hintTimeSeconds: prior.hint_time_seconds, sessionsObserved: prior.sessions_observed, latencySamples: JSON.parse(prior.latency_samples) as number[], updatedAt: now } : createInitialState(session.patientId, REGISTRY[session.gameId], session.startedAt);
    const result = events.length ? onSessionEnd(events, state, REGISTRY[session.gameId], now, undefined, session.companionPresent) : { state, next: { difficulty: state.difficulty, hintTimeSeconds: state.hintTimeSeconds, factor: 1, source: 'tracking' as const } };
    await db.runAsync('INSERT OR REPLACE INTO controller_state (patient_id, game_id, difficulty, hint_time_seconds, sessions_observed, latency_samples, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [session.patientId, session.gameId, result.state.difficulty, result.state.hintTimeSeconds, result.state.sessionsObserved, JSON.stringify(result.state.latencySamples), result.state.updatedAt]);
    const trajectoryId = makeId();
    await db.runAsync('INSERT INTO controller_state_changed (id, patient_id, game_id, session_id, difficulty, hint_time_seconds, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [trajectoryId, session.patientId, session.gameId, session.id, result.state.difficulty, result.state.hintTimeSeconds, result.next.source, now]);
    await enqueue(db, 'session_outcomes', session.id, now);
    await enqueue(db, 'sessions', session.id, now);
    await enqueue(db, 'controller_state', `${session.patientId}:${session.gameId}`, now);
    await enqueue(db, 'controller_state_changed', trajectoryId, now);
  }); });
}

export async function abandonWhosWhoSession(session: StoredSession) {
  await persistGameEvent(session.id, { type: 'abandoned', at: Date.now() }); const now = Date.now();
  if (Platform.OS === 'web') {
    await queuedWrite(async () => {
      const snapshot = await loadWeb();
      const events = snapshot.events.filter((entry) => entry.sessionId === session.id).sort((a, b) => a.seq - b.seq).map((entry) => entry.event);
      const prior = snapshot.controllerStates.find((state) => state.patientId === session.patientId && state.gameId === session.gameId);
      const initial = prior ?? createInitialState(session.patientId, REGISTRY[session.gameId], session.startedAt);
      const result = onSessionEnd(events, initial, REGISTRY[session.gameId], now, undefined, session.companionPresent);
      snapshot.sessions = snapshot.sessions.map((entry) => entry.id === session.id ? { ...entry, endedAt: now, abandoned: true } : entry);
      snapshot.outcomes.push({ sessionId: session.id, outcome: outcomeFromEvents(events, session) });
      snapshot.controllerStates = [...snapshot.controllerStates.filter((state) => !(state.patientId === session.patientId && state.gameId === session.gameId)), result.state];
      snapshot.controllerStateChanges.push({ id: makeId(), state: result.state, sessionId: session.id, source: result.next.source, at: now });
      await saveWeb();
    });
    return;
  }
  const db = await getDb();
  await queuedWrite(async () => { await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE sessions SET ended_at = ?, abandoned = 1 WHERE id = ?', [now, session.id]);
    const eventRows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM events WHERE session_id = ? ORDER BY seq', [session.id]);
    const events = eventRows.map((row) => JSON.parse(row.payload) as GameEvent);
    const outcome = outcomeFromEvents(events, session);
    await db.runAsync('INSERT OR REPLACE INTO session_outcomes (session_id, scored_actions, success_rate, unassisted_rate, median_latency_seconds, was_abandoned, successful_scored_actions, unassisted_scored_actions, unassisted_latencies) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [session.id, outcome.scoredActions, outcome.successRate, outcome.unassistedRate, outcome.medianLatencySeconds, 1, outcome.successfulScoredActions, outcome.unassistedScoredActions, JSON.stringify(outcome.unassistedLatencies)]);
    const prior = await db.getFirstAsync<{ difficulty: number; hint_time_seconds: number; sessions_observed: number; latency_samples: string }>('SELECT difficulty, hint_time_seconds, sessions_observed, latency_samples FROM controller_state WHERE patient_id = ? AND game_id = ?', [session.patientId, session.gameId]);
    const state: ControllerState = prior ? { patientId: session.patientId, gameId: session.gameId, difficulty: prior.difficulty, hintTimeSeconds: prior.hint_time_seconds, sessionsObserved: prior.sessions_observed, latencySamples: JSON.parse(prior.latency_samples) as number[], updatedAt: now } : createInitialState(session.patientId, REGISTRY[session.gameId], session.startedAt);
    const result = onSessionEnd(events, state, REGISTRY[session.gameId], now, undefined, session.companionPresent);
    await db.runAsync('INSERT OR REPLACE INTO controller_state (patient_id, game_id, difficulty, hint_time_seconds, sessions_observed, latency_samples, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [session.patientId, session.gameId, result.state.difficulty, result.state.hintTimeSeconds, result.state.sessionsObserved, JSON.stringify(result.state.latencySamples), result.state.updatedAt]);
    const trajectoryId = makeId();
    await db.runAsync('INSERT INTO controller_state_changed (id, patient_id, game_id, session_id, difficulty, hint_time_seconds, source, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [trajectoryId, session.patientId, session.gameId, session.id, result.state.difficulty, result.state.hintTimeSeconds, result.next.source, now]);
    await enqueue(db, 'sessions', session.id, now);
    await enqueue(db, 'session_outcomes', session.id, now);
    await enqueue(db, 'controller_state', `${session.patientId}:${session.gameId}`, now);
    await enqueue(db, 'controller_state_changed', trajectoryId, now);
  }); });
  await persistGameEvent(session.id, { type: 'abandoned', at: Date.now() });
  await finishWhosWhoSession(session);
}

export async function readPatientSessionRecords(patientId: string, gameId?: GameId): Promise<SessionRecord[]> {
  if (Platform.OS === 'web') { const snapshot = await loadWeb(); return snapshot.sessions.filter((session) => session.endedAt !== null && session.patientId === patientId && (!gameId || session.gameId === gameId)).sort((a, b) => a.startedAt - b.startedAt).map((session) => ({ session: { gameId: session.gameId, startedAt: session.startedAt, companionPresent: session.companionPresent }, events: snapshot.events.filter((event) => event.sessionId === session.id).sort((a, b) => a.seq - b.seq).map((event) => event.event) })); }
  const db = await getDb();
  const sessions = await db.getAllAsync<{ id: string; game_id: GameId; started_at: number; phase: 'morning' | 'evening' | null; companion_present: number }>(`SELECT id, game_id, started_at, phase, companion_present FROM sessions WHERE ended_at IS NOT NULL AND patient_id = ? ${gameId ? 'AND game_id = ?' : ''} ORDER BY started_at ASC`, gameId ? [patientId, gameId] : [patientId]);
  return Promise.all(sessions.map(async (stored) => { const events = await db.getAllAsync<{ payload: string }>('SELECT payload FROM events WHERE session_id = ? ORDER BY seq ASC', [stored.id]); const gameSession: GameSession = { gameId: stored.game_id, startedAt: stored.started_at, companionPresent: stored.companion_present === 1, ...(stored.phase ? { phase: stored.phase } : {}) }; return { session: gameSession, events: events.map((event) => JSON.parse(event.payload) as GameEvent) }; }));
}

export async function readPatientProfileMetrics(patientId: string, gameId?: GameId, calculatedAt: number = Date.now()) { return calculatePatientProfileMetrics(await readPatientSessionRecords(patientId, gameId), calculatedAt); }
