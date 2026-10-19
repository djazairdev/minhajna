# Tests and the exam windows (#221)

Checks of 19 October 2026 for [#221](https://github.com/djazairdev/minhajna/issues/221), on `feat/221-test-schedule`. Made-up classes and records only.

## Part 1: the core

- **The teacher's test schedule** (R-4.7-09, R-4.7-34, answer 268):
  - Each test has its day and its slot, chosen from the class's sessions, its group, the teacher's own title, and a «مشترك» mark when it is shared with other classes. Tests come from the teacher, never from the pack.
  - A test takes its session. The session becomes a test session and proposes no lesson, so the lessons flow around it, skipping holidays as they always do. The session still waits to be confirmed, like any session.
  - A test on a session the calendar takes, such as an exam day, changes nothing.
  - Once a session is recorded, it is what was recorded: a test only if it was recorded as one.
  - A test can be moved or removed. Removing it gives the session back to the plan.
- **Never past an exam window silently** (R-4.7-32, `pastWindow`):
  - From the records so far and the sessions ahead, the plan's own projection gives the day each item would be taught.
  - An item is past the window when the pack places it in the window's term or before, it is not a buffer, it is not finished, and it would be taught on the window's first day or later, or not at all this year.
  - The warning lists those items in the plan's order, each with the first day it would be taught after the window, and the window's dates and how sure they are.
  - Once the window has begun, it warns no more. The next window's warning starts then.
  - Only lessons are checked, not TD, which the September check counts apart too. In a joint class, each course uses its own grade's window.
- **The teacher's decisions** (answer 268). Nothing is applied before the teacher chooses, and each decision can be taken back:
  - **Leave out** an item the pack marks optional: it counts as skipped from the start.
  - **Merge** two items side by side in one of the pack's merge groups: the session of the one the plan puts first proposes both, each to its last stage, and confirming it as proposed records both. An item takes part in one merge only.
  - **Postpone** the items past a window: they stay in the plan, after the exams, and that window's warning leaves them alone.
  - A make-up session, the fourth answer, is the one from #219.
  - A decision never changes a recorded session. A decision the course's pack does not allow is never applied.
- **Records:** tests and decisions are lesson records. They go with the teacher's other lesson records and their routes, and the sync check knows them.

| Check | Result |
|---|---|
| Core tests | 320 pass, 11 of them new:<br>• a test takes its session, the next session gets its lesson, and removing the test gives it back;<br>• a test on an exam day changes nothing;<br>• a recorded session stays as recorded;<br>• an optional item left out, then taken back, and an item that is not optional never left out;<br>• two merged items proposed and recorded in one session;<br>• a merge named in either order, and one the pack does not allow;<br>• a merge offered only of items side by side in a pack group, and not yet merged;<br>• the warning's items and days, and none once the window begins;<br>• a test before the window adds an item to the warning, and a merge takes one away;<br>• postponed items left alone;<br>• tests and decisions in the records that travel, in a set order. |
| Android tests | 1325 pass |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |

## Part 2a: «مواعيد الفروض»

- **Where it opens** (answer 269): a row on the class page and a button under the class plan's tests. Marks gets it when Marks is built.
- **The screen** (Test-schedule):
  - a chip for each of the teacher's courses, with the year in a joint class and the subject when a class has several;
  - the course's tests in date order, each with its day, its session, «ثابت», «مشترك» when ticked, and a remove button named with the test;
  - the next exams, from the calendar and never the pack, «تاريخ معلن» or «تاريخ تقديري», where the plan pauses.
- **Adding a test** (answers 268 and 269):
  - its name, which it needs;
  - its day on a month grid, from today to the year's end, where only days with an open session of the class can be chosen: not recorded, not taken by the calendar, not already a test's;
  - that day's sessions as chips, and «فرض مشترك مع أقسام أخرى».
  - **Before saving**, the screen shows:
    - the lesson sessions left in the test's own term, from today or the term's first day up to its exams or its end, before and after, and none for a test after its exams; the TD sessions for a TD slot; or that no lesson session is lost, for a slot such as remediation that proposes no lesson;
    - the item whose session the test takes, which moves on with its followers, or that nothing moves;
    - any item newly pushed past the exams, which then stays in the warning.
  - The button says «إضافة الفرض وتحريك العناصر» when an item moves.
- **Undo:** «تراجع» takes back an addition or a removal. A second tap on save or remove does nothing.
- **The class plan** lists the tests as fixed rows, with «مشترك» when ticked.
- **Core:** `nextExams` gives a course's next exam window. The term check and the warning now take it from the course's own grade, so each year of a joint class has its own. `withPlanChanges` previews a test or a decision before it is saved. For part 2b, `suggestedChoices` ticks the choices one at a time, each the one that brings back the most items, up to three, so a long list takes only a few projections.

| Check | Result |
|---|---|
| Core tests | 325 pass, 5 of them new:<br>• the answers' choices, the ones ticked first, the postponement, and a test previewed;<br>• each year of a joint class with its own grade's exams. |
| Android tests | 1336 pass, 11 of them new:<br>• a class with no test and its next exams;<br>• what a test takes and moves before saving, then the test in the schedule and the plan;<br>• the name it needs, and session days only;<br>• a session already taken not offered, and removal with undo;<br>• the sessions counted in a January test's own term, none for a test after the exams, and none lost on a remediation slot;<br>• every control named in Arabic, French and English, right to left and left to right. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |
| Android emulator, debug build | From the class page, «مواعيد الفروض» showed no test yet and the term 1 exams from 6 December, «تاريخ معلن». The form offered only the class's session days. Monday 26 October showed its three sessions and, with no pack, that nothing moves. The saved test showed with «ثابت» and «تراجع», and the class plan listed it on 26/10. |

