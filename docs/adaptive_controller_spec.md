# Saathi — adaptive controller implementation plan

Supersedes `hint_timing_system_spec.md` §§3–7. Read `CLAUDE.md` first; the hard
design rules there are not repeated and are not negotiable.

**Scope: prototype.** Pure functions over small arrays. No ML framework, no
bandit code, no training corpus. If a phase below feels like it needs a
library, it has been misread — stop and simplify.

---

## 0. What changed and why

The previous spec had a rule table emitting three fixed factors (0.7 / 1.0 / 1.3).
Two problems:

1. Every patient in an accuracy bucket gets the same number, and one bad day
   flips them between buckets. That is a lookup, not personalisation.
2. Independence is **not monotone** in hint time. Fire too early, the patient
   never gets a chance; fire too late, they stall and abandon. Independence
   falls at both ends, so it cannot be hill-climbed directly.

Replaced with an online stochastic tracker (Robbins–Monro). It fits one
parameter per patient per game from that patient's own behaviour, converging
toward a stated target rate. No population data required, because each patient
is their own reference.

This is the answer to PS requirement (b). It is adaptive parameter estimation,
not a decision table — say it that way in the writeup.

---

## 1. Placement

**TypeScript, in the app, on-device.** It lives under `src/services/adaptive/`;
there is no Python backend implementation of the controller.

The controller must run with the radio off (`CLAUDE.md`: local-first, device is
source of truth). Writing it in Python and porting later means maintaining the
same logic twice; it will drift, and the drift will be silent because both
sides are noisy floats.

```
src/services/adaptive/
├── types.ts           # ControllerState, SessionOutcome, GameConfig, NextConfig
├── tracker.ts         # the update rule — one function, two call sites
├── safety.ts          # deadband, rate limit, asymmetry, freeze
├── calibrate.ts       # cold start, sessions 1–5
├── extract.ts         # GameEvent[] -> SessionOutcome
├── controller.ts      # orchestration: onSessionEnd()
├── registry.ts        # per-game constants table
└── __tests__/
    ├── synthetic.ts   # simulated patients
    └── integration.test.ts
```

Persisted in `expo-sqlite`, table `controller_state`, primary key
`(patient_id, game_id)`. State is ~6 floats per row. Also emitted as a sync
event so the caregiver dashboard can plot the trajectory (see §8).

---

## 2. Event contract additions

Two fields are load-bearing and do not exist yet. Without them the hint-timing
observable cannot be computed at all.

```ts
// added to the tap event in GAMES.md
| { type: 'tap'; itemId: string; correct: boolean; at: number; x: number; y: number;
    hintLevelAtTap: 0 | 1 | 2 | 3 | 4;   // 0 = no hint had fired yet
    solvedUnassisted: boolean }           // correct && hintLevelAtTap === 0
```

`solvedUnassisted` is derivable from `hintLevelAtTap` but store it explicitly —
it is the single bit the tracker consumes and it should not depend on ladder
numbering staying stable.

Nothing else in the existing contract changes.

---

## 3. Core data structures

```ts
// types.ts
export type GameId = 'days_plan' | 'whos_who' | 'recipe'

export type ControllerState = {
  patientId: string
  gameId: GameId
  difficulty: number          // 0–1
  hintTimeSeconds: number     // absolute, per patient per game
  sessionsObserved: number    // drives calibration -> tracking handover
  latencySamples: number[]    // unassisted correct latencies, calibration only, capped at 40
  updatedAt: number
}

export type SessionOutcome = {
  scoredActions: number
  successRate: number | null        // null if no scored actions — never 0
  unassistedRate: number | null     // solvedUnassisted / scored
  medianLatencySeconds: number | null
  wasAbandoned: boolean
  unassistedLatencies: number[]
}

export type GameConfig = {
  gameId: GameId
  usesDifficulty: boolean
  usesHintTiming: boolean
  baseHintSeconds: number     // fallback until the patient is calibrated
  minHintSeconds: number
  maxHintSeconds: number
  startingDifficulty: number
}

export type NextConfig = {
  difficulty: number
  hintTimeSeconds: number | null   // null = this game has no hint timing
  factor: number                   // hintTime / baseHintSeconds, logged only
  source: 'calibration' | 'tracking' | 'frozen'
}
```

