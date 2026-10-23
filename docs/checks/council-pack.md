# The class-council pack (#244)

Checks of 23 October 2026 for [#244](https://github.com/djazairdev/minhajna/issues/244), on `feat/244-council-core` and `feat/244-council-screen`. Made-up classes and records only.

Before each class council, teachers work out averages, extremes, success rates and lists by hand. The pack gives them for each class, subject and term (answer 470). Three pull requests: this core, then «ملف مجلس القسم», then its printed document.

## Part 1: the figures and the thresholds (core)

- **Every figure** is taken over the pupils with an average, on the full value (R-3.5-17):
  - the class average, the highest and lowest averages, and the standard deviation of the population, divided by the number of averages, since a class is the whole group;
  - how many reach 10, or 5 in primary (R-3.7-11, R-3.7-12).
- **The bands** are fixed on 20: below 5, 5 to 8, 8 to 10, 10 to 12, 12 to 14, 14 to 16, and 16 or more. Each lower bound is reached on the full value, and the bands are halved on 10 (R-3.7-13).
- **Boys and girls**, from the pupil record: how many have an average, how many reach the threshold, and their mean (R-3.7-13).
- **The ranks** are the grade book's, with equal values sharing a rank, listed highest first, then in list order (R-3.7-14).
- **From term 2**, the previous term's class average and how many reached the threshold, and each pupil's previous rank (R-3.7-15).
- **Remediation and distinction** (R-3.7-16):
  - Pupils below the first threshold may need remediation, and pupils at or above the second are in line for a distinction.
  - The teacher sets both thresholds, since no text does: 8 and 15 on 20 by default, halved on 10.
  - They are one setting for every class, kept as `council-thresholds.set` on 20. It is refused outside 0 to 20, with more than two decimals, or out of order.
  - The setting is private, and it leaves only on the teacher's own routes.
- **The attendance summary** is the class's roll-call book over the term's dates up to today, under the teacher's counting rules: half-days missed, lateness, and the attendance rate (R-3.7-17). With no roll call taken, there is none, even when the teacher counts the units without one as present.

| Check | Result |
|---|---|
| Core tests (`council-pack.test.ts`, 6 tests) | Pass. They cover:<br>• the figures, with a 9.75 left below 10;<br>• the standard deviation;<br>• the bands, and boys and girls apart;<br>• the ranks;<br>• the default thresholds, then the teacher's, refused out of range, out of order or with three decimals, private and on the teacher's own routes only;<br>• a 10 scale, with the bands and thresholds halved;<br>• term 2 beside term 1, with each previous rank, and term 3 with no average yet;<br>• the roll-call book's absences, lateness and rate, with nothing counted before the term;<br>• no summary with no roll call taken, even when units without one count as present. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator | Not run: this part adds no screen. Part 2 checks the pack on the emulator. |

## Part 2: «ملف مجلس القسم»

- **The hub's row** follows «التصدير الفصلي» for a term with a grade book and a formula, with the class average and how many reach the threshold, or «لا معدل في القسم بعد».
- **The screen:**
  - **Heading:** the class, subject and term; chips for the year's terms, kept in the route; and the school and the school year marked «داخلي · سري».
  - **Six tiles,** each read as its figure, then its label: the class average, the highest and lowest averages, the standard deviation, how many reach the threshold with its share, and the term's attendance rate.
  - **The full-value note,** with any pupil shown at the threshold who doesn't reach it, as on the grade book.
  - **The bands** as bars, each read as its bounds and count. The count is always written, so colour is never the only sign.
  - **Boys and girls,** each row read as one line.
  - **From term 2, the comparison:** the class average, and how many reach the threshold with its share, in the previous term and this one, each with its trend: an arrow on screen, words for TalkBack. In term 1, or with no average in the previous term, it says there is nothing to compare.
  - **Every rank,** each read as one line. From term 2, each shows its previous rank and its change: an arrow on screen, words for TalkBack.
  - **The remediation and distinction lists,** each under a badge naming its threshold.
  - **«تغيير العتبتين»** opens the two thresholds on the book's scale. They are kept for every class, refused unless each is above 0 and within the scale with at most two decimals, and the first is below the second. They can be put back to the defaults, and a choice that changes nothing adds no record.
  - **The roll-call book's summary,** or that the class has no roll call this term.
- **A term with no average** says so.

| Check | Result |
|---|---|
| Android tests (`council-pack-screen.test.tsx`, 8 tests) | Pass. They cover:<br>• the hub's row;<br>• the tiles, with the attendance rate and the no-roll-call line;<br>• the note on a 9.995 shown at 10.00;<br>• the bands, boys and girls, ranks and lists;<br>• the thresholds refused out of order, kept at 10 and 12,5 for every class, put back, and recording nothing when unchanged;<br>• thresholds typed and read on a 10 scale;<br>• a term with no average;<br>• the comparison with its trends, and each rank's change, from term 2;<br>• every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator, release build signed with the debug key, on Friday 23 October | Pass.<br>• On the demo class's first term, «ملف مجلس القسم» first said «لا معدل في القسم بعد». After I entered every component for the first two pupils and the second pupil's exam, it gave «معدل القسم 13.79 · 10 فما فوق: 2 من 2».<br>• The screen showed 13.79, 16.67 and 10.92, a standard deviation of 2.88 and 100.0%, the same as the grade book. It also showed the bands, the two boys, both ranks, «لا مقارنة: هذا الفصل الأول.» and the class's lack of roll calls.<br>• Thresholds of 16 and 15 were refused. At 11 and 16, the second pupil (10.92) moved into remediation and the first (16.67) stayed in line for a distinction. «العودة إلى العتبتين الافتراضيتين» put back 8 and 15.<br>• This run came before the audit's three fixes: the comparison's arrows, the rule's wording, and no record for an unchanged choice. The tests cover those fixes. |

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206):
- the screen with TalkBack in Arabic;
- a phone in French and English, with text at 200%;
- a teacher's real class in term 2 at a real council.
