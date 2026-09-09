# Producer Contract — Game → Metrics/Controller

**Audience:** whoever builds the game screens.
**Purpose:** the metrics and adaptive-controller layers are already written. They consume `GameEvent[]` plus a `GameSession`. If the games emit events that don't match this contract, the metrics come out silently wrong — not crashed, *wrong*, which is worse. Nothing here is optional.

**Canonical event and controller types live in `src/services/adaptive/types.ts`.** Import from there. Do not redeclare these types anywhere else.

---

## 1. Scope

The controller currently covers three games only:

```ts
type GameId = 'days_plan' | 'whos_who' | 'recipe'
```

Song circle, Packing and Skill transmission are **out of scope** for the controller. They may still log events for the caregiver dashboard, but they must not be given a `GameId` from the union above and must not be routed to `onSessionEnd`.

---

## 2. Session

```ts
type GameSession = {
  gameId: GameId
  startedAt: number
  phase?: 'morning' | 'evening'
}
```

- `startedAt` — `Date.now()` at the moment the first prompt is rendered, not at screen mount.
- `phase` — **required for `days_plan`**, omitted for the other two. Morning Day's Plan is orientation, not scored recall; the extractor returns zero scored actions for it. If you forget to set the phase, morning sessions get scored as recall and the patient's metrics are corrupted.

---

## 3. Timestamps

- Every `at` is **milliseconds since epoch** (`Date.now()`), never a `Date`, never seconds, never a monotonic clock reading.
- Events must be pushed in **chronological order** within a session.
- Do not backfill or adjust timestamps after the fact. Latency is computed from these values.

---

## 4. Item IDs

- `itemId` must be **stable across sessions** for the same real-world item. The same photograph is the same `itemId` next week.
- Do not use array indices, render keys, or anything regenerated per session.
- Per-item spaced-retrieval scheduling is planned and depends entirely on this. Unstable IDs make it unimplementable later.

---

## 5. Events

### `prompt_shown`

```ts
{ type: 'prompt_shown', itemId: string, at: number }
```

Emit **once per item presentation**, when the prompt becomes visible and answerable.

**Do not re-emit after a wrong answer or a hint.** Latency is measured from the original presentation. Re-emitting resets the clock and makes a struggling patient look fast.

### `tap`

```ts
{
  type: 'tap'
  itemId: string
  correct: boolean
  at: number
  x: number
  y: number
  hintLevelAtTap: 0 | 1 | 2 | 3 | 4
  solvedUnassisted: boolean
  sequenceViolation?: boolean   // recipe only
}
```

Emit for **every** answer attempt, right and wrong. Under errorless design a wrong tap doesn't end the item, so expect several taps against one `prompt_shown`.

- `itemId` — the item being **asked about**, not the item tapped. If the prompt is "which is your brother?" and they tap the wrong face, `itemId` is still the brother's ID with `correct: false`.
- `x`, `y` — screen coordinates of the touch.
- `hintLevelAtTap` — the hint level **currently visible** at the moment of the tap. `0` means no hint on screen. This is the displayed level, not a count of hints shown so far.
- `sequenceViolation` — Recipe only. See §6.

### `solvedUnassisted` — get this exactly right

Set `true` only when **all** of these hold:

1. `correct === true`
2. `hintLevelAtTap === 0`
3. No `audio_replayed` has been emitted for this item since its `prompt_shown`
4. This is the first tap for this item since its `prompt_shown`

Otherwise `false`. On any incorrect tap it is always `false`.

This field drives `unassistedRate`, which is one of the controller's two targets and the dashboard's headline "independent performance" number. A producer that sets it loosely will make a declining patient look independent.

### `hint_shown`

```ts
{ type: 'hint_shown', itemId: string, level: number, at: number }
```

Emit each time a hint escalates to a new level. `level` runs 1–4 and matches what `hintLevelAtTap` will report on the next tap.

### `audio_replayed`

```ts
{ type: 'audio_replayed', itemId: string, at: number }
```

Emit on every replay of the prompt audio. Counts as assistance — see condition 3 above.

### `abandoned`

```ts
{ type: 'abandoned', at: number }
```

Emit **once**, as the final event, when the patient leaves without finishing: back button, app backgrounded past the timeout, session timeout. Do not emit on normal completion.

The controller freezes on abandoned sessions rather than adapting from them. Missing this event means a walked-away session gets treated as real performance data.

---

## 6. Per-game rules

### `days_plan`

- `phase` is required.
- Morning → orientation, zero scored actions. Still log events; the extractor filters.
- Evening → all taps scored.

### `whos_who`

- All taps scored.
- Note: because errorless retries produce multiple taps per item, `successRate` is *successes ÷ attempts*, not *% of items correct*. Don't relabel it in any UI.

### `recipe`

- `sequenceViolation: true` means the patient performed a step genuinely out of order. Set it only for a real ordering error, never as a general wrong-answer flag.
- All Recipe step attempts are scored. `sequenceViolation` describes a genuine ordering error; it is not a filter for whether an attempt enters the metrics. Emit every step attempt as a tap with `correct` set normally, and set `sequenceViolation` only on ordering errors.

---

## 7. Common mistakes

- Emitting `prompt_shown` again after a hint. Breaks latency.
- Setting `solvedUnassisted: true` on a correct tap that followed a hint. Breaks the controller's second target.
- Using the tapped item's ID instead of the asked item's ID on wrong answers.
- Omitting `phase` on Day's Plan.
- Not emitting `abandoned`, or emitting it on normal completion.
- Regenerating `itemId` per session.
- Suppressing wrong taps because "the patient shouldn't feel they failed." The *UI* hides failure; the *log* must not. Errorless learning is a presentation rule, not a logging rule.

---

## 8. Pending — check before building

Two fields are likely to be added shortly. Worth knowing now so the plumbing isn't painful later.

**`companionPresent: boolean` on `GameSession`.** Sessions played with the grandchild present contain conversation between prompt and tap, so those latencies aren't cognitive latencies and must be excluded from hint-time calibration. Confirm with the team before finalising session setup UI.

**Whether Recipe needs a mode flag** if it runs both as a scored solo game and as a shared activity.

---

## 9. Integration point

At session end, hand the metrics layer:

```ts
type SessionRecord = {
  session: GameSession
  events: GameEvent[]
}
```

Call `onSessionEnd` with it. The returned `NextConfig` — `difficulty`, `hintTimeSeconds`, `factor`, `source` — configures the next session of that game for that patient. Persist the returned `ControllerState`; it is per patient **per game**, never shared across games.
