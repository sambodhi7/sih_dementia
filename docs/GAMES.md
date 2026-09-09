# Saathi — game specifications

Six games. Each entry gives the full design, then an MVP line that defines what
must exist for the demo. Build the MVP first for all six, then deepen.

Shared rules are in `CLAUDE.md` and are not repeated here: no failure states,
64px targets, 24px base font, tap only, audio plus visual on every prompt.

---

## Shared interface

Every game implements the same contract.

```ts
type Stage = 'mild' | 'moderate' | 'severe'

type GameModule = {
  id: string
  title: Record<string, string>        // localised
  stages: Stage[]                       // which stages this game supports
  render: (props: GameProps) => JSX.Element
}

type GameProps = {
  patient: Patient
  stage: Stage
  difficulty: number                    // 0–1, from the controller
  content: ContentPack                  // regional, family-generated
  onEvent: (e: GameEvent) => void       // telemetry, every interaction
  onComplete: () => void
}

type GameEvent =
  | { type: 'prompt_shown'; itemId: string; at: number }
  | { type: 'tap'; itemId: string; correct: boolean; at: number; x: number; y: number;
      hintLevelAtTap: 0 | 1 | 2 | 3 | 4; solvedUnassisted: boolean;
      sequenceViolation?: boolean }
  | { type: 'hint_shown'; itemId: string; level: number; at: number }
  | { type: 'audio_replayed'; itemId: string; at: number }
  | { type: 'abandoned'; at: number }
```

`correct: false` is a telemetry fact only. It never reaches the UI as an error.

### The hint ladder

Used by every game that has a target answer. Escalates on each wrong tap,
never resets to punishment.

1. **Repeat** — replay the prompt audio, warmly. No new information.
2. **Narrow** — dim the clearly-wrong options to 40% opacity. Never remove them.
3. **Cue** — a spoken semantic clue. "It comes from the river."
4. **Reveal** — highlight the correct option with an amber tint and 2px border,
   speak the answer, and wait. The patient still taps it themselves.

Reveal is not a loss. The tap that follows is recorded as a success, because in
errorless learning the point is that the correct response is the one performed.

### Difficulty mapping

The 0–1 float means something different per game but always follows the same
shape: more options, less scaffolding, longer sequences as it rises. Each game
below states its mapping.

---

## 1. Song circle

**Cognitive basis.** Musical memory is stored separately from episodic memory
and survives far longer — people who have lost fluent speech often still sing
songs learned in youth. This is the game that still works when nothing else does.

**Full design.** The app suggests a theme: a Bihu song, a hymn, a lullaby you
sang to your children, a song from working in the fields. The elder sings or
hums; the grandchild taps record. Playback happens together immediately. Songs
accumulate into a family songbook with singer, date and theme.

At severe stage it inverts entirely: no prompt, no recording, no task. The app
plays back songs the family recorded earlier and the elder listens, hums along,
or simply responds. Presence, not performance.

The recordings double as voice-pack raw material and as reminiscence assets for
Who's who.

**Difficulty.** Barely applies. Higher values suggest more specific themes
("a song from your wedding"); lower values suggest open ones ("any song you like").

**Telemetry.** Engagement duration, whether they participated, replay counts.
Deliberately not a cognitive measure. Its outcome is quality of life.

**Content.** Rabindrasangeet, baul, folk lullabies, hymns, work songs. Family
recordings only — never commercial music.

**MVP.** One big record button, stop on tap, a list of saved recordings with
name and date, playback on tap. One suggested theme, hardcoded. Storage local.
That is the whole MVP and it should take about two hours. Build it first — it
proves the audio stack on day one.

---

## 2. Day's plan

**Cognitive basis.** Disorientation to time and place causes real distress in
dementia. A consistent external anchor reduces it. The morning half is reality
orientation; the evening half is a daily episodic memory probe taken in a
natural context, which makes it the best longitudinal signal in the app.

**Full design.** Two short sessions bracketing the day, same layout every time.

