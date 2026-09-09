# Saathi Supabase Contract

## Purpose and boundary

Supabase supports authenticated guardian access, a privacy-safe caregiver dashboard, and **temporary** remote delivery of family media. It is not the patient device's database of record.

- Expo SQLite remains authoritative for items, review schedules, sessions, raw events, and adaptive-controller state.
- The device syncs an append-only mirror to Supabase through the outbox described in `storage_contract.md`.
- Supabase must never routinely overwrite local controller state or local spaced-repetition state.
- Direct setup on the patient phone is entirely local: no image, audio, personal note, or Who's Who item is uploaded merely because it was added.
- A remote guardian setup uses encrypted, short-lived delivery storage. It is purged after verified download or expiry, unless the guardian has explicitly opted in to a recovery copy.

Read this with `producer_contract.md`, `storage_contract.md`, and `src/adaptive/types.ts`. These contracts define the event data and the device-side source of truth.

## Data model

```text
auth.users
  └─ profiles
       └─ patient_guardians ── patients ── patient_devices
                                 ├─ whos_who_items
                                 ├─ game_sessions ── game_events
                                 │                    └─ session_outcomes
                                 ├─ controller_state_history
                                 ├─ patient_daily_summaries
                                 ├─ media_deliveries
                                 ├─ caregiver_alerts
                                 ├─ consent_log
                                 └─ access_audit_log
```

| Table | Role | Important fields |
| --- | --- | --- |
| `profiles` | Guardian identity and preferences | `id` (= `auth.users.id`), `display_name`, `preferred_language_code` |
| `patients` | Minimal patient record | `id` (stable UUID created by device), `display_name`, `preferred_language_code`, `timezone` |
| `patient_guardians` | Authorization relationship | `patient_id`, `guardian_id`, `role`, `status` |
| `patient_devices` | Registered device trust record | `id`, `patient_id`, `public_key_fingerprint`, `revoked_at` |
| `whos_who_items` | Dashboard-safe item metadata mirror | `id` (= local stable `itemId`), `patient_id`, `display_name`, `relationship`, `learning_only`, `archived_at` |
| `game_sessions` | One mirror row per device session | client UUID `id`, `patient_id`, `game_id`, `started_at`, `ended_at`, `completion_state`, `companion_present` |
| `game_events` | Append-only raw producer events | client UUID `id`, `session_id`, `seq`, `type`, JSON `payload`, `at` |
| `session_outcomes` | Extracted outcome, one per completed session | `session_id`, rates, latency, `was_abandoned` |
| `controller_state_history` | Append-only adaptive trajectory | `id`, `patient_id`, `game_id`, `session_id`, `difficulty`, `hint_time_seconds`, `source`, `at` |
| `patient_daily_summaries` | Fast dashboard read model | `patient_id`, `day`, `game_id`, completion and support-needed aggregates |
| `media_deliveries` | Temporary remote media transfer state | `id`, `patient_id`, `item_id`, `storage_path`, `expires_at`, `verified_download_at`, `purged_at` |
| `caregiver_alerts` | Non-diagnostic, reviewable support signals | `patient_id`, `kind`, `item_id`, `status`, `created_at` |
| `consent_log` / `access_audit_log` | Consent and sensitive-access evidence | actor, patient, action, timestamp |

`display_name` and `relationship` in `whos_who_items` are guardian-authorized metadata. Family photos, audio, and a personal note's plaintext are never placed in analytics rows or event payloads. If a remote personal note must exist before delivery, store only device-encrypted ciphertext in the delivery record and purge it with the delivery object.

## Migration-ready schema

The following is the intended first migration. Create an actual migration with `supabase migration new <name>` once a Supabase project is linked; do not paste a new migration filename by hand.

