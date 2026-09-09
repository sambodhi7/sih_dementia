import type { ControllerState, GameId } from '../services/adaptive/types';
import { getDb, loadWeb, Platform } from './db';

export function readControllerState(patientId: string, gameId: GameId): Promise<ControllerState | null> {
  return readControllerStateInternal(patientId, gameId);
}

async function readControllerStateInternal(patientId: string, gameId: GameId): Promise<ControllerState | null> {
  if (Platform.OS === 'web') return (await loadWeb()).controllerStates.find((state) => state.patientId === patientId && state.gameId === gameId) ?? null;
  const row = await (await getDb()).getFirstAsync<{ patient_id: string; game_id: GameId; difficulty: number; hint_time_seconds: number; sessions_observed: number; latency_samples: string; updated_at: number }>('SELECT patient_id, game_id, difficulty, hint_time_seconds, sessions_observed, latency_samples, updated_at FROM controller_state WHERE patient_id = ? AND game_id = ?', [patientId, gameId]);
  return row ? { patientId: row.patient_id, gameId: row.game_id, difficulty: row.difficulty, hintTimeSeconds: row.hint_time_seconds, sessionsObserved: row.sessions_observed, latencySamples: JSON.parse(row.latency_samples) as number[], updatedAt: row.updated_at } : null;
}