`factor` is derived and never used as the control variable. It exists so the
future bandit action space (0.70 … 1.30) drops in without a schema change, and
so cross-game comparison on the dashboard is meaningful.

---

## 4. Which games get which controller

Not every game has a success signal, and manufacturing one would violate
`CLAUDE.md`. Packing in particular **never rejects a tap**, so no hint ladder
fires and hint timing is undefined for it.

| Game | Difficulty | Hint timing | Notes |
|---|---|---|---|
| Song circle | no | no | engagement only, `factor = 1.0` |
| Day's plan | yes | yes | evening half only; morning is never adaptive |
| Who's who | yes | yes | interacts with the spaced-retrieval scheduler, §7 |
| Recipe | yes | yes | flagship; every attempt is scored, with sequence violations marked explicitly |
| Packing | yes | **no** | silent scoring on contextual fit; nothing is rejected |
| Skill | no | no | procedural, no measurement |

```ts
// registry.ts — clinician-tunable placeholders, not derived values.
// Mark them as such in code comments. Real numbers come from pilot data.
export const REGISTRY: Record<GameId, GameConfig> = {
  days_plan:   { usesDifficulty: true,  usesHintTiming: true,  baseHintSeconds: 8,  minHintSeconds: 3,  maxHintSeconds: 20, startingDifficulty: 0.4 },
  whos_who:    { usesDifficulty: true,  usesHintTiming: true,  baseHintSeconds: 10, minHintSeconds: 4,  maxHintSeconds: 25, startingDifficulty: 0.4 },
  recipe:      { usesDifficulty: true,  usesHintTiming: true,  baseHintSeconds: 12, minHintSeconds: 5,  maxHintSeconds: 30, startingDifficulty: 0.4 },
}
```

Day's plan hint timing applies to the evening recall half only. The morning
anchor demands no recall and must never adapt.

---

## 5. The tracker

Both controllers are the same update. Different observables keep them
decoupled — difficulty moves on *whether they succeeded*, timing moves on
*whether they needed help to do it*.

```ts
// tracker.ts
export const DIFFICULTY_TARGET = 0.85   // CLAUDE.md, errorless learning
export const UNASSISTED_TARGET = 0.70   // clinical knob, tune with a neurologist

export function track(
  param: number, observed: number, target: number, alpha: number,
  lo: number, hi: number,
): number {
  return clamp(param + alpha * (observed - target), lo, hi)
}
```

**Difficulty.** `observed = successRate`, `alpha = 0.03`, bounds `[0, 1]`.
Slow, because dementia performance is noisy day to day.

**Hint timing.** `observed = unassistedRate`, `alpha = 0.08 * hintTimeSeconds`
(relative step, since games differ by 6× in scale), bounds from the registry.

Why this works for timing despite censoring: firing a hint destroys the
counterfactual — you never learn how long they *would* have taken. But the
update only needs one bit per item (did they beat the clock), and a censored
item simply contributes a 0. Censoring is irrelevant by construction. The
parameter converges on the patient's 70th-percentile solve latency without ever
observing that latency directly.

Give difficulty the slower time constant so that any residual coupling between
the two loops cannot oscillate.

---

## 6. Safety wrapper

Applied to every update, both controllers. This is where the clinical
constraints live.

```ts
// safety.ts
export const MIN_SCORED_ACTIONS = 6
export const DEADBAND = 0.05
export const MAX_DIFFICULTY_STEP = 0.05
export const MAX_HINT_STEP_FRACTION = 0.15
export const HELP_ASYMMETRY = 2.0
```

1. **Minimum sample count.** Sessions with fewer than 6 scored actions do not
   update anything. Noise dominates.
