# Plan packs at setup (#30)

Checks of 17 October 2026 for the second pull request of [#30](https://github.com/djazairdev/minhajna/issues/30), on `feat/30-plan`, after the pack catalogue (#153). Made-up schools, classes and packs only.

## What changed

- **Setup-6-Plan** is setup's step 5 of 5, after the week. Each grade and subject the teacher teaches has a card:
  - the pack its classes are pinned to, with its status badge, its timing and release, and where it comes from (R-2.3-01, R-4.2-08, R-4.2-09);
  - or «لم تُثبَّت حزمة بعد.» with «اختيار حزمة»;
  - or, when no pack exists for the grade, that the items are typed and the book works as with a pack;
  - each class's pin under «مثبّت لـ», such as «4AM3 · 2026.1» or «… · دون حزمة» (R-3.2-27, R-4.2-01).
- **The national calendar** shows as built in, «مدمجة» (R-3.2-29, R-4.8-01). Its own screens, and adding a closure, come later.
- **«إنهاء الإعداد»** leads to the tabs until the September check (#31) takes its place.
- **Setup-6b-Packs** lists the grade's packs, what applies best first, with each pack's status, timing, release and source, and «دون حزمة: كتابة العناصر».
  - Under them, what each status means: official, in force, latest found, community, example and stale.
  - The pack is pinned to the classes chosen, all of them at first. A class with a course keeps it, and the others get one.
  - With no class chosen, nothing is pinned, and the screen says to choose one.
- **Example packs.** An example pack says so instead of a source: «حزمة مصطنعة لتجربة التطبيق، وليست مخططاً». Its badge reads «مثال للتجربة».
- **Reference data.** The bundled packs are read through the core. A refused pack is left out on its own, and the rest of the data is kept.
- **Not here yet:**
  - where a class starts in its plan, which comes with the September check (#31);
  - district variants;
  - who signed a release, which comes before the pilot.

## Checks

| Check | Result |
|---|---|
| Android tests | 585 pass, 11 of them new: the plan with no pack yet, a grade with none, the calendar and finishing; pinning the example pack while keeping a course already made; free entry for one class and nothing pinned with no class; every control named and 48dp in the three languages and both directions; and the bundled packs read, with a refused one left out. The welcome test now walks through step 5 |
| Core tests | 209 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, step 5 read «الخطوة 5 من 5». Arabic for 4AM had «لم تُثبَّت حزمة بعد.», and 4AM3 and 4AM1 read «دون حزمة». Arabic for 1AM, which only the demo class takes, said no pack exists yet. «اختيار حزمة» opened the chooser with the example pack selected. «تثبيت الحزمة» brought back the plan with «مثال للتجربة», «التوقيت: حصص لكل عنصر · الإصدار 2026.1», and both classes on 2026.1. «إنهاء الإعداد» led to the tabs, and the pin was still there after the app was restarted.

## Still to do by a person

TalkBack in Arabic on these screens, with the other setup screens (see the BrowserStack note on #20).
