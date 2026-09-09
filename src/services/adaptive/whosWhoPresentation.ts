import type { ControllerState } from './types'
import { difficultyLevel } from './difficulty'

/**
 * Converts the bounded controller value into presentation choices only. The
 * controller never changes the meaning of a memory or its review schedule.
 */
export function whosWhoOptionCount(state: ControllerState | null, availableChoices: number): number {
  const difficulty = state?.difficulty ?? 0.4
  const requested = difficultyLevel(difficulty) === 'gentle' ? 2 : difficultyLevel(difficulty) === 'steady' ? 3 : 4
  return Math.max(1, Math.min(requested, availableChoices))
}

/** A stable ordering stops answer tiles moving while the patient is deciding. */
function stableRank(value: string): number {
  let rank = 0
  for (let index = 0; index < value.length; index += 1) rank = (rank * 31 + value.charCodeAt(index)) >>> 0
  return rank
}

export function whosWhoChoiceIds(activeItemId: string, candidateIds: string[], optionCount: number, promptKey: string): string[] {
  const distractors = candidateIds
    .filter((id) => id !== activeItemId)
    .sort((left, right) => stableRank(`${promptKey}:${left}`) - stableRank(`${promptKey}:${right}`))
    .slice(0, Math.max(0, optionCount - 1))
  return [activeItemId, ...distractors].sort((left, right) => stableRank(`${promptKey}:position:${left}`) - stableRank(`${promptKey}:position:${right}`))
}
