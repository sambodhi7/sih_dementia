import type { GameEvent, GameSession, SessionOutcome } from './types'

export function emptyOutcome(events: GameEvent[], scored: Extract<GameEvent, { type: 'tap' }>[] = [], companionPresent = false): SessionOutcome {
  const successful = scored.filter((event) => event.correct)
  const unassisted = successful.filter((event) => event.solvedUnassisted)
  const latencies = companionPresent ? [] : unassisted.map((event) => latencyFor(event, events)).filter((value): value is number => value !== null)
  return {
    scoredActions: scored.length,
    successRate: scored.length === 0 ? null : successful.length / scored.length,
    unassistedRate: scored.length === 0 ? null : unassisted.length / scored.length,
    medianLatencySeconds: median(latencies),
    wasAbandoned: events.some((event) => event.type === 'abandoned'),
    unassistedLatencies: latencies,
    successfulScoredActions: successful.length,
    unassistedScoredActions: unassisted.length,
  }
}

export function latencyFor(tap: Extract<GameEvent, { type: 'tap' }>, events: GameEvent[]): number | null {
  const prompt = events.filter((event): event is Extract<GameEvent, { type: 'prompt_shown' }> => event.type === 'prompt_shown' && event.itemId === tap.itemId && event.at <= tap.at).sort((a, b) => b.at - a.at)[0]
  if (!prompt) return null
  const seconds = (tap.at - prompt.at) / 1000
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

export function isEveningDaysPlan(session: GameSession): boolean {
  return session.gameId !== 'days_plan' || session.phase === 'evening'
}