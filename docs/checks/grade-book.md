# The grade book (#240)

Checks of 23 October 2026 for [#240](https://github.com/djazairdev/minhajna/issues/240), on `feat/240-book-core`, `feat/240-book-screen`, `feat/240-book-print`, `feat/240-lycee-core`, `feat/240-lycee-screens` and `feat/240-observations-core`. Made-up classes and records only.

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

## Part 3: the printed grade book

- **Among the documents** (answers 461 and 462): «كشف النقاط» is a pupils' document, A4 portrait, framed «داخلي · سري» on every page. Its day picks the term holding it, or between terms the one just ended, and it prints one page for each class and subject with a grade book, by class name, then subject's name.
- **Each page:**
  - the schools and the school year, then «كشف النقاط والمعدلات»;
  - «القسم: 4م1 · المادة: اللغة العربية · الفصل الأول», the formula with the scale and the release;
  - «الرقم», «الاسم واللقب», a column for each month marked in primary, each part and «المعدل», in two decimals;
  - the class's figures, then the teacher's box and the director's «تأشيرة», each dated.
- **Blank:** «فارغة» prints the numbers and names with empty cells and no figures.
- **The drawn signature:** it goes in the teacher's box of a middle-school page only, never on a blank one. Primary and lycée pages keep a blank box, and the director's box is always blank.
- **From the screen:** «طباعة» and «حفظ PDF» on «كشف النقاط» make that class and subject's page, with «خانة التوقيع» for a middle-school page while the drawn signature is in use, saved as «كشف النقاط 4م1 · اللغة العربية الفصل الأول 2026-2027.pdf».
- **The log and file names:** each print and save goes into the activity log as «كشف النقاط · الفصل الأول». The Documents tab's file is «كشف النقاط الفصل الأول 2026-2027.pdf».
- **Password:** a password on the PDF comes later, with every pupils' document (answer 415).

| Check | Result |
|---|---|
| Android tests | A page for each class and subject in order, framed, with the scope, formula and release, heads, cells and figures; primary's month columns; the blank version; the drawn signature on middle-school pages only, not on a primary or lycée one, a blank one or with «فارغة»; names escaped; the term just ended between terms; one course's page for another term; the line, period and file names; nothing to print without a grade book; the screen's print and save with their log lines, and its «خانة التوقيع»; the log's words for a term. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, with 45 made-up pupils, on Friday 23 October, with no drawn signature set:<br>• The Documents tab showed «كشف النقاط» with «قسم واحد · الفصل الأول».<br>• Its output screen read «A4 عمودي», the day chooser on Friday 23 October, «كما سُجّلت» and «فارغة بعناوينها» with its line, «داخلي · سري» and the signature line for middle school.<br>• «طباعة» opened Android's print screen on ISO A4 with «Page 1 of 2»: 45 rows run onto a second page.<br>• On «كشف النقاط», «طباعة» and «حفظ PDF» sit under the figures with the signature line; «طباعة» opened the same two-page preview.<br>• The signature choice was checked in the tests only, since no signature was drawn on the emulator. |

## Part 4a: lycée's practical work and oral, the core (#417)

- **The formulas** (answer 463): lycée's (T + F + P + 2E)/5 with practical work and (T + F + O + 2E)/5 with an oral are alternatives to its (T + F + 2E)/4, which stays the level's formula.
- **The choice:** the administration's, which the teacher records for the class and subject and the whole year. The last one recorded counts while it is still among the subject's choices, and a reshaped class keeps the one of the class it continues. The choice travels with the pupil records, and two devices that chose differently conflict for that course only.
- **The marks:** P and O are marked like the exam, «غائب» included. The book shows them when the formula weighs them, and an absence leaves the average empty.

| Check | Result |
|---|---|
| Core tests | A subject's choices, its level's first; the formula followed, the last one recorded while still a choice, kept by a reshaped class; the book with P, «غ» leaving the average empty, and back to (T + F + 2E)/4; the choice in the pupil records only; the data file's alternatives, a repeated id refused, and a bad flag giving one problem; a conflict per course. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator | Not run: nothing on screen changes until the screens' pull request. |

## Part 4b: lycée's practical work and oral on the screens (#418)

- **The choice** (L-Marks, answer 463): on «كشف النقاط» of a subject with more than one formula, «صيغة المعدل، كما تحددها الإدارة للمادة» offers «دون أعمال تطبيقية ولا شفهي», «مع الأعمال التطبيقية» and «مع الشفهي», each with its formula. The note says it applies to the class and subject for the whole year, and that marks already entered are kept. Choosing the formula already followed records nothing, and an archived class shows the choice but takes none.
- **The hub:** the formula card names the formula followed, and «الأعمال التطبيقية» or «الشفهي» has its row when that formula weighs it, with the exam's day and how many are done, or «لا موعد للاختبار في رزنامة هذا الفصل».
- **Entry:** like the exam's, on the exam's list, with «غائب عن الأعمال التطبيقية» or «غائب عن الشفهي».
- **The book, its print and the justification:** «التطبيقي» or «الشفهي» before the exam, as in the formula, «غ» leaving the average empty, and the value sheet's formula with the pupil's values.

| Check | Result |
|---|---|
| Android tests | The choice and what it records; the hub's formula card and rows, opening the entry; the entry's title and «غائب» recorded on the part; the book's row read as one line, the value sheet's formula and the printed columns; the justification's line with practical work and with the oral; the row disabled with no exam window; a middle-school class with no choice; an archived class; every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, release build signed with the debug key | On the demo class, 4AM Arabic, the only class on the emulator, on Friday 23 October:<br>• The hub's formula card still read CEM's formula, and the rows were the same as before, ending «Fard1», «الاختبار» and «مواعيد الفروض», with no practical work or oral row.<br>• The book showed no formula choice, and its head read «الاسم واللقب · التقويم · الفرض · الاختبار · المعدل».<br>• The first pupil's value sheet showed each part as before.<br>• The emulator has no lycée class, so the lycée screens were checked in the tests only. |

## Part 5a: descriptive observations, the core

- **The terms observed** (R-3.5-06, answer 464): `data/dz/assessment.json` names the grades, terms and subjects whose marks circular 270 replaces, as the press reported it: 1AP term 1 for every subject, 3AP French and English term 1, and 4AP Tamazight term 1, each with its source. A joint class's course is read by its own grade.
- **The observation:** «مكتسب», «في طور الاكتساب» or «غير مكتسب», one for each pupil, subject and term, chosen by hand. The last one recorded counts and it can be cleared. It travels with the pupil records, and two devices that chose differently conflict for that pupil only.
- **The counts:** how many pupils on a list have each observation, and how many have none yet.

| Check | Result |
|---|---|
| Core tests | The file's three cases and which grade, subject and term are observed; an unknown grade, a term below 1, a subject unknown at the level, a missing source and a subject named twice in a grade's term, each refused; a class and subject's term by its grade; the last observation kept, a cleared one left out; the counts on a list; the observations in the pupil records only; a conflict per pupil. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator | Not run: nothing on screen changes until the screen's pull request. |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** the hub's row, the order control, each row read as one line, and the value sheet.
- **Text at 200% on a phone:** the parts under each name, and the value sheet.
- **On a phone in French and English:** the book, the value sheet, and the printed book.
- **On paper:** the printed grade book on a real printer, A4, with a 45-pupil class on one page or running onto a second.
- **Lycée on a phone:** a lycée class's formula choice, the practical work's and the oral's rows and entry, and the book with «التطبيقي» or «الشفهي», with TalkBack in Arabic.
- **With a teacher:** checking a real class's averages against their own grade book, and saying whether the full value and the line for a pupil shown at 10.00 are clear.
