# Classes and typed lists (#27)

Checks of 17 October 2026 for the first pull request of [#27](https://github.com/djazairdev/minhajna/issues/27), on `feat/27-classes`. Made-up schools and pupils only. The demo class comes in the next pull request ([demo-class.md](demo-class.md)).

## What changed

- **The core's `Pupil`** may leave out its registration number. A typed list adds it later from the official file, by which the pupil is then matched (PRD §3.2).
- **Setup-4-Classes** follows the card, as step 3 of 5.
  - «إضافة قسم» asks for the school, when there are several; the year, among that school's levels; and the class's name as the school writes it. The class is saved with its one whole-class group.
  - Each class shows its size and «القائمة جاهزة», or «القائمة لم تُضف بعد» with «كتابة القائمة».
  - A note says which columns are kept and that a class has no size limit (R-3.2-12).
  - Import (#42) and joint primary classes are not offered yet.
- **Setup-4c-Type** (R-3.2-11):
  - name, sex and an optional registration number, in digits only, refused if another pupil of the class has it;
  - each pupil saved when added, the list sorted alphabetically and counted in every plural form;
  - tapping a pupil loads them back to correct them, or to remove every version of them.
  
  A notice says to type made-up names only (choice F1 of the field check, #49). The sex choice uses chips until SegmentedControl (#136) exists, and the badges are drawn in place until Badge (#135) exists.

## Checks

| Check | Result |
|---|---|
| Core tests | 183 pass |
| Android tests | 503 pass, 28 of them new: the rules (grades by school, the whole-class group, Arabic order with hamza and shared family names, taken numbers, the fields kept), adding a class with one or two schools, ready and missing lists, typing, sorting, a taken number, correcting and removing, 60 and 61 pupils, no fixed text height, and every control named and 48dp in the three languages, both directions |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | A class was added in 4th year as «4AM3»; two pupils were typed, saved, counted as «تلميذان مكتوبان» and sorted, one with and one without a registration number; back on the classes, the class showed «تلميذان» and «القائمة جاهزة». The registration placeholder is digits only, because mixed with Arabic it read backwards in the left-to-right field |

## Still to do by a person

TalkBack in Arabic on these steps, with the other setup screens (see the BrowserStack note on #20).
