import type { GameId } from '../services/adaptive/types';
import { getDb, loadWeb, Platform } from './db';

export type CompletedPractice = {
  gameId: Exclude<GameId, 'recipe'>;
  endedAt: number;
  independentPercent: number | null;
};

/** Only closed, non-abandoned sessions count as completed practice. */
export async function readCompletedPractice(patientId: string): Promise<CompletedPractice[]> {
  if (Platform.OS === 'web') {
    const snapshot = await loadWeb();
    return snapshot.sessions.flatMap((session) => {
      if (session.patientId !== patientId || session.gameId === 'recipe' || session.endedAt === null || session.abandoned) return [];
      const outcome = snapshot.outcomes.find((entry) => entry.sessionId === session.id)?.outcome;
      if (!outcome || outcome.wasAbandoned) return [];
      return [{ gameId: session.gameId, endedAt: session.endedAt, independentPercent: outcome.scoredActions > 0 ? 100 * outcome.unassistedScoredActions / outcome.scoredActions : null }];
    }).sort((a, b) => a.endedAt - b.endedAt);
  }

  const db = await getDb();
  const rows = await db.getAllAsync<{
    game_id: CompletedPractice['gameId'];
    ended_at: number;
    scored_actions: number;
    unassisted_scored_actions: number;
  }>(`SELECT s.game_id, s.ended_at, o.scored_actions, o.unassisted_scored_actions
      FROM sessions s JOIN session_outcomes o ON o.session_id = s.id
      WHERE s.patient_id = ? AND s.game_id IN ('days_plan', 'whos_who')
        AND s.ended_at IS NOT NULL AND s.abandoned = 0 AND o.was_abandoned = 0
      ORDER BY s.ended_at ASC`, [patientId]);
  return rows.map((row) => ({
    gameId: row.game_id,
    endedAt: row.ended_at,
    independentPercent: row.scored_actions > 0 ? 100 * row.unassisted_scored_actions / row.scored_actions : null,
  }));
}
