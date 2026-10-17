# The teacher card (#26)

Checks of 17 October 2026 for [#26](https://github.com/djazairdev/minhajna/issues/26), on `feat/26-card`. Made-up teacher and schools only.

## What changed

- **A new layer, `device`,** holds the teacher card's personal fields. They never leave the device: no sync to the teacher's other devices, no full export, no statement, handover or school space. Only the documents made on the device print them, as the PRD says of the card and the drawn signature (§3.2, §5.6).
- **The core's card** splits in two:
  - `teacher.set` keeps the printed rank and travels with the lesson record;
  - `teacher.personal.set` keeps the name, optional, in the `device` layer.
  The subjects, schools and school year come from step 1 and the calendar, so the card no longer repeats them.
- **Setup-3-Card** follows step 1, as step 2 of 5:
  - the name, marked «شخصي · اختياري»;
  - the rank;
  - the subjects, the school year and the schools, shown but not typed again.
  
  Each field is saved once typing pauses, when it is left, or when the screen closes. «التالي» and «لاحقاً» both lead on; the classes come with #27, so for now they lead to the tabs.
- The drawn signature row is left out: it comes with the documents (R-3.8-41, R-3.8-47).
- «لاحقاً» and «حذف هذه المؤسسة» are now centred, as the screens draw them.

## Checks

| Check | Result |
|---|---|
| Core tests | 183 pass, 3 of them new in `personal.test.ts`: the personal fields reach only the documents, never the teacher's own sync or export nor any route out, while the printed card travels with the lesson record. The demo year gains the card's personal entry (397 entries, 261,075 bytes) |
| Android tests | 475 pass, 13 of them new in `card.test.tsx`: the layers the two fields are stored in, the pause and leaving the field, an emptied name, reopening, both buttons saving what is still being typed, no fixed text height, and every control named and 48dp in the three languages, both directions |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | The card matches Setup-3-Card, with the subjects and school from step 1 and the year 2026-2027. A rank typed there was still there after the app was stopped and opened again |

## Still to do by a person

TalkBack in Arabic on this step, with the other setup screens (see the BrowserStack note on #20).
