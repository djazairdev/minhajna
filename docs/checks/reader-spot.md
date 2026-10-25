# Reader mode: the spot-check sheet

Checks of 25 October 2026 for [#246](https://github.com/djazairdev/minhajna/issues/246), part 3 (R-Spot, answers 489 and 491), after [#470](https://github.com/djazairdev/minhajna/pull/470) and [#471](https://github.com/djazairdev/minhajna/pull/471), from the pull request that adds this record. Made-up keys, classes and statements only.

## What changed

- **Opening:** «ورقة تحقق» on a statement opened in reader mode, when the school's picture keeps it. A misdated statement, which the picture leaves out, has no sheet.
- **The period:** from the first day of the app's school year to the statement's day. A statement of another school year than the app's calendar, or dated before its first day, has no period, and the sheet says which and draws nothing. So does a period with no school day.
- **The days:**
  - Three distinct school days are drawn at random, without bias, from the phone's random bytes each time the sheet opens. They are shown in order, with their weekday.
  - School days are the country's working days that the app's calendar keeps for the statement's level and grade. A reader knows no school, so only the national layer counts, with any Eid date the reader confirmed.
  - Fewer days are drawn when the period has fewer school days. The sheet has no way to redraw, and nothing is kept.
- **The screen:** the class, subject and teacher, the day of the visit, the statement with «والتوقيع سليم» and its sender line, the period, the last resource and the sessions not held. Then the days drawn, with why they are drawn, print and PDF, and that the sheet stays on this phone.
- **The page:** A4 portrait, black and white. It gives the day of the visit, «ورقة تحقق», the class, subject and teacher, the statement and its period. Then one row per day, with empty columns «في دفتر النصوص» and «في كراريس التلاميذ», and boxes for «ملاحظات المفتش» and «توقيع المفتش». It shows no times and no pupil data, so it carries no confidential mark. The PDF is saved as «ورقة تحقق <section> <subject> <day>.pdf».
- **The teacher:** print and PDF wait until the teacher's name or key fingerprint is known, so the page carries «…» for an unnamed teacher only when the fingerprint cannot be worked out.
- **Nothing recorded:** opening, printing or saving the sheet adds nothing to the history or the activity log.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `statement-spot.test.ts` (2): the period from the year's first day to the statement's day; its 34 school days, without the weekend or the autumn holidays; no period for a statement of another year. Three distinct days drawn in order, with a draw out of range drawn again, over 50 random runs; two days when the period has two |
| Android tests | `reader-spot.test.tsx` (6): the sheet offered on a kept statement, not on a misdated one. In Arabic, French and English, with no missing text and no accessibility problem: three distinct school days in order within the period, the print with its days and columns, the PDF's file name, and nothing recorded. A statement of another year, dated before the year's first day, or misdated, draws no days, and the sheet says which; an unknown one is gone. Print and PDF wait while an unnamed teacher's fingerprint is worked out. The made-up statements now come from `jest/reader-statements.ts`, shared with `reader-picture.test.tsx` |
| Emulator | Release build on Android 15 (API 35), in Arabic, in reader mode with one made-up statement kept: «ورقة تحقق» on the opened statement showed the class, subject and teacher, the day of the visit, the period «من 21/09/2026 إلى 25/10/2026» and three school days in order with their weekday. Opening it again drew other days. The PDF saved through the system dialog as «ورقة تحقق القسم التجريبي اللغة العربية 2026-10-25.pdf», and the print dialog offered ISO A4. The first build’s page ran onto a second sheet; its rows and boxes were made shorter, and the page now fits one A4 sheet with every column, the notes and the signature. No errors in the log |
| Type check, ESLint, Prettier | Pass |
| Languages | Every new text in Arabic, French and English, with the same placeholders and plural forms |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the sheet's heading, the statement and period, each day drawn, then print and PDF.
- **On paper:** the printed sheet on A4, with room to write in each day's columns and in the notes and signature boxes.
- **On a phone:** the sheet right to left and left to right, with text at 200%, on Android 8 at 360×800.
