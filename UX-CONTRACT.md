# Saathi UX Contract

## Product context

- **Audience:** Elderly patients use the patient app; guardians configure family content and open the guardian tools.
- **Primary jobs:** Choose a language pack, create a patient profile, manage familiar people/items, and complete a calm Who’s Who learning or recall activity.
- **Target market:** North Eastern India; the interface supports language packs rather than one hardcoded language.
- **Accessibility target:** WCAG 2.2 AA and the stricter patient interaction rules in `DESIGN.md`.

## Business-context sources

| Domain / scope | Authoritative source |
|---|---|
| Game interaction and dignity | `AGENTS.md`, `DESIGN.md` |
| Game telemetry and adaptive behavior | `docs/producer_contract.md`, `src/adaptive/types.ts`, `docs/storage_contract.md` |
| Patient data lifecycle | `AGENTS.md`, `docs/storage_contract.md`, `docs/supabase.md` |

## Visual contract

- **Project visual system:** `DESIGN.md`
- **Token owner:** `src/theme.ts` is the runtime adapter for approved `DESIGN.md` tokens.
- **Themes:** Light only for the patient-facing MVP; no automatic dark mode.

## Canonical UI Map

| Capability | Canonical owner | Allowed variant |
|---|---|---|
| Buttons | `src/components/ui.tsx` `ActionButton` | primary / secondary / quiet |
| Forms | `src/components/ui.tsx` `Field` | guardian setup / guardian login / member editor |
| Notices | `src/components/ui.tsx` `Notice` | neutral / support |
| Content list | `src/components/ui.tsx` `MemberRow` | Who’s Who manager only |
| Skill catalogue cards | `src/games/skillTransmission/SkillCards.tsx` | caregiver manager / patient activity list |
| Who’s Who practice insights | `src/components/WhosWhoMetrics.tsx` | guardian-only metric cards |
| Navigation | `src/SaathiWorkflow.tsx` screen-stack router | patient / guardian; Android, visible, and voice back share one history |
| Patient speech controls | `src/components/speech.tsx` | page listen / card listen |
| Speech pack content and runtime | `src/speech` | bundled preview / downloaded offline pack |

## Flow ledger

| Operation | Trigger | Success behavior | Failure / recovery |
|---|---|---|---|
| Select language | Tap language pack | Keeps the selected pack in the current local session and opens onboarding | Language packs must remain data-driven; no locale is hardcoded into a feature flow |
| Create or sign in guardian | Account action | Supabase Auth signs the guardian in; care-circle creation runs only through the protected Edge Function | Inline recovery preserves form values; patient mode remains available without sign-in |
| Add or edit Who’s Who memory | Save person/item | Saves name, relationship, note, photo URI and audio URIs into local-first storage; returns to library | Keep the draft visible and explain missing required name/relationship |
| Archive memory | Archive action then explicit inline confirmation | Soft-archives it locally and removes it from future patient choices | No telemetry or media is deleted; restore controls are intentionally not yet exposed in this MVP |
| Review Who’s Who practice insights | Guardian selects “Who’s Who · practice insights” | Reads completed local Who’s Who rounds and their saved controller state | Shows a non-diagnostic support summary; interrupted rounds are reported only as stopped activity and do not affect performance values |
| Export member practice report | Guardian selects “Download PDF report” in Practice Insights | Reads local routine, completed practice, controller state, and metrics; opens Save as PDF on Android/web or a PDF share sheet on iOS | Example graph values are clearly marked as illustrative when no member practice exists; failures leave stored data unchanged and offer retry; sharing is initiated only by the guardian |
| Plan daily routine and medication reminders | Guardian selects “Daily routine and medication reminders” in Caregiver Area | Saves each named, timed routine item locally and schedules a device-local daily medication alarm when permission is granted | The written routine always remains usable offline; if notification permission is unavailable, show the plan without claiming an alarm is active |
| Learning exposure | Practice now | Reveals familiar frame, then marks the item learned locally before a supported recall | Learning exposure is not scored recall |
| Patient recall response | Tap a name or a photo option | Runs a complete, interleaved practice round: photo→name, name→photo, and relationship/personal-note clue→photo for every active memory; prefer a different memory and prompt form on each next card | After all `active memories × 3` prompts, return Home with a calm “come again later” message; wrong responses remain private and receive the association before retry |
| Leave active recall | Home | Appends an abandonment event and pauses/reschedules only through the per-item distress rule | Interrupted sessions do not create a scored outcome |
| Configure Skill Transmission | Record a caregiver prompt, then show/hide a fixed catalogue skill | Saves the local prompt and visibility state; no custom skill creation is offered | A missing or denied microphone permission keeps the skill hidden and preserves all existing settings |
| Complete Skill Transmission | Finish every large, forgiving touch action in a supported skill | Detects completion automatically, appends engagement-only events, stores an optional local completion photo, and returns to skill choices or Home | A missed gesture resets calmly; leaving before completion marks the activity interrupted with no controller outcome or cognitive score |
| Listen to a patient card or prompt | Tap its visible Listen action | Stops any current speech and reads that ordered utterance group once | When the active language pack is unavailable, normal touch navigation remains available and no mismatched language is spoken |
| Use a voice navigation command | Tap the labelled microphone action on a member tab or supported patient activity after an STT pack is ready | Resolves an allowlisted game destination or “back” command through the same screen router and exit/session handling used by touch navigation | Low-confidence speech performs no action and gives calm guidance; voice never answers a game or confirms a medication task |
| Enable auto-read | Turn on the labelled dashboard-header switch | Reads each newly opened member/caregiver tab or patient activity state once and speaks tapped option labels in the selected language | Turning it off stops speech immediately; touch controls remain fully usable when speech is unavailable |
| Return from a page or activity | Use Android Back, the visible Back/Home action, or the allowlisted voice “back” command | Pops the actual visit history; active activity sessions first use their canonical interrupt/close path, and the app-exit dialog appears only at a root screen | A missing history entry resets to the appropriate Member or Caregiver root without reopening the activity |

## Offline behavior

`src/storage/localStore.ts` is the patient-device source of truth. On native devices it uses SQLite; the web preview uses an AsyncStorage fallback solely for development. Media selected during direct patient-phone setup is copied into the app’s local storage and is never queued for sync. Each event is appended and persisted immediately; sessions, outcomes, and controller-state trajectory use the established outbox path.

Remote family uploads are not part of this direct-device workflow. When built, they must use temporary encrypted delivery and truthful delivery status rather than presenting a cloud copy as local-only.
