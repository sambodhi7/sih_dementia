import { clamp } from './tracker'

export const MIN_SCORED_ACTIONS = 6
export const DEADBAND = 0.05
export const MAX_DIFFICULTY_STEP = 0.05
export const MAX_HINT_STEP_FRACTION = 0.15
export const HELP_ASYMMETRY = 2

export function applySafety(
  candidate: number,
  current: number,
  maxStep: number,
  moreHelpWhen: 'decrease' | 'increase',
  lo: number,
  hi: number,
): number {
  const delta = candidate - current
  if (delta === 0) return clamp(current, lo, hi)
  const movesTowardMoreHelp = moreHelpWhen === 'decrease' ? delta < 0 : delta > 0
  const allowedStep = maxStep * (movesTowardMoreHelp ? HELP_ASYMMETRY : 1)
  return clamp(current + clamp(delta, -allowedStep, allowedStep), lo, hi)
}

export function holdConfig(
  difficulty: number,
  hintTimeSeconds: number,
  usesDifficulty: boolean,
  usesHintTiming: boolean,
  gameMinHint: number,
  gameMaxHint: number,
): { difficulty: number; hintTimeSeconds: number | null } {
  return {
    difficulty: usesDifficulty ? clamp(difficulty, 0, 1) : difficulty,
    hintTimeSeconds: usesHintTiming
      ? clamp(hintTimeSeconds, gameMinHint, gameMaxHint)
      : null,
  }
}