import { calibrate } from './calibrate'
import { extract } from './extract'
import { applySafety, DEADBAND, holdConfig, MAX_DIFFICULTY_STEP, MAX_HINT_STEP_FRACTION, MIN_SCORED_ACTIONS } from './safety'
import { DIFFICULTY_TARGET, track, UNASSISTED_TARGET } from './tracker'
import type { ControllerState, GameConfig, GameEvent, NextConfig } from './types'

function nextConfig(difficulty: number, hintTimeSeconds: number | null, game: GameConfig, source: NextConfig['source']): NextConfig {
  return { difficulty, hintTimeSeconds, factor: !game.usesHintTiming || game.baseHintSeconds === 0 || hintTimeSeconds === null ? 1 : hintTimeSeconds / game.baseHintSeconds, source }
}

function freeze(state: ControllerState, game: GameConfig, now: number) {
  const difficulty = game.usesDifficulty ? applySafety(state.difficulty - MAX_DIFFICULTY_STEP, state.difficulty, MAX_DIFFICULTY_STEP, 'decrease', 0, 1) : state.difficulty
  const hintTime = game.usesHintTiming ? applySafety(state.hintTimeSeconds - state.hintTimeSeconds * MAX_HINT_STEP_FRACTION, state.hintTimeSeconds, state.hintTimeSeconds * MAX_HINT_STEP_FRACTION, 'decrease', game.minHintSeconds, game.maxHintSeconds) : null
  return { state: { ...state, difficulty, hintTimeSeconds: hintTime ?? state.hintTimeSeconds, updatedAt: now }, next: nextConfig(difficulty, hintTime, game, 'frozen') }
}

export function onSessionEnd(events: GameEvent[], state: ControllerState, game: GameConfig, now: number = Date.now(), phase?: 'morning' | 'evening', companionPresent = false): { next: NextConfig; state: ControllerState } {
  const outcome = extract(events, phase, companionPresent)
  if (outcome.wasAbandoned) return freeze(state, game, now)
  if (state.sessionsObserved < 5) return calibrate(outcome, state, game, now)
  if (outcome.scoredActions === 0) {
    const held = holdConfig(state.difficulty, state.hintTimeSeconds, game.usesDifficulty, game.usesHintTiming, game.minHintSeconds, game.maxHintSeconds)
    return { state, next: nextConfig(held.difficulty, held.hintTimeSeconds, game, 'tracking') }
  }

  const nextState = { ...state, sessionsObserved: state.sessionsObserved + 1, updatedAt: now }
  if (outcome.scoredActions < MIN_SCORED_ACTIONS || outcome.successRate === null || outcome.unassistedRate === null) {
    const held = holdConfig(state.difficulty, state.hintTimeSeconds, game.usesDifficulty, game.usesHintTiming, game.minHintSeconds, game.maxHintSeconds)
    return { state: nextState, next: nextConfig(held.difficulty, held.hintTimeSeconds, game, 'tracking') }
  }

  const rawDifficulty = Math.abs(outcome.successRate - DIFFICULTY_TARGET) < DEADBAND ? state.difficulty : track(state.difficulty, outcome.successRate, DIFFICULTY_TARGET, 0.03, 0, 1)
  const rawHint = Math.abs(outcome.unassistedRate - UNASSISTED_TARGET) < DEADBAND ? state.hintTimeSeconds : track(state.hintTimeSeconds, outcome.unassistedRate, UNASSISTED_TARGET, 0.08 * state.hintTimeSeconds, game.minHintSeconds, game.maxHintSeconds)
  const difficulty = game.usesDifficulty ? applySafety(rawDifficulty, state.difficulty, MAX_DIFFICULTY_STEP, 'decrease', 0, 1) : state.difficulty
  const hintTime = game.usesHintTiming ? applySafety(rawHint, state.hintTimeSeconds, state.hintTimeSeconds * MAX_HINT_STEP_FRACTION, 'decrease', game.minHintSeconds, game.maxHintSeconds) : null
  nextState.difficulty = difficulty
  nextState.hintTimeSeconds = hintTime === null ? state.hintTimeSeconds : hintTime
  return { state: nextState, next: nextConfig(difficulty, hintTime, game, 'tracking') }
}