2. **Deadband.** `|observed − target| < 0.05` → no change. Prevents chatter.
3. **Rate limit.** Cap the step regardless of error size.
4. **Asymmetry.** Moves *toward more help* (difficulty down, hint time down)
   are multiplied by `HELP_ASYMMETRY`; moves toward less help are not. Under
   errorless learning a too-late hint costs more than a too-early one.
5. **Freeze on abandonment.** An abandoned session skips the tracker update
  entirely — the sample is unrepresentative — while persisting the *next*
  config one rate-limited step toward more support. Session counters and
  latency samples do not advance.
6. **Absolute clamp last.** Registry bounds always win, after every other rule.

---

## 7. Cold start

Three tiers. Only the third needs a dataset, and it is not in this build.

**Tier 1 — calibration, sessions 1–5.** Run at fixed neutral config
(`startingDifficulty`, `baseHintSeconds`). Do not update anything. Accumulate
`unassistedLatencies` from correct-before-hint taps.

At the end of session 5, if there are ≥ 8 samples:

```ts
hintTimeSeconds = clamp(
  quantile(state.latencySamples, 0.70) * 1.15,   // 1.15 corrects censoring bias upward
  game.minHintSeconds, game.maxHintSeconds,
)
```

Fewer than 8 samples → keep `baseHintSeconds` and let the tracker do the work.
This step alone is most of the perceived personalisation and it costs nothing.

**Tier 2 — closed-loop tracking, session 6 onward.** §5 plus §6.

**Tier 3 — cross-patient learning.** Not built. When there is real data, the
correct first step is empirical-Bayes shrinkage (new patient starts at the
population mean for their stage and shrinks toward their own data as sessions
accumulate), not a neural net. Note it as Phase 2 in the pitch; do not stub it.

**Who's who interaction.** The spaced-retrieval scheduler owns *which item*
appears; the difficulty controller owns the *format* (free recall / 2-option /
4-option) and distractor similarity. They must not both move the same knob. If
an item is due from the scheduler, it is shown regardless of difficulty.

---

## 8. Decline masking — read this before wiring the dashboard

A controller holding success at 85% will silently compensate for cognitive
decline and hide it from the dashboard that exists to catch it. Raw accuracy
goes flat by construction. This is the single most likely way to ship a broken
product here.

**The trend detector must run on the controller trajectory, not on raw
performance.** If `difficulty` has drifted down and `hintTimeSeconds` up over
four weeks to hold the same success rate, that *is* the decline signal — and a
cleaner one than raw accuracy, because the controller has already normalised
away day-to-day noise.

So: emit a `controller_state_changed` event on every update, sync it, and add
`difficulty` and `hintTimeSeconds` to the rolling 4-week linear fit alongside
the existing metrics. The multi-metric agreement gate in `CLAUDE.md` stays —
flag only when several decline together. Output remains a referral signal,
never a diagnosis.

Intervention personalisation and longitudinal monitoring stay separate systems
(spec §17). The controller output is an *input* to the monitor, not the same model.

---

## 9. Orchestration

```ts
// controller.ts
export function onSessionEnd(
  events: GameEvent[], state: ControllerState, game: GameConfig,
): { next: NextConfig; state: ControllerState } {
  const outcome = extract(events)

  if (state.sessionsObserved < 5)          return calibrate(outcome, state, game)
  if (outcome.wasAbandoned)                return freeze(state, game)
  if (outcome.scoredActions < MIN_SCORED_ACTIONS) return hold(state, game)

  const difficulty = game.usesDifficulty
    ? applySafety(track(state.difficulty, outcome.successRate!, DIFFICULTY_TARGET, 0.03, 0, 1), state.difficulty, MAX_DIFFICULTY_STEP)
    : state.difficulty

  const hintTime = game.usesHintTiming
    ? applySafety(track(state.hintTimeSeconds, outcome.unassistedRate!, UNASSISTED_TARGET, 0.08 * state.hintTimeSeconds, game.minHintSeconds, game.maxHintSeconds), state.hintTimeSeconds, state.hintTimeSeconds * MAX_HINT_STEP_FRACTION)
    : null

  // ... persist, emit controller_state_changed, return
}
```