*Morning.* The app speaks the anchor: today is Monday, the 8th of September,
it looks like rain. Then three or four cards for what is happening — medicine
at eight, Ankit visits in the afternoon, church on Sunday. The elder taps
through each. No recall demanded; this half is orientation only.

*Evening.* The same items return as gentle prompts. "Who came today?" Options
appear as cards. If the elder cannot recall, the app shows the answer warmly
after the hint ladder and moves on. Never more than four items — overloading is
disorienting, and the count is a hard cap, not a difficulty knob.

The caregiver populates the week's plan once; it takes about two minutes.

At severe stage, the evening recall half is dropped entirely. Only the gentle
morning anchor remains. Rigid orientation at severe stage causes distress and
validation-based approaches are preferred — this is a clinical boundary, not a
scope decision.

**Difficulty.** Controls the evening prompt format only: free recall at high
values, two-option recognition at low. Never the item count.

**Telemetry.** **Evening recall proportion** — the single most valuable metric
in the product. Also hesitation before response, and whether the morning session
was opened at all.

**Content.** Caregiver-entered events, plus the four reminder types.

**MVP.** Morning screen: date line spoken, three hardcoded cards, tap to
acknowledge. Evening screen: the same three as two-option recognition, hint
ladder wired, recall proportion written to telemetry. Caregiver entry can be a
plain form. Half a day.

---

## 3. Who's who

**Cognitive basis.** Face-name association is among the first things to go and
among the most distressing to lose. This is the game that carries **spaced
retrieval**, which is the technique with the strongest evidence for actually
teaching a person with dementia to retain specific information.

**Full design.** The family uploads photographs and tags each with a name and
relationship. The app shows a photo and asks who it is.

The scheduler is the point. When the elder correctly identifies a face, that
item is queued to return at an expanding interval — 30s, 1m, 2m, 4m, 8m, then
1 day, then 3 days. Each success steps the interval up. A failure shows the
answer immediately, drops the interval back one step, and re-asks now. The item
is never left in a failed state.

Prompts inject into other games too. Mid-recipe, the app may ask "who is
cooking with you today?" — that is this scheduler firing, not a separate feature.

Stage shifts the format: free recall at mild ("who is this?"), two-option
recognition at moderate ("is this Bijoy or Ratan?"), and at severe it becomes
pure reminiscence — the app names the person warmly and tells a short story the
family recorded, with nothing asked in return.

**Difficulty.** Free recall versus 2-option versus 4-option recognition, and
how visually similar the distractors are.

**Telemetry.** Interval level reached per item, retention across days, response
latency, hint level required. Per-item mastery is the cleanest cognitive signal
you will collect.

**Content.** Family photographs, tagged. Consent required for each.

**MVP.** Five hardcoded photos with names. Four-option recognition. The
scheduler with the first five short intervals only (skip the 1-day and 3-day
tiers for the demo — nobody will wait). Show the interval expanding on screen
during the demo, then force a failure and show the drop-back. Half a day.

---

## 4. Recipe

**The flagship.** The most visually appealing screen, the most culturally
specific, the one you demo in depth. If time runs short, cut another game and
finish this one.

**Cognitive basis.** Sequencing is a core executive function and recipes are
inherently ordered. Cooking knowledge is deep procedural and semantic memory,
so an elder can succeed well into moderate stage. Food is also the least
stigmatised possible framing — nobody feels tested by being asked how they make
macher jhol.

**Full design.** The elder and grandchild choose a dish. The app presents
ingredients as a grid; the elder directs and the child taps them into the pot
in order. The prompt is spoken, always: "what goes in next?"

Crucially, ingredient choices are **not marked wrong** — recipes vary by
household and that variation is the point, not an error. Only clear sequence
violations (fish before the oil is hot) trigger the hint ladder, and gently.
The app should support "that's how we make it" as a valid outcome, saving the
family's variant.

After assembly, the elder narrates the steps and the app records the audio.
That recording is simultaneously a family archive, a reminiscence asset, and
later a speech sample.

**Difficulty.** Number of ingredients shown, number of distractors, and whether
step order is prompted or free.

