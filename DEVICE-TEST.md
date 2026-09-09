# Saathi Android device test

Use a real Android phone before a judge demo. The supported first-run path is: choose language, guardian setup/sign-in, add at least three real familiar memories, then open Patient Mode.

## Fast phone test with Expo Go

1. Install **Expo Go** from Google Play on the Android phone.
2. Put the phone and development computer on the same Wi-Fi network.
3. From this project folder, run `npx expo start --lan`.
4. Scan the displayed QR code with Expo Go.

Check on the phone:

- Choose an image, then restart the app and confirm the image remains.
- Record name and personal-note audio, replay both, then restart and replay again.
- Add three memories and complete the nine-card Who’s Who round.
- Turn airplane mode on: existing memories, audio, SQLite events, and review flow must still work.
- Return online and sign in as a guardian; check that guardian login recovers correctly after a bad password.
- Allow notifications, complete a review, and verify the next reminder is scheduled.

## Installable APK

After signing in to an Expo account, run `npx eas-cli@latest build --platform android --profile preview`. The `preview` profile in `eas.json` produces an installable APK. Download the generated APK from the Expo build link and install it on the test phone.

Do not put any patient photos, audio, database files, or Supabase service-role keys in the repository or APK configuration.
