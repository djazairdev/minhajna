# Double shift and two schools (#28)

Checks of 17 October 2026 for the fourth pull request of [#28](https://github.com/djazairdev/minhajna/issues/28), on `feat/28-shift`, after Week-slot (#148). Made-up schools and classes only.

## What changed

- **Double shift** (R-3.2-21). Week-draw has a third option under Saturday and the fifth morning slot: «دوامان: صباحاً أسبوعاً، ومساءً الأسبوع الذي يليه». Turned on, it asks which half-day is taught in A weeks. A class drawn in one half-day then goes in the same slot of the other half-day for the other week, such as «4AM1 (أ)» in the morning and «4AM1 (ب)» in the afternoon. A second tap, or the eraser, clears both. The teacher's own time is drawn as before. The choice is kept on the version, as `doubleShift` in the core's week options.
- **A week of two schools** (R-3.2-18, R-7.4-02). When the classes belong to two schools or more:
  - each pen and each cell carries the school's short name, the last word of its name, such as «4AM3 · Nadjah»;
  - TalkBack reads the full name, such as «4AM3، CEM El Nadjah»;
  - the totals under the grid and on Setup-5-Week count each school's sessions, then the total.
- **Clashes.**
  - A clashing cell gets a dashed outline in the warning colour, so the clash is seen without relying on colour, and TalkBack says «تعارض» first.
  - Setup-5-Week lists the clashes in a warning, such as «تعارض في خانة الأحد، الحصة 1 صباحاً: 4AM3، CEM El Nadjah، نصف يوم بيداغوجي».
  - Under the warning, «فتح الخانة لحلّ التعارض» opens the drawing with the first clashing slot already on Week-slot.
- **Bidi.** School names are isolated in the cells, and class and school names in the clash lines that are shown, so a Latin name keeps an Arabic line right to left. What TalkBack reads stays plain.

The primary double shift, two classes sharing one room (Week-draw-primary), comes with the primary timetable.

## Checks

| Check | Result |
|---|---|
| Android tests | 561 pass, 9 of them new: the double shift in the paint rule (both half-days, clearing in pairs, own time unchanged, no mirror outside the grid), school short names, the marks of a week of two schools, the clash outline in WeekGrid, the double shift and two schools in Week-draw, the counts by school and the clash warning on Setup-5-Week, and Week-draw opening on a slot |
| Core tests | 195 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, with the double shift on and the morning taught in A weeks, a tap on Monday's third morning slot with 4AM1 filled it with «4AM1 Amel (أ)» and Monday's third afternoon slot with «4AM1 Amel (ب)». TalkBack's labels read «الإثنين، الحصة 3 صباحاً: 4AM1، CEM El Amel، الأسبوع أ». The totals read «Nadjah: 6 حصص · Amel: حصة واحدة · المجموع: 7 حصص». Sunday's first slot, holding 4AM3 and a pedagogical half-day, had a dashed outline, and the line under the grid read «تعارض واحد في الأسبوع». All of it was still there after the app was restarted. On Setup-5-Week, the clash warning read right to left, and its button opened the drawing on «خانة الأحد، الحصة 1 صباحاً».

## Still to do by a person

TalkBack in Arabic on these screens, with the other setup screens (see the BrowserStack note on #20).
