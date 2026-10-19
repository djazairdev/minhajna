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
