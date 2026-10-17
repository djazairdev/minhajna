# Taking the roll from a session (#38)

Checks of 17 October 2026 for the first roll-call pull request of [#38](https://github.com/djazairdev/minhajna/issues/38), on `feat/38-roll`. Made-up schools, classes and pupils only.

## What changed

- **«المناداة» on Today's session cards**, before and after the lesson is confirmed. The strip reads «لا غياب مسجّل» until the roll call is taken, then «المناداة محفوظة · غياب: 1 · تأخر: 1» or «المناداة محفوظة: حضر الجميع». A session recorded as not held has no strip (R-2.5-03, R-3.4-15).
- **The Roll screen** (`Roll`), on the class list, built from #175's `RollCallRow` and `Stats`:
  - The head line: the class, the day and the time. For a half-day in primary, the time runs from the first session to the last.
  - The figures follow each tap: «حضور», «غياب» and «تأخر، لا يُحسب غياباً».
  - The note «الحضور هو الأصل، ويُعلَّم الغياب والتأخر فقط…».
  - The pupils in the class list's order, in a `FlatList` that is the screen's only scroller.
  - Under the list, the note that nothing is sent to the sector's system.
  - «حفظ المناداة» records the exceptions in one step through the core's `takeRollCall` (R-3.4-09, R-3.4-12, R-3.1-03).
- **Absent and late exclude each other.** A pupil who came late is present (R-3.4-11).
- **The unit by level:** the session in CEM and lycée, the half-day in primary. The core's `rollCallUnits` sets the unit, and the screen opens the one that covers the session (R-3.4-06).
- **Marks are kept when the screen is left before saving.** They are kept in memory until saved or until the app closes.
- **A past session** (`Roll-past`), for a day before today, shows:
  - «من ورقة المناداة الورقية», saying that absences are recorded on the session's date and that the record keeps the day they were entered, without the time;
  - the hint «يُنقل من الورقة الغياب والتأخر وحدهما»;
  - «حفظ مناداة 15 أكتوبر» (R-3.4-17).
- **A roll call already taken** opens with its marks and «سُجّلت هذه المناداة في …». Its button, «حفظ التصحيح», stays disabled until something changes and one of four reasons is chosen: «الوصول بعد المناداة», «خطأ في التسجيل», «تصحيح من الإدارة» or «سبب آخر». The reason is recorded as its code, never as typed words about a pupil. Both versions stay in the history (PRD §5.5, §5.6).
- **Nothing is sent and nothing notifies parents** (R-3.4-02, R-3.4-03).
- **Not here:**
  - the backlog's «إدخال مناداة من الورقة», which opens a past session's roll call (the next pull request);
  - the seating plan (`Roll-seats`);
  - the blank sheet to print (after #44);
  - a single pupil's correction and the counting rules (`Correct`, `Roll-rules`, #39).

## Checks

| Check | Result |
|---|---|
| Android tests | 733 pass. The new ones, in `__tests__/roll.test.tsx`, cover: everyone present at first and the figures after each tap; absent and late excluding each other; one save recording only the exceptions on the session's unit; the marks kept when the screen is left; a past session entered on its own date; a correction that needs a change and a reason, keeping both versions; a session with no roll call; the strip on Today before and after the roll call, and none for a session not held; and every text in French and English. `accessibilityProblems` is empty |
| Core tests | 236 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, the strip «لا غياب مسجّل · المناداة» showed on the confirmed 08:00 session of the made-up 4AM class. The Roll screen showed «45 حضور، 0 غياب، 0 تأخر، لا يُحسب غياباً».

- Marking pupil 2 absent and pupil 3 late gave 44, 1 and 1, with the absent toggle in board and the late toggle in hi with its tick.
- Going back and reopening kept both marks, and the list scrolled to pupil 45.
- «حفظ المناداة» went back to Today, where the strip read «المناداة محفوظة · غياب: 1 · تأخر: 1».
- Reopening showed «سُجّلت هذه المناداة في 18/10/2026…» with the four reasons, and «حفظ التصحيح» was disabled.
- Marking pupil 2 late and choosing «الوصول بعد المناداة» enabled it. Saving changed the strip to «غياب: 0 · تأخر: 2».

The check at 200% text was cut short: the emulator, on a loaded host, stopped responding during setup.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
- Timing against paper with the demo class, and 45 pupils on a budget phone (§3.1, §6.8).
