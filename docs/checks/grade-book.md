# The grade book (#240)

Checks of 23 October 2026 for [#240](https://github.com/djazairdev/minhajna/issues/240), on `feat/240-book-core` and `feat/240-book-screen`. Made-up classes and records only.

## Part 1: the averages (#414)

- **The rows** (answer 457): the pupils sitting the exam, the class's or, in a joint class, the level's, enrolled on the exam window's first day, or on the term's last day without a window.
- **The parts:**
  - T is the sum of the component marks once every one has a mark. In primary, it is the mean of the pupil's totals over the months the teacher marked one of the setup's components in, and none while one of them is short.
  - F is the mean of the tests the pupil sat, and E is the exam, or «غ».
  - The average follows the level's formula once every part it weighs has a value.
- **Precision:** every value is kept in full and shows two decimals, rounded half up. The full value is truncated to four decimals.
- **Comparisons:** the threshold, 10 on 20 or 5 on 10, and the ranks compare the full value. Equal averages share a rank, and the next rank skips.
- **The class's figures:** the mean, highest and lowest of the averages there are, and how many reach the threshold out of how many have an average.

| Check | Result |
|---|---|
| Core tests | CEM's book with a tie, an exam missed, a component empty and 9.995 shown as 10.00 below the threshold; primary's months, a month marked only for a removed component left out; a subject with an exam only, and one with no formula; the list's day; a joint class; how values show. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |

## Part 2: «كشف النقاط»

- **Where it opens** (answer 458): a row «كشف النقاط» on the Marks hub, with how many pupils have an average, opens the course's book for the hub's term.
- **The screen** (Marks-book, P-Marks, answers 458 and 459):
  - the line «كشف النقاط · 4م1 · اللغة العربية · الفصل الأول», the formula and the scale;
  - «حسب القائمة» or «حسب المعدل»; by the average, highest first, those with none after in list order, each row keeping its number on the list;
  - a row for each pupil with T, F, E and the average, «غ» for an exam missed and «—» for a part not in yet. Primary's months show under the name, and with text at 150% or more every part does;
  - the class's figures, the note that thresholds and ranks compare the full value, and a line for each pupil shown at the threshold whose full value is below it.
- **The value sheet** (Marks-book-value): the average as shown and in full, each part both ways, the formula with the pupil's values in full, whether the average reaches the threshold with the rank, and «تبرير نقطة التقويم», which opens the pupil's justification on that pupil.

| Check | Result |
|---|---|
| Android tests | The hub's row and its count; the book's line, formula, rows read as one line each, figures and the 10.00 shown for 9.995; large text; the order by average; the value sheet with the formula in full, verdict and rank, focus back on its row, then the justification on that pupil, added after the list when not on it (answer 460); an exam missed; primary's months under the name; the routes from the hub to the justification; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, with 45 made-up pupils, on Friday 23 October:<br>• The hub showed «كشف النقاط» after «نقاط التقويم المستمر».<br>• The book read «كشف النقاط · القسم التجريبي · اللغة العربية · الفصل الأول», CEM's formula and «النقاط على 20», then the head and 45 rows.<br>• The first pupil's row read «الفرض 14.00 · الاختبار 16.75» from the part 2 check of #239, with «—» for T and the average, since one component has a mark.<br>• The name column is about 135 dp wide with 48 dp cells, and a long name wraps to two lines.<br>• The value sheet showed «رقم 1 في القائمة · المعدل الفصلي», each part in the book and in full, and «لا معدل حتى تكتمل أجزاؤه.».<br>• «تبرير نقطة التقويم» opened the justification on that pupil, «1 من 45».<br>• «حسب المعدل» kept the rows in list order, none having an average.<br>• The figures read «لا معدل في القسم بعد.» with the full-value note.<br>• Text at 200% was checked in the tests only, not on the emulator. |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the hub's row, the order control, each row read as one line, and the value sheet.
- **Text at 200% on a phone:** the parts under each name, and the value sheet.
- **On a phone in French and English:** the book and the value sheet.
- **With a teacher:** checking a real class's averages against their own grade book, and saying whether the full value and the line for a pupil shown at 10.00 are clear.
