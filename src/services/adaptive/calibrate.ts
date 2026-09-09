import { clamp, quantile } from './tracker'
import type { ControllerState, GameConfig, NextConfig, SessionOutcome } from './types'

const CALIBRATION_SESSIONS = 5
const MAX_LATENCY_SAMPLES = 40
const MIN_CALIBRATION_SAMPLES = 8

export function calibrate(
  outcome: SessionOutcome,
  state: ControllerState,
  game: GameConfig,
  now: number = Date.now(),
): { next: NextConfig; state: ControllerState } {
  if (outcome.scoredActions === 0) {
    return {
      state,
      next: {
        difficulty: state.difficulty,
        hintTimeSeconds: game.usesHintTiming ? state.hintTimeSeconds : null,
        factor: game.baseHintSeconds === 0 ? 1 : state.hintTimeSeconds / game.baseHintSeconds,
        source: 'calibration',
      },
    }
  }

  const samples = [...state.latencySamples, ...outcome.unassistedLatencies].slice(-MAX_LATENCY_SAMPLES)
  const sessionsObserved = state.sessionsObserved + 1
  const calibrated = sessionsObserved >= CALIBRATION_SESSIONS && samples.length >= MIN_CALIBRATION_SAMPLES && game.usesHintTiming
  const hintTimeSeconds = calibrated
    ? clamp(quantile(samples, 0.7)! * 1.15, game.minHintSeconds, game.maxHintSeconds)
    : state.hintTimeSeconds
  const nextState = { ...state, sessionsObserved, latencySamples: samples, hintTimeSeconds, updatedAt: now }

  return {
    state: nextState,
    next: {
      difficulty: game.usesDifficulty ? game.startingDifficulty : state.difficulty,
      hintTimeSeconds: game.usesHintTiming ? hintTimeSeconds : null,
      factor: game.baseHintSeconds === 0 ? 1 : hintTimeSeconds / game.baseHintSeconds,
      source: 'calibration',
    },
  }
}