// Canonical type contract — src/adaptive/types.ts
// Supersedes both types.tts and types_1_.tts. Delete those; nothing should
// import from anywhere else.

export type GameId = 'days_plan' | 'whos_who' | 'recipe'

export type GameEvent =
  | { type: 'prompt_shown'; itemId: string; at: number }
  | {
      type: 'tap'
      itemId: string
      correct: boolean
      at: number
      x: number
      y: number
      hintLevelAtTap: 0 | 1 | 2 | 3 | 4
      solvedUnassisted: boolean
      // Recipe producers must set this only for a clear sequence violation.
      sequenceViolation?: boolean
    }
  | { type: 'hint_shown'; itemId: string; level: number; at: number }
  | { type: 'audio_replayed'; itemId: string; at: number }
  | { type: 'abandoned'; at: number }

export type GameSession = {
  gameId: GameId
  startedAt: number
  // Required for Day's Plan because morning orientation is not scored recall.
  phase?: 'morning' | 'evening'
}

export type SessionRecord = {
  session: GameSession
  events: GameEvent[]
}

export type SessionOutcome = {
  scoredActions: number
  successRate: number | null
  unassistedRate: number | null
  medianLatencySeconds: number | null
  wasAbandoned: boolean
  unassistedLatencies: number[]
  successfulScoredActions: number
  unassistedScoredActions: number
}

export interface GameMetricsExtractor {
  gameId: GameId
  extractSessionOutcome(
    events: GameEvent[],
    session: GameSession,
  ): SessionOutcome
}

export type PatientProfileMetrics = {
  independentPerformancePercent: number | null
  supportNeededPercent: number | null
  medianResponseLatencySeconds: number | null
  performanceVariability: number | null
  activity: {
    completedSessions: number
    abandonedSessions: number
    activeDays: number
  }
  trend: {
    direction: 'improving' | 'stable' | 'changing' | 'insufficient_data'
  }
  sessionsIncluded: number
  calculatedAt: number
}

// --- Controller-side types (present in the old file, missing from the new
// one — both are required, restored here) ---

export type ControllerState = {
  patientId: string
  gameId: GameId
  difficulty: number
  hintTimeSeconds: number
  sessionsObserved: number
  latencySamples: number[]
  updatedAt: number
}

export type GameConfig = {
  gameId: GameId
  usesDifficulty: boolean
  usesHintTiming: boolean
  baseHintSeconds: number
  minHintSeconds: number
  maxHintSeconds: number
  startingDifficulty: number
}

export type NextConfig = {
  difficulty: number
  hintTimeSeconds: number | null
  factor: number
  source: 'calibration' | 'tracking' | 'frozen'
}