```sql
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  preferred_language_code text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key,
  display_name text not null,
  preferred_language_code text not null default 'en',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_guardians (
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'caregiver', 'clinician_readonly')),
  status text not null default 'active' check (status in ('invited', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (patient_id, guardian_id)
);

create table public.patient_devices (
  id uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  public_key_fingerprint text not null,
  registered_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (patient_id, public_key_fingerprint)
);

create table public.whos_who_items (
  id text primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  display_name text not null,
  relationship text,
  learning_only boolean not null default false,
  archived_at timestamptz,
  source text not null check (source in ('patient_device', 'remote_guardian')),
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.game_sessions (
  id uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  game_id text not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  phase text check (phase in ('morning', 'evening')),
  completion_state text not null check (completion_state in ('completed', 'abandoned', 'interrupted')),
  companion_present boolean not null default false,
  synced_at timestamptz not null default now()
);

create table public.game_events (
  id uuid primary key,
  session_id uuid not null references public.game_sessions(id) on delete restrict,
  seq integer not null check (seq >= 0),
  type text not null,
  payload jsonb not null,
  at timestamptz not null,
  unique (session_id, seq)
);

create table public.session_outcomes (
  session_id uuid primary key references public.game_sessions(id) on delete restrict,
  scored_actions integer not null check (scored_actions >= 0),
  success_rate numeric,
  unassisted_rate numeric,
  median_latency_seconds numeric,
  was_abandoned boolean not null,
  successful_scored_actions integer not null check (successful_scored_actions >= 0),
  unassisted_scored_actions integer not null check (unassisted_scored_actions >= 0),
  created_at timestamptz not null default now()
);

create table public.controller_state_history (
  id uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  game_id text not null,
  session_id uuid not null references public.game_sessions(id) on delete restrict,
  difficulty numeric not null,
  hint_time_seconds numeric,
  source text not null check (source in ('calibration', 'tracking', 'frozen')),
  at timestamptz not null
);

create table public.patient_daily_summaries (
  patient_id uuid not null references public.patients(id) on delete cascade,
  day date not null,
  game_id text not null,
  sessions_completed integer not null default 0,
  independent_recall_rate numeric,
  supported_recall_rate numeric,
  last_played_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (patient_id, day, game_id)
);

create table public.media_deliveries (
  id uuid primary key,
  patient_id uuid not null references public.patients(id) on delete cascade,
  item_id text references public.whos_who_items(id) on delete set null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  encrypted_metadata jsonb,
  expires_at timestamptz not null,
  verified_download_at timestamptz,
  purged_at timestamptz,
  recovery_copy_authorized boolean not null default false,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.caregiver_alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  item_id text references public.whos_who_items(id) on delete set null,
  kind text not null check (kind in ('repeated_support_needed', 'item_paused', 'sync_attention')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.consent_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  at timestamptz not null default now()
);

create table public.access_audit_log (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id text,
  at timestamptz not null default now()
);

create index game_sessions_patient_started_idx on public.game_sessions (patient_id, started_at desc);
create index game_events_session_seq_idx on public.game_events (session_id, seq);
create index controller_history_patient_game_at_idx on public.controller_state_history (patient_id, game_id, at desc);
create index summaries_patient_day_idx on public.patient_daily_summaries (patient_id, day desc);
create index deliveries_expiry_idx on public.media_deliveries (expires_at) where purged_at is null;
```

Do **not** create a server-side `controller_state` table as a write-back source. The optional server snapshot is dashboard-only and can be derived from the latest append-only history row. The on-device `controller_state` from `storage_contract.md` is authoritative.

## Row-level security and access model

All `public` tables must have RLS enabled and explicit grants. `anon` receives no access. `authenticated` receives only the required dashboard `SELECT` permissions; it does not receive direct permission to insert device telemetry.

The guardian access predicate used by dashboard policies is:

```sql
exists (
  select 1
  from public.patient_guardians pg
  where pg.patient_id = <row>.patient_id
    and pg.guardian_id = (select auth.uid())
    and pg.status = 'active'
)
```

Apply that predicate to `SELECT` policies for patient-scoped dashboard rows. For guardian-managed writes, require the same predicate in both `USING` and `WITH CHECK`, and restrict writes to an `owner` or `caregiver` role. `clinician_readonly` gets `SELECT` only.

Recommended write boundary:

