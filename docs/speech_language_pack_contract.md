# Saathi speech and language-pack contract

This is the extension boundary for offline text-to-speech (TTS) and speech-to-text (STT). The MVP ships page speech JSON for English, Hindi, Assamese, and Bengali. Assamese and Bengali can download the pinned Sherpa-ONNX model files from the teammate's Hugging Face repository; English and Hindi intentionally use the operating-system voice because that repository does not publish matching models for those languages.

The teammate repository is reference material for the model layout and inference settings. Its app code is not a runtime dependency of Saathi. Saathi uses `react-native-sherpa-onnx` as its own native runtime and therefore requires an Expo development or release build; the offline model cannot run inside Expo Go.

## Pack directory

Downloaded files live under Expo's app document directory and never in analytics storage:

```text
speech-packs/
  as/
    models/
      tts/model.onnx
      tts/tokens.txt
      stt/model.int8.onnx
      stt/tokens.txt
```

`src/speech/catalog.ts` pins the remote repository revision, expected byte sizes, and SHA-256 checksums. `src/speech/packStorage.ts` owns directory creation, sequential download progress, verification, and readiness checks. Each file is downloaded to a `.part` path, checked for exact size and SHA-256, and only then moved into its final location. A partial pack remains `incomplete` and is never passed to the model runtime.

## Page speech JSON

Every patient page has one JSON document containing ordered, stable utterance IDs. `groupId` enables a whole-page read or a single-card read without copying text into UI handlers.

```json
{
  "schemaVersion": 1,
  "pageId": "member.games",
  "languageCode": "en",
  "title": "Games",
  "summary": "Choose one calm activity for today.",
  "utterances": [
    {
      "id": "games.recipe.description",
      "groupId": "recipe",
      "kind": "description",
      "text": "Follow a familiar recipe, one calm step at a time."
    }
  ]
}
```

IDs stay stable across translations. Each language pack supplies its own text and command phrases. Do not fall back to spoken English on a non-English patient screen; show normal touch navigation until that pack is ready.

## Runtime boundaries

- `src/speech/runtime.ts` is the TTS adapter boundary. `src/speech/nativeRuntime.ts` registers the downloaded VITS model for Assamese and Bengali and falls back to `expo-speech` if native initialization or generation fails.
- `src/speech/recognition.ts` is the STT adapter boundary. The downloaded pack includes the CTC model for the later voice-command control; Saathi still owns allowlisted intent matching.
- `src/services/voice-navigation/matcher.ts` normalizes and matches a transcript against phrases in the active manifest. Low-confidence or unrelated speech returns `unknown`.
- `src/services/voice-navigation/types.ts` is the allowlist. Model output cannot invent a navigation or game action.

The intended pipeline is:

```text
microphone audio -> active pack STT model -> transcript
  -> local allowlisted matcher -> safe navigation intent -> existing screen router
```

For the first STT release, allow only opening a game, returning to Games, repeating audio, and stopping. Voice must not select an answer, confirm medication, archive data, or emit a game-success event. Those actions remain explicit taps.

## Patient UX

- Selecting a language never blocks entry to the app. When an offline pack is available, it begins downloading in the background and a truthful progress card remains visible on member and caregiver dashboards. Touch navigation remains fully available; Listen uses the device voice until all downloaded files verify, then switches to the offline model.
- Keep one visible **Listen to this page** card near the beginning of a patient screen.
- A game card may add **Listen to this card** when its description is useful independently.
- Starting speech stops the previous speech. Speech never loops or auto-opens an activity.
- Do not make double-tap or long-press the only listening gesture. They are optional shortcuts at most; the labelled button remains visible.
- The microphone action is a labelled 64px floating control placed above the bottom navigation after the active STT pack is verified. It opens a non-modal voice tray with a large listening state, a Stop action, and one short example. It must not cover navigation or focused content.
- If the pack is unavailable, hide the microphone action and keep touch navigation unchanged. Do not show a broken or permanently disabled control.
- After a confident navigation command, speak a short confirmation such as “Opening Recipe” and navigate. For `unknown`, say “I did not catch that. You can tap a game below.” Do not show a red failure state.

## Adding a language or page

1. Add translated page JSON with the same utterance and group IDs.
2. Add a manifest with model paths and locally reviewed command phrases.
3. Register bundled preview pages in `src/speech/packRegistry.ts`, or load downloaded pages after manifest validation.
4. Test exact phrases, likely transcription mistakes, and unrelated speech.
5. Review every spoken string with a fluent speaker before treating the pack as release-ready.
