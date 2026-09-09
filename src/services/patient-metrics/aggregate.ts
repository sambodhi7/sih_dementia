import { extractSessionOutcome } from './extractors'
import { median } from './common'
import type { PatientProfileMetrics, SessionOutcome, SessionRecord } from './types'

function standardDeviation(values: number[]): number | null {
  if (values.length < 2) return null
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}

export function calculatePatientProfileMetrics(sessions: SessionRecord[], calculatedAt: number = Date.now()): PatientProfileMetrics {
  const allOutcomes = sessions.map(({ events, session }) => extractSessionOutcome(events, session))
  // A voluntarily stopped round is engagement, not a scored completion.
  const outcomes = allOutcomes.filter((outcome) => !outcome.wasAbandoned)
  const scoredActions = outcomes.reduce((sum, outcome) => sum + outcome.scoredActions, 0)
  const unassistedActions = outcomes.reduce((sum, outcome) => sum + outcome.unassistedScoredActions, 0)
  const latencies = outcomes.flatMap((outcome) => outcome.unassistedLatencies)
  const rates = outcomes.map((outcome) => outcome.successRate).filter((value): value is number => value !== null)
  const delta = rates.length < 2 ? null : rates[rates.length - 1] - rates[0]
  return {
    independentPerformancePercent: scoredActions === 0 ? null : (unassistedActions / scoredActions) * 100,
    supportNeededPercent: scoredActions === 0 ? null : ((scoredActions - unassistedActions) / scoredActions) * 100,
    medianResponseLatencySeconds: median(latencies),
    performanceVariability: standardDeviation(rates),
    activity: { completedSessions: outcomes.length, abandonedSessions: allOutcomes.filter((outcome) => outcome.wasAbandoned).length, activeDays: new Set(sessions.map(({ session }) => new Date(session.startedAt).toISOString().slice(0, 10))).size },
    trend: delta === null ? { direction: 'insufficient_data' } : Math.abs(delta) < 0.05 ? { direction: 'stable' } : { direction: delta > 0 ? 'improving' : 'changing' },
    sessionsIncluded: outcomes.length,
    calculatedAt,
  }
}
