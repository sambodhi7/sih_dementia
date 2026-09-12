# Recipe game — first playable version

Entry: Patient Mode → Our family kitchen. Existing games remain available.

- Vegetable Thukpa: ingredient selection, adding to pot, stirring, serving.
- Til pitha: rice flour, spreading, sesame/jaggery filling, rolling, serving.
- Chakhwi: simplified prepared bamboo shoot / green papaya scene, adding, stirring, serving. Not a complete or authoritative cooking recipe; household recipe validation remains necessary.
- Large gesture surface accepts forgiving movement in any direction; a 68px labelled action button and accessibility activation provide an equivalent alternative.
- No countdown, red errors, or public score. Ingredients remain visible in the dish. A different ingredient order can be accepted as the family's way.
- SVG artwork uses theme colors; speech is device TTS. All recipe strings live in `src/games/recipe/copy.ts`. Currently English only; other locale selections explicitly fall back to English. Regional language recordings/translations are not implemented yet. Offline speech depends on installed device voices.
- Existing native SQLite sessions/events and sync queue are reused; web uses the existing local snapshot. Raw interaction events are saved immediately. Recipe is excluded from derived patient scores and controller updates: this first version is not a validated cognitive assessment.
- Last ingredient order is stored locally per patient/dish. It is not yet a caregiver-editable recipe or learned scoring baseline.
- Leaving keeps a session incomplete/unscored. Completion closes it without an outcome or controller state.

## Cultural references

- Assam Tourism cuisine: https://assamtourism.gov.in/cuisine.php
- Sikkim Tourism, Thukpa: https://sikkimtourism.gov.in/DownloadableFiles/June%20Newsletter.pdf
- Tripura Tribal Research & Cultural Institute collection: https://repository.tribal.gov.in/upload/bitstream/123456789/61841/1/TR%26CI_2004_book.pdf

## Verification

Verified: typecheck, adaptive regression suite, recipe catalogue checks; browser Til pitha from selection through completion, flour drag, button fallback, jaggery-before-sesame filling. Browser TTS had no available voice and correctly showed the reading fallback. Physical Android touch/voice testing remains outstanding.

Run npm test and the recipe catalogue check. Manually check all recipes, filling in both orders, a family variation, replay/hint, drag and tap fallback, restart and hardware back on Android. No actual heat, raw-food preparation or medical instruction is simulated as safety advice.
