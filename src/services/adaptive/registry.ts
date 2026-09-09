import type { ControllerState, GameConfig, GameId } from './types'

export const REGISTRY: Record<GameId, GameConfig> = {
  days_plan: { gameId: 'days_plan', usesDifficulty: true, usesHintTiming: true, baseHintSeconds: 8, minHintSeconds: 3, maxHintSeconds: 20, startingDifficulty: 0.4 },
  whos_who: { gameId: 'whos_who', usesDifficulty: true, usesHintTiming: true, baseHintSeconds: 10, minHintSeconds: 4, maxHintSeconds: 25, startingDifficulty: 0.4 },
  recipe: { gameId: 'recipe', usesDifficulty: true, usesHintTiming: true, baseHintSeconds: 12, minHintSeconds: 5, maxHintSeconds: 30, startingDifficulty: 0.4 },
}

export function createInitialState(patientId: string, game: GameConfig, now: number = Date.now()): ControllerState {
  return { patientId, gameId: game.gameId, difficulty: game.startingDifficulty, hintTimeSeconds: game.baseHintSeconds, sessionsObserved: 0, latencySamples: [], updatedAt: now }
}