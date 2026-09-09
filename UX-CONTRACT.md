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
| Game telemetry and adaptive behavior | `docs/producer_contract.md` when storage/controller work is added |
| Patient data lifecycle | `AGENTS.md` and future storage/privacy contract |

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
| Navigation | `App.tsx` screen-state router | patient / guardian |

## Flow ledger

| Operation | Trigger | Success behavior | Failure / recovery |
|---|---|---|---|
| Select language | Tap language pack | Saves active pack locally in app state; opens guardian onboarding | Continue stays disabled until a pack is chosen |
| Complete guardian setup | Continue | Opens guardian sign-in | Values remain visible for correction |
| Guardian sign-in | Sign in button | Opens guardian dashboard | Inline validation, no native dialog |
| Add Who’s Who member | Save person | Adds locally to the manager list and returns to the list | Keep form values and explain missing required fields |
| Archive member | Archive action | Removes item from active patient sessions in this demo | Uses a reversible local-only notice; no hard delete |
| Patient recall response | Tap answer tile | Gives calm confirmation or amber assistance; remains in task | Never shows a failure state |

## Offline behavior

All demo content is imported from `src/data/seed.js`; the UI works without a backend. Future persistence must remain device-first, and any remote upload/sync status must be shown truthfully rather than implying server confirmation.
