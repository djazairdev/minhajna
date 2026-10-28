# The week on a PC (#251, second pull request)

Checks of 28 October 2026 for the second pull request of [#251](https://github.com/djazairdev/minhajna/issues/251), from the pull request that adds this record. It follows [the PC's frame](web-rail.md). Made-up data only.

## What changed

- **The week (answers 526 and 527):** «الأسبوع» joins the rail after Today, on a PC only. The phone keeps Today and its day-by-day flow.
- **The grid, as in the design's `Web-week`:** the week's days across, in the reading direction, and its slots down.
  - Each row is timed by its first session, else named by its slot.
  - Each session shows in its cell with its class on its subject colour and its lesson, in Today's own words.
  - A recorded session is in ink, a proposed one in pencil with a dashed edge, and one the calendar takes is muted with the calendar's name for the day. Its state is never shown by colour alone: each cell says it to a screen reader, with the day, the time, the class and the lesson.
  - The sessions are one group of choices, each a radio button checked when chosen, so a screen reader says which is chosen.
  - Today's column says «اليوم» beside its date, not only in a darker ink.
- **Above it:** the week's dates, naming both months when a week spans two; how many sessions the calendar left and how many are confirmed; and the weeks before and after, which stop at the school year's edges.
- **The week's print:** on the current week only, as the print set holds what is new since its last print, not a given week's.
- **The side pane:** the chosen session's class, day and time, its lesson and its state.
  - A session still to confirm shows what the plan proposes, in pencil as on Today, and where a continued lesson goes on from. It reads as awaiting confirmation up to today, and as proposed after.
  - A recorded one says what it wrote, and that it can be corrected later with its first version kept.
  - The week opens on the first session still to confirm up to today, else on the next one held, else on the first; and it does so again when the session chosen is gone, after a change of timetable.
  - Confirming and correcting there come in the next pull request.
- **From the core:** `weekView` gives the week that holds a day, from the country's first day of the week: its working days, and any other day a session falls on, each as Today has it; the slots the timetable in force draws, and any other a session takes; and how many sessions the calendar left and how many are recorded. Its days come from `daysView`, which builds each as `todayView` does, but for the earlier sessions' count, with each course walked once for the whole week. `weekCell` gives a day's sessions in one slot.
- **Words:** every new text is in Arabic, French and English. Class names and lessons are isolated where they sit in a sentence, so «4م1» reads whole in English.

## Checks

| Check | Result |
|---|---|
| Core (`packages/core`) | Pass, among them **the week at once** (`test/week-view.test.ts`, new): the week that holds a midweek day, from its Sunday, with its five days as Today has them, but for the earlier sessions' count, in this week, a recorded one's and a holiday's, and the slots in order; each cell's sessions; a recorded session counted at once; and a day a holiday takes, kept with its sessions but not counted. |
| Other packages (`npm test` at the root) | Pass |
| Web tests (`apps/web`) | Pass |
| Jest (`apps/android`) | The 10 new tests pass (`web-week.test.tsx`):<br>• the week opens on its first session to confirm, shown in the pane with its proposal, under the week's title, count and days;<br>• another session chosen shows in the pane;<br>• a recorded session reads in ink, with what it wrote and that it can be corrected, and the week opens on the next one;<br>• the next week is proposed, a holiday week has nothing to count and the calendar takes its sessions, and the weeks before come back;<br>• the print opens the week's print set, from the current week only;<br>• the weeks stop at the school year's edges;<br>• a continued lesson says where it goes on from;<br>• a chosen session that is gone gives way to the first to confirm;<br>• the week is a tab on a PC, after Today, and not on the phone;<br>• every new text in French and English. |
| Type checks | Pass |
| ESLint, Prettier | Pass |
| Chrome, headless, from the local server, at 1280 × 800, a fresh profile each run | Pass, in Arabic and English. After a made-up backup was restored, «الأسبوع» in the rail opened the week of 25 to 29 October, marked current. The holiday took its Thursday's three sessions, each saying so, and the pane showed the first. Choosing another moved the selection and the pane. The week before showed the 18th to the 22nd, with the first session awaiting confirmation and its proposal in the pane; two weeks on showed 1 to 5 November. «4م1» read whole in the English pane. No error was in the console. |

## Left for the next pull requests

- **#251:** confirming and correcting in the pane (answer 526), with the same choices as Today, and «صفحة الدفتر» opening the texts book on the session's page.
- **Settings beside the rail:** as in [the frame's record](web-rail.md).
- **Not drawn in the week yet:** what Today adds beside its sessions.
  - Covers of another teacher's class and scheduled support sessions, which are not among the day's sessions.
  - A TD list in place of the proposal.
  - The notes on a slot shared with another school and on a session moved for the day.
  - Exam duties and councils, which Today shows as cards.
  - Joint classes' years and half-groups' pairs, which show as their sessions, without Today's grouping.
  - In a multi-school week, each row is timed by its first session, and each session's own time is in the pane.
- **Still to check by hand:** the week with a screen reader and at 200% text in Chrome, Edge and Firefox on Windows.
