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

## Part 2b: the warning and its answers

- **The warning** (R-4.7-32, answers 268 and 269):
  - one card for each class whose plan would push items past its next exams, on Today below the day's mark;
  - the same card, for its own class, at the top of the class plan;
  - each card names the items, the exams' first day and the class.
  - It stays until the teacher decides, and goes once nothing falls after the exams or the exams begin.
  - Each class's warning is kept until something it reads changes, such as its own sessions, tests or decisions, the timetable or the day. A tap confirming another class's session does not work it out again.
- **«ما العمل؟»** opens the answers (Exam-window):
  - the items, each with the day it would fall on, or «لا يُبلغ هذه السنة»;
  - the exams' dates and how sure they are.
  - Nothing applies before a choice.
- **The three answers of 0.2.0:**
  - **«دمج موارد أو ترك الاختيارية»**, shown only when the pack allows a leave-out or a merge:
    - each choice is a tick, and a choice that shares an item with one ticked cannot be ticked with it;
    - a suggestion comes ticked: one choice at a time, each the one that brings back the most items, up to three. It may miss a pair that helps only together, so the teacher can change the ticks.
    - What the ticks leave after the exams, or that everything comes back, shows before «تأكيد».
  - **«إضافة حصة استدراكية»** opens «إضافة حصص», on a make-up day.
  - **«تأجيله بعد الاختبارات»** keeps the items for the first sessions after the exams. The warning leaves them alone, and the class plan tags them «بعد الاختبارات» until they are taught.
  - «إعادة توزيع بقية الفصل» comes with the Repace screen in its own issue.
- **«لاحقاً»** keeps the warning on Today and the plan.
- **«تراجع»** takes a choice back, and a second tap before the first shows does nothing.
- **«قراراتك في …»** lists every decision made for the class, each with a button that takes it back, so none stays for good once «تراجع» has gone.
- **A merged session:** Today's card shows the merged item under the first, «يُدمج معه», and a later session reads «X، مع Y», or «تابع: X، مع Y» when it goes on from an earlier session. Confirming it as proposed records both items.
- **Plan tags:** «بعد الاختبارات» shows on a postponed item until it is taught or left out.

| Check | Result |
|---|---|
| Android tests | 1350 pass, 14 of them new:<br>• Today's card for a class with items past the exams, and none for a class without a pack, opening its answers;<br>• the items with their days, and nothing applied before a choice;<br>• a merge ticked as a suggestion, what it leaves, recorded, then taken back;<br>• postponing, a second tap doing nothing, the warning gone and the items tagged in the plan;<br>• the class plan's own card, the make-up day and «لاحقاً»;<br>• a merged session's proposal and lesson;<br>• a decision listed, taken back after its «تراجع» has gone, then restored;<br>• a class's warning kept while only another class's records change, and worked out again when its own change;<br>• every control named in Arabic, French and English, right to left and left to right. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |

## Part 3: the exam-week entries

- **The form «حراسة أو اختبار»** (Today-exams, answers 268 and 270): the teacher types an invigilation or a class exam from the school's paper.
  - The kind, «حراسة» or «اختبار قسمي».
  - The day, on a month's grid where only days an exam window of the teacher's classes covers can be chosen. It opens on the asked day, else the next exam day, else the last one.
  - The times as on paper, the end after the start.
  - The room, when typed.
  - For a class exam, the classes sitting it, at least one, among those whose own exams cover the day.
  - When the calendar has no exam days for the teacher's classes yet, the form says so and offers nothing.
- **The day's entries** follow the form, each with a button that removes it. A save or a removal can be taken back with «تراجع», and a second tap before the first shows does nothing.
- **Nothing is counted:** an entry moves no item of a plan and adds no session.
- **Where it opens:**
  - from «إضافة حراسة أو اختبار» on Today, on an exam day, below that day's entries;
  - from the same button under the exams row of «مواعيد الفروض», on the exams' first day.
- **The journal:** in «كل الأقسام», an invigilation has its own row on its day, among the sessions by its start, with its times and room. A journal for one class leaves it out. The texts book never shows an entry.
- **The core:** `duty.set` and `duty.removed` on the lesson-record layer. `setDuty` refuses a day outside an exam window, a time not like 08:00 or ending before it starts, a room over 40 characters, and a class exam without known classes or naming a class with no exams that day. Entries are pushed in day and time order.

| Check | Result |
|---|---|
| Core tests | 3 new: the exam windows and days of the teacher's classes; what `setDuty` refuses, a class with no exams that day among it; the day's entries in order, a removal and the pushed order |
| Android tests | 1364 pass, 14 of them new:<br>• the form on the next exam day, only exam days offered, an invigilation saved with its room;<br>• the form on the last exam day once they have all passed;<br>• a time ending before it starts, and a class exam without classes, not saved, then saved with two classes;<br>• an entry removed and restored with «تراجع»;<br>• Today's entries and button only on an exam day;<br>• the test schedule opening the form on the exams' first day;<br>• the invigilation row in the journal for all classes, not in one per class, and among the sessions by its start;<br>• every control named in Arabic, French and English, right to left and left to right. |
| Android emulator, debug build | From «مواعيد الفروض», «إضافة حراسة أو اختبار» opened on Sunday 6 December with only the exam days open. An invigilation on Monday 7 December, 10:00 to 12:00, room 5, saved and showed its card; «حذف» and then «تراجع» restored it. A class exam on Tuesday 8 December was refused without a class, then saved with the class. |
| Type check, ESLint, Prettier, root lint, typecheck and tests | Pass |

## Still to do by a person

- The warning and its answers on a phone, with a class on a pack whose plan runs past its exams. The emulator's class has no pack.
- A teacher adding a real test schedule from the school's paper, and reading the warning (#44).
- A teacher typing an invigilation and a class exam from the school's paper during an exam week, and finding the invigilation in the printed journal.
- Today's entries and «إضافة حراسة أو اختبار» on a phone during an exam week. The emulator's date is outside one.
- TalkBack in Arabic on «مواعيد الفروض», the answers and «حراسة أو اختبار» (see #206).

