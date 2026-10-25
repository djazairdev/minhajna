# Reader mode: the council's merge

Checks of 25 October 2026 for [#246](https://github.com/djazairdev/minhajna/issues/246), part 4 (R-Merge, answers 489 and 492), after [#470](https://github.com/djazairdev/minhajna/pull/470), [#471](https://github.com/djazairdev/minhajna/pull/471) and [#472](https://github.com/djazairdev/minhajna/pull/472), from the pull request that adds this record. Made-up keys, classes, packs and statements only.

## What changed

- **Opening:** «دمج البيانات لمجلس المادة» under a grade of «صورة المؤسسة». The merge has the grade's subjects as choices, in the profile's order.
- **Rows:** each class's latest statement for the subject, as the picture holds it, in the school's order and under its school when the picture groups rows. Nothing is ranked or coloured for a person, and a row opens its statement.
- **Placing:**
  - The last resource is placed on the pack the statement names, in its own release, or else in the newest release the app has under that ID, newer than the statement's, that keeps the resource's ID.
  - The unit comes with its place among the pack's units. The resource comes with its place among the unit's main items, TD left out, drawn as boxes: filled before it, half for a resource started, filled for one done. A placing on a newer release says so. A resource outside any unit gives no place in a unit.
  - A teacher's own list, a pack the app lacks, one it has only in releases older than the statement's, or a resource no release keeps is not placed. The statement's own title stands, and the row says which.
- **Each row also gives:** the teacher, the statement's day, the delay and the sessions not held.
- **The page:**
  - **Layout:** A4 landscape, black and white. It opens with «دمج البيانات · <subject> · <grade>», the statements and teachers counted, a blank for the meeting's day and the day it was made.
  - **Rows:** one table that flows onto as many pages as it needs, its column heads repeated on each page and no row split, with the place drawn as boxes.
  - **Close:** how rows are ordered, that only what teachers shared shows, and a box for the subject coordinator's signature.
  - **No mark:** it has no pupil data, so it carries no confidential mark.
  - **The PDF:** saved as «دمج البيانات <subject> <grade> <day>.pdf».
- **The teacher:** print and PDF wait until every unnamed teacher's key fingerprint is known.
- **Nothing recorded:** opening, printing or saving the merge adds nothing to the history or the activity log.
- **Not drawn:** the plan's position today, since a reader has no class timetable to work it out from (answer 489).

## Automated checks

| Check | Result |
|---|---|
| Core tests | `statement-merge.test.ts` (2): a resource placed on its unit in its own release, or in a newer one keeping its ID, also when its own release lacks it; outside a unit; each reason it is not placed (no release keeps it, a TD item, only older releases, a teacher's own list, a pack the app lacks), and no resource. The merge in the picture's order for one subject, with its keys counted |
| Android tests | `reader-merge.test.tsx` (7): the picture opens its grade's merge. In Arabic, French and English, with no missing text and no accessibility problem: the classes in order with their latest statement, each placed in its unit, a row opening its statement, the print on landscape pages with the place as boxes, the PDF's file name, and nothing recorded. Another subject, and each reason a resource is not placed; a grade with no statement. Print and PDF waiting for a fingerprint. One table with repeated heads, rows under their schools, and the started box filled from the start side |
| Emulator | Release build on Android 15 (API 35), in Arabic, in reader mode with one made-up statement kept, which has no resource yet. «دمج البيانات لمجلس المادة» under the grade opened the merge for «اللغة العربية · السنة الرابعة متوسط». It showed the count, the class with its teacher, day, «—» for the unit and «لم يُقدَّم أيّ مورد بعد», the delay and the sessions not held, then the order and sharing lines and print and PDF. The PDF saved through the system dialog as «دمج البيانات اللغة العربية السنة الرابعة متوسط 2026-10-25.pdf», on one A4 landscape page with the head, the table, the notes and the signature box. After the audit's fixes, the rebuilt release opened the merge again, and its print dialog offered ISO A4 with one page. Placing on units, the boxes and several rows are covered by the tests above. No errors in the log |
| Page length | Fourteen made-up rows with long Arabic titles, in two schools, printed by desktop Chrome with the app's fonts came out on three landscape pages. The rows on the first two, with the column heads repeated on the second, and the signature box alone on the third. No row was split, and the school rows were in place |
| Type check, ESLint, Prettier | Pass |
| Languages | Every new text in Arabic, French and English, with the same placeholders |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the subject choices, each row read as one with its place in words, then print and PDF.
- **On paper:** the printed merge on A4 landscape, pasted into a numbered minutes register.
- **On a phone:** the merge right to left and left to right, with text at 200%, on Android 8 at 360×800.