Runs once at session end over ~20 numbers. Gameplay reads two floats and is
fully deterministic — no inference in the loop, which is what preserves both
the offline property and the latency budget.

---

## 10. Synthetic patients — build this before the controller

You have no data, so the harness is the only way to know the controller works.
It doubles as a demo asset: convergence curves for judges, no real patients.

```ts
// __tests__/synthetic.ts
type SyntheticPatient = {
  ability: number            // 0–1, latent
  dayNoise: number           // SD, use 0.15 — deliberately large
  trueLatencyP70: number     // seconds
  declineSlopePerWeek: number
}
```

Generate a session by sampling a per-day ability offset, then per item:
success if `ability + noise > difficulty`, unassisted if
`latency < hintTimeSeconds` with latency drawn lognormal around the patient's
scale.

### Acceptance tests

- **Stable patient** → difficulty converges within ~15 sessions and stays in a
  ±0.08 band; hint time converges within 25% of `trueLatencyP70`.
- **Noisy stable patient** (`dayNoise = 0.25`) → no sustained drift, no
  oscillation, no bound-slamming.
- **Declining patient** → difficulty trends down monotonically over 4 weeks and
  the trend detector fires; assert raw success rate stays roughly flat, which
  is the §8 point made executable.
- **New patient** → 5 calibration sessions, neutral config, no crash, no update.
- **Empty session** (0 scored actions) → no update, no NaN, no divide-by-zero.
- **Abandoned session** → next config moves toward more support; session
  counters and latency samples remain unchanged.
- **Scale invariance** → three games with different `baseHintSeconds` fed the
  same synthetic behaviour produce the same `factor` and proportional
  `hintTimeSeconds`. (Carried over from the old §7, still the test that matters.)
- **New game registration** → adding a 7th `GameConfig` requires zero changes to
  `tracker.ts`, `safety.ts`, or `extract.ts`.

---

## 11. Build order

Each step runnable and tested before the next.

1. `types.ts` + `registry.ts` — 30 min
2. `synthetic.ts` — before any controller code, 1–2 hrs
3. `tracker.ts` + tests for scale invariance and convergence — 1 hr
4. `safety.ts` + tests for deadband, rate limit, asymmetry, freeze — 1 hr
5. `extract.ts` — pure functions over the event array, missing data returns
   `null` never `0` — 1 hr
6. `calibrate.ts` — 1 hr
7. `controller.ts` + SQLite persistence + `controller_state_changed` event — 2 hrs
8. Wire into one game (Who's who — it is built before Recipe and already has
   per-item structure) — 2 hrs
9. Dashboard trajectory plot and the §8 trend coupling — later, after the three
   MVPs land

Total ~10 hrs. Do not start before Song circle and Day's plan exist; the
controller is worthless without telemetry flowing.

---

## 12. Non-goals for this pass

- No contextual bandit, not even a stub class or an unused ABC.
- No exploration or jitter. V1 is deterministic; exploration comes only when
  deliberately entering a data-collection phase, and only inside both bound sets.
- No per-game metric DSL. Plain functions until a second event schema exists.
- No cross-patient model, no population prior, no shrinkage. Tier 3 is a slide.
- No LLM anywhere, per `CLAUDE.md`.

---

## 13. Edits to existing docs

- `CLAUDE.md`, "The AI" section: restate the difficulty controller and hint
  timing as one mechanism with two setpoints (0.85 success, 0.70 unassisted);
  add the §8 decline-masking note to the trend-detection bullet.
- `GAMES.md`, shared interface: add `hintLevelAtTap` and `solvedUnassisted` to
  the tap event.
- `hint_timing_system_spec.md`: mark §§3–7 superseded by this file. Keep §1
  (event contract) and §8 (non-goals) — both still correct.
