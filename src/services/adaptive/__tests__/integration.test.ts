import { onSessionEnd } from '../controller'
import { extract } from '../extract'
import { calculatePatientProfileMetrics } from '../../patient-metrics'
import { RecallInput, answerChoices } from '../../../games/whosWho/model'
import { createInitialState, REGISTRY } from '../registry'
import type { GameEvent, SessionRecord } from '../types'
import { whosWhoChoiceIds, whosWhoOptionCount } from '../whosWhoPresentation'
import type { WhosWhoItem } from '../../../storage/types'

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

check(whosWhoOptionCount({ ...state, difficulty: 0.2 }, 4) === 2, 'lower difficulty reduces Who’s Who choices')
check(whosWhoOptionCount({ ...state, difficulty: 0.8 }, 4) === 4, 'higher difficulty may use four Who’s Who choices')
const choices = whosWhoChoiceIds('two', ['one', 'two', 'three', 'four'], 3, 'prompt-1')
check(choices.length === 3 && choices.includes('two'), 'adaptive choices retain the correct memory')
check(JSON.stringify(choices) === JSON.stringify(whosWhoChoiceIds('two', ['one', 'two', 'three', 'four'], 3, 'prompt-1')), 'choice ordering stays stable while answering')

console.log('adaptive integration checks passed')
const abandonedMetrics = calculatePatientProfileMetrics([{ session: { gameId: 'whos_who', startedAt: 1_000 }, events: [...events, { type: 'abandoned', at: 6_000 }] }], 600)
check(abandonedMetrics.activity.completedSessions === 0 && abandonedMetrics.sessionsIncluded === 0 && abandonedMetrics.activity.abandonedSessions === 1, 'interrupted sessions are excluded from scored metrics')

async function verifyWhosWhoInput() {
  const captured: GameEvent[] = []
  let clock = 1_000
  const input = new RecallInput('person-1', async (event) => { captured.push(event) }, () => ++clock)
  await input.show(); await input.replay(); await input.tap('person-2', 4, 5); await input.help(); const assisted = await input.tap('person-1', 6, 7)
  check(captured.map((event) => event.type).join(',') === 'prompt_shown,audio_replayed,tap,hint_shown,tap', 'Who’s Who persists every interaction in producer-contract order')
  check(assisted?.independent === false && captured[4].type === 'tap' && !captured[4].solvedUnassisted, 'replay and assistance prevent an independent response')
  const candidates = Array.from({ length: 4 }, (_, index) => ({ id: `person-${index}`, patientId: 'patient-1', archivedAt: null, paused: false, learningOnly: false, learnedAt: 1, photoUri: 'photo', nameAudioUri: 'audio' })) as unknown as WhosWhoItem[]
  check(answerChoices(candidates[0], candidates, { ...state, difficulty: 0.8 }).length === 4, 'saved difficulty controls the number of Who’s Who options')
}

void verifyWhosWhoInput().then(() => console.log('adaptive integration checks passed'))
