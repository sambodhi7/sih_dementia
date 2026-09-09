import type { GameEvent, SessionOutcome } from './types'
import { quantile } from './tracker'

type Prompt = { at: number; firstCorrectAt?: number }

export function extract(events: GameEvent[], phase?: 'morning' | 'evening', companionPresent = false): SessionOutcome {
  const prompts = new Map<string, Prompt>()
  const taps: Extract<GameEvent, { type: 'tap' }>[] = []
  const unassistedLatencies: number[] = []

  for (const event of events) {
    if (event.type === 'prompt_shown') {
      prompts.set(event.itemId, { at: event.at })
    } else if (event.type === 'tap') {
      taps.push(event)
      const prompt = prompts.get(event.itemId)
      if (event.correct && prompt && prompt.firstCorrectAt === undefined) {
        prompt.firstCorrectAt = event.at
        const latency = Math.max(0, (event.at - prompt.at) / 1000)
        if (event.solvedUnassisted) unassistedLatencies.push(latency)
      }
    }
  }

  const scoredTaps = phase === 'morning' ? [] : taps
  const successfulScoredActions = scoredTaps.filter((tap) => tap.correct).length
  const unassistedScoredActions = scoredTaps.filter((tap) => tap.correct && tap.solvedUnassisted).length
  const scoredActions = scoredTaps.length
  const scoredLatencies = phase === 'morning' || companionPresent ? [] : unassistedLatencies

  return {
    scoredActions,
    successRate: scoredActions === 0 ? null : successfulScoredActions / scoredActions,
    unassistedRate: scoredActions === 0 ? null : unassistedScoredActions / scoredActions,
    medianLatencySeconds: quantile(scoredLatencies, 0.5),
    wasAbandoned: events.some((event) => event.type === 'abandoned'),
    unassistedLatencies: scoredLatencies,
    successfulScoredActions,
    unassistedScoredActions,
  }
}