| Actor | Allowed path |
| --- | --- |
| Guardian web dashboard | Direct authenticated reads; narrowly scoped writes for guardian relationship/remote-delivery requests |
| Patient device | Edge Function `sync-device-outbox`, authenticated with a registered device credential; function validates ownership, idempotency, session/item relationship, and event sequence before inserting mirror rows |
| Guardian onboarding | Edge Function `create-care-circle`, authenticated with the guardian JWT; it creates the patient, owner membership, and consent row atomically through a server-only RPC |
| Media purge worker | Scheduled Edge Function using server-only credentials |
| Dashboard summary worker | Server-side job or Edge Function, never client-side aggregation |

The Supabase `service_role`/secret key is only allowed in Edge Functions or trusted server jobs. It must never enter Expo code, the web bundle, `.env.example`, or a client-facing API response.

## Authentication and live implementation

Guardian authentication uses Supabase Auth email/password sessions. The Expo client uses the project URL and **publishable** key from `EXPO_PUBLIC_*` variables, with `@react-native-async-storage/async-storage` as the session store. The service-role key is not present in the app.

On every Auth sign-up, the database trigger `on_auth_user_created` provisions a matching `profiles` row. After sign-in, first-time guardians call the JWT-protected `create-care-circle` Edge Function. That function is deployed with JWT verification enabled, checks the authenticated user, and invokes the `service_role`-only `server_create_patient_care_circle` RPC. The browser cannot execute either privileged RPC directly.

Email confirmation behavior is controlled in Supabase Auth settings. The app already handles a confirmation-required sign-up by asking the guardian to confirm their email and sign in afterward.

## Storage: remote delivery only

Create a **private** bucket named `remote-family-media`. Use object paths in this form:

```text
<patient-id>/<delivery-id>/<encrypted-file-name>
```

- Store an encrypted blob, never public media.
- Do not issue permanent public URLs.
- Guardians can create a delivery only for a patient to whom they have active access.
- The patient device receives a short-lived signed download URL from the authenticated delivery endpoint.
- After the device verifies decryption and persists the local asset, it calls `confirm-delivery`. The server records `verified_download_at`, removes the object, and sets `purged_at`.
- A scheduled purge removes expired, unconfirmed objects. Recovery retention is permitted only when `recovery_copy_authorized = true` and must have a documented retention limit.

Supabase Storage access is governed by RLS policies on `storage.objects`; a private bucket alone is not sufficient. Storage upsert requires `INSERT`, `SELECT`, and `UPDATE` permissions, but Saathi should avoid client upserts and use immutable delivery paths instead.

## Sync and analytics rules

1. Each event is inserted locally first and queued immediately in SQLite.
2. The outbox sends immutable rows with client-generated IDs; server inserts are idempotent on those IDs.
3. `game_events`, `game_sessions`, `session_outcomes`, and `controller_state_history` flow device → server only.
4. Interrupted sessions retain `completion_state = 'interrupted'` and do not acquire a fabricated abandonment/outcome record.
5. Assisted sessions remain engagement/correctness data, but `companion_present = true` lets all server summaries exclude latency from calibration-style interpretations.
6. Dashboard copy is non-diagnostic: “more support than usual,” not “cognitive decline” or a diagnosis.
7. `payload` must follow the canonical producer types and must not contain photo URIs, audio URIs, personal-note plaintext, encryption keys, or other family media.

## Implementation checklist

Before connecting the app:

1. Link the correct Supabase project and create the migration through the Supabase CLI.
2. Enable RLS and set explicit grants in that same migration for every exposed table.
3. Add allow/deny tests for `anon`, unauthorized guardians, active guardians, revoked guardians, and readonly clinicians.
4. Implement `sync-device-outbox` and test duplicate delivery, an expired device credential, cross-patient item IDs, and non-monotonic event sequences.
5. Create the private bucket and test that a guardian cannot list or fetch another patient's delivery object.
6. Test the verified-download purge and expiry purge against a disposable media object.
7. Run Supabase database security advisors before production.

## Deliberate non-goals for the MVP

- No public media bucket.
- No automatic server-to-device controller-state restore.
- No diagnostic scoring, clinical decisions, or model training on raw family media.
- No unbounded raw media retention.
- No direct client access to server-only keys.
