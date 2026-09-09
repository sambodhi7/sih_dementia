import { onSessionEnd } from '../controller'
import { extract } from '../extract'
import { calculatePatientProfileMetrics } from '../../patient-metrics'
import { createInitialState, REGISTRY } from '../registry'
import type { GameEvent, SessionRecord } from '../types'

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

const events: GameEvent[] = [
  { type: 'prompt_shown', itemId: 'one', at: 1_000 },
  { type: 'tap', itemId: 'one', correct: true, at: 3_000, x: 0, y: 0, hintLevelAtTap: 0, solvedUnassisted: true },
  { type: 'prompt_shown', itemId: 'two', at: 4_000 },
  { type: 'tap', itemId: 'two', correct: false, at: 5_000, x: 0, y: 0, hintLevelAtTap: 1, solvedUnassisted: false },
]

const evening = extract(events, 'evening')
check(evening.scoredActions === 2 && evening.successfulScoredActions === 1, 'evening events are scored')
check(evening.unassistedLatencies.length === 1 && evening.unassistedLatencies[0] === 2, 'unassisted latency is extracted')
check(extract(events, 'morning').scoredActions === 0, 'morning orientation is not scored')
check(extract(events, 'evening', true).unassistedLatencies.length === 0, 'companion latency is excluded')

const game = REGISTRY.whos_who
const state = createInitialState('patient-1', game, 100)
const calibrated = onSessionEnd(events, state, game, 200)
check(calibrated.state.sessionsObserved === 1 && calibrated.next.source === 'calibration', 'calibration advances after a scored session')

const abandoned = onSessionEnd([{ type: 'abandoned', at: 2_000 }], { ...state, sessionsObserved: 5 }, game, 300)
check(abandoned.next.source === 'frozen' && abandoned.state.sessionsObserved === 5, 'abandonment freezes calibration history')

const sessions: SessionRecord[] = [{ session: { gameId: 'whos_who', startedAt: 1_000 }, events }]
const metrics = calculatePatientProfileMetrics(sessions, 400)
check(metrics.activity.completedSessions === 1 && metrics.independentPerformancePercent === 50, 'patient metrics aggregate persisted outcomes')
const companionMetrics = calculatePatientProfileMetrics([{ session: { gameId: 'whos_who', startedAt: 1_000, companionPresent: true }, events }], 500)
check(companionMetrics.medianResponseLatencySeconds === null, 'companion latency is excluded from patient metrics')

console.log('adaptive integration checks passed')