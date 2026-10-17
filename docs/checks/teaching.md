# Levels, subjects and schools (#25)

Checks of 17 October 2026 for the first pull request of [#25](https://github.com/djazairdev/minhajna/issues/25), on `feat/25-teaching`. Made-up schools only.

## What changed

- **The core's `School`** now holds the teacher's `levels` and `subjects` there, so one school can have more than one level and a bivalent teacher two subjects (R-3.2-02, R-3.2-23). Its `zone` is optional until the wilaya is set: until then no zone entry of the calendar applies, and national entries still do. A level entry covers a school if it covers any of its levels, or the class's own level when a class is given.
- **Setup-2-Teaching** (`src/setup/`) follows the privacy notice, as step 1 of 5:
  - level chips, several allowed, with the design's short names;
  - subject chips for the chosen levels: the five the design draws first, then «مواد أخرى» for the rest of the profile's subjects;
  - the school's name.
- **Setup-2b-Schools:** «إضافة مؤسسة أخرى» adds a school with its own name, levels and subjects. One school is open at a time; the others fold to a card with their line, such as «متوسط · اللغة العربية», and «تعديل». A note says the weeks are merged with a warning at each clash; the merge itself comes in #28. «حذف هذه المؤسسة» erases every version of that school.
- **Nothing lost:** each chip is saved at once and the name once typing pauses or the field is left, as `school.set` in the history (#19). A school left empty is never saved. If a change cannot be saved, the screen says so.
- **«التالي»** is on once every school has a name, a level and a subject, and leads to the tabs until the next steps come with #26 and #27.
- **`ChipGroup`** takes an optional last «more» chip, a button rather than a choice.
- Two line icons from the design canvas, `school` and `info`.

The wilaya picker, and the wilaya list it needs in the country profile, come in the next pull request. No dependency, permission or network call changes.

## Checks

| Check | Result |
|---|---|
| Core tests | 174 pass, 4 of them new in `school-coverage.test.ts`. The demo year's byte counts grow by 23 and 25 bytes for the new fields |
| Android tests | 452 pass, 16 of them new: `teaching.test.tsx` (saving, subjects by level, the name's pause, two schools, deleting, reopening, a failed save, no fixed text height, and every control named and 48dp in Arabic, French and English, in both directions) and the «more» chip |
| Type check, ESLint, Prettier | Pass |
| Release build, offline | Builds |
| Android 15 emulator, release build | In Arabic, the step matches both screens. Choices and the name were still there after the app was stopped and opened again, and at 200% text the chips and the heading wrap with nothing cut |

## Still to do by a person

TalkBack in Arabic on this step, with the other setup screens (see the BrowserStack note on #20).