**Telemetry.** Sequence edit distance from the family's own stored version —
not from a canonical recipe. Perseveration count (repeatedly reaching for the
same item). Category omission. Time per step.

**Content.** Regional and specific. For the Tripura / Barak demo: macher jhol,
shukto, panta bhat, pitha, and Tripura-specific dishes like gudok, chakhwi,
berma. Ingredients drawn as recognisable local items.

**MVP.** One dish. Six ingredients in a 2x3 grid, four correct in sequence.
Spoken prompt per step. Full hint ladder with the amber reveal state. Narration
recording optional if time allows. This is the screen that must look finished —
budget real polish hours, not leftover ones.

---

## 5. Packing

**Cognitive basis.** An instrumental activity of daily living, not an abstract
puzzle. IADLs are what dementia actually degrades, which makes this a far better
answer to "what does this measure?" than a matching game. Tests planning,
categorisation and executive function together.

**Full design.** An occasion is announced — "we're going to Durga Puja
tomorrow, help me pack." A grid of items appears and the elder chooses what to
bring. The suitcase fills as they tap.

**Nothing is ever rejected.** If a contextually odd item goes in, the app
responds warmly ("that's a good one to have") rather than blocking. Scoring
happens silently in telemetry. This is preparation, not evaluation — the
reframe from the obvious version of this game, which would be a test with a
right answer.

Occasions should be genuinely local: Durga Puja, Poila Boishakh, Kharchi Puja,
a church service, a hospital visit, a trip to the paddy field. Items likewise —
gamosa, umbrella, medicines, shawl, a dao, offerings.

**Difficulty.** Grid size and distractor count.

**Telemetry.** Which category they reach first, perseveration on one item, and
**whole-category omission** — forgetting every item of a type is a documented
executive-decline pattern and a much stronger signal than a low score.

**MVP.** One occasion. Eight items in a 2x4 grid, tap to add to a visible
suitcase strip. No rejection logic at all — every tap accepts. Warm audio
acknowledgement per tap. Category omission computed in telemetry. Two to three
hours once the grid component exists.

---

## 6. Skill transmission

**Cognitive basis.** Procedural memory — motor skills and habits — is preserved
far longer than episodic memory. Someone who cannot recall their grandchild's
name can often still tie a knot, fold cloth, or weave. Building around what the
elder still *has* is neurologically correct, not merely kind.

**Full design.** The app pairs a familiar real-world skill with a calm digital
rehearsal. The elder can demonstrate and the companion can participate. The
interaction uses one large, forgiving action at a time; it never labels an
action wrong or presents itself as the authority on the elder's technique.

The digital rehearsal is deliberately symbolic rather than a prescriptive
tutorial. It supports the shared activity without making the elder redundant.

Optionally the child records the elder explaining it — another archive asset.

**Difficulty.** Does not apply. Skills are suggested by what the family has
marked as known, not by a difficulty float.

**Telemetry.** Completion, duration, repeat engagement. Not a cognitive measure.
Its value is dignity and transmission.

**MVP.** The fixed catalogue remains caregiver-configured. Shoelace tying,
gamosa folding, and shirt buttoning have playable swipe-and-drag interactions;
completion is detected from the interaction rather than a generic completion
button. The remaining catalogue skills stay out of Patient Mode until their
interactions exist. A completion photo remains optional and local.

---

## Build order and time budget

| Order | Game | MVP estimate | Why here |
|---|---|---|---|
| 1 | Song circle | 2 hrs | De-risks audio on day one |
| 2 | Day's plan | 4 hrs | Telemetry backbone |
| 3 | Who's who | 4 hrs | Carries spaced retrieval |
| 4 | Recipe | 6 hrs + polish | Flagship, must look finished |
| 5 | Packing | 3 hrs | Reuses the grid component |
| 6 | Skill | 1 hr | Cheapest, strongest idea per hour |

Build the grid component once during Who's who and reuse it for Recipe and
Packing. If you find yourself writing three grid implementations, stop.

The two games at the bottom are the ones to lose if time runs out. Never cut
Recipe, and never cut the hint ladder from any game — it is the product.
