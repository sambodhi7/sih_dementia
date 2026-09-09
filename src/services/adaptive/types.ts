export type GameId = 'days_plan' | 'whos_who' | 'recipe'

export type GameEvent =
  | { type: 'prompt_shown'; itemId: string; at: number }
  | { type: 'tap'; itemId: string; correct: boolean; at: number; x: number; y: number; hintLevelAtTap: 0 | 1 | 2 | 3 | 4; solvedUnassisted: boolean; sequenceViolation?: boolean }
  | { type: 'hint_shown'; itemId: string; level: number; at: number }
  | { type: 'audio_replayed'; itemId: string; at: number }
  | { type: 'abandoned'; at: number }

export type GameSession = { gameId: GameId; startedAt: number; companionPresent?: boolean; phase?: 'morning' | 'evening' }
export type SessionRecord = { session: GameSession; events: GameEvent[] }
export type SessionOutcome = { scoredActions: number; successRate: number | null; unassistedRate: number | null; medianLatencySeconds: number | null; wasAbandoned: boolean; unassistedLatencies: number[]; successfulScoredActions: number; unassistedScoredActions: number }
export type ControllerState = { patientId: string; gameId: GameId; difficulty: number; hintTimeSeconds: number; sessionsObserved: number; latencySamples: number[]; updatedAt: number }
export type GameConfig = { gameId: GameId; usesDifficulty: boolean; usesHintTiming: boolean; baseHintSeconds: number; minHintSeconds: number; maxHintSeconds: number; startingDifficulty: number }
export type NextConfig = { difficulty: number; hintTimeSeconds: number | null; factor: number; source: 'calibration' | 'tracking' | 'frozen' }
export type PatientProfileMetrics = { independentPerformancePercent: number | null; supportNeededPercent: number | null; medianResponseLatencySeconds: number | null; performanceVariability: number | null; activity: { completedSessions: number; abandonedSessions: number; activeDays: number }; trend: { direction: 'improving' | 'stable' | 'changing' | 'insufficient_data' }; sessionsIncluded: number; calculatedAt: number }
export interface GameMetricsExtractor { gameId: GameId; extractSessionOutcome(events: GameEvent[], session: GameSession): SessionOutcome }