# Voice navigation integration contract

This is an optional online navigation feature. It is not a chat system and does not replace local touch controls.

## Client request

The Saathi client POSTs `multipart/form-data` to `EXPO_PUBLIC_VOICE_NAVIGATION_API_URL`:

- `client_thread_id` — UUID created by client
- `client_msg_id` — UUID created by client
- `patient_id` — current local patient UUID
- `language_code` — active language pack code
- `audio` — one temporary recorded command

The client sends a guardian session JWT as `Authorization: Bearer <token>` when available.

## Response

```json
{ "intent": "start_whos_who", "confidence": 0.94, "transcript": "start who's who" }
```

Allowed intents are `start_whos_who`, `repeat`, `go_home`, `caregiver_area`, `stop`, and `unknown`. Any other value is rejected client-side.

## Privacy and backend rules

- The API must authenticate the guardian and validate they may access `patient_id`.
- It may use the teammate's `threads` and `messages` schema, but those tables must include `patient_id` and reuse `auth.users`/`profiles`; do not add another users table.
- Audio must be private, encrypted at rest, short-retention, and purged after processing unless explicit recovery consent exists.
- Return an intent only. The API must not return medical advice, invented personal information, or arbitrary navigation targets.
- On API failure/offline state, the app leaves touch navigation fully usable and does not retain the failed recording.
