import { emptyOutcome, isEveningDaysPlan } from './common'
import type { GameEvent, GameMetricsExtractor, GameSession, SessionOutcome } from './types'

function tapsFor(events: GameEvent[]): Extract<GameEvent, { type: 'tap' }>[] {
  return events.filter((event): event is Extract<GameEvent, { type: 'tap' }> => event.type === 'tap')
}

export const metricsExtractors: Record<GameSession['gameId'], GameMetricsExtractor> = {
  days_plan: { gameId: 'days_plan', extractSessionOutcome: (events, session) => emptyOutcome(events, isEveningDaysPlan(session) ? tapsFor(events) : [], session.companionPresent) },
  whos_who: { gameId: 'whos_who', extractSessionOutcome: (events, session) => emptyOutcome(events, tapsFor(events), session.companionPresent) },
  recipe: { gameId: 'recipe', extractSessionOutcome: (events, session) => emptyOutcome(events, tapsFor(events), session.companionPresent) },
}

export function extractSessionOutcome(events: GameEvent[], session: GameSession): SessionOutcome {
  return metricsExtractors[session.gameId].extractSessionOutcome(events, session)
}