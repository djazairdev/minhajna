# Make-up, support and revision days

How adding a make-up, support or revision day was checked for [#219](https://github.com/djazairdev/minhajna/issues/219) (PRD [§4.5](../prd/PRD.md#45-the-calendar), [§7.7](../prd/PRD.md#77-cover-and-make-up-sessions)). Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What it does](#what-it-does)
- [The result](#the-result)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## What it does

«إضافة حصص» adds a day the school sets, with sessions on the timetable of a chosen weekday (R-4.5-08). It opens from the screen for a session outside the timetable, by «إضافة يوم تعويض أو دعم أو مراجعة», until the calendar has its own screen ([#222](https://github.com/djazairdev/minhajna/issues/222)).

- **The kind.**
  - A make-up day's sessions are plan sessions: the resources move on as in any session, and they go on the subject's pages of the texts book, with their date.
  - Support and revision sessions do not move the plan. They go on the texts book's page for additional lessons (R-3.3-18).
- **The school,** when the teacher teaches at more than one.
- **The day.** It is any day of the school year, on a month's grid, even a Saturday or a holiday. The first day offered is the next day off.
- **The closure it makes up for,** for a make-up day, when the school has one before the day. Choosing it sets the weekday to the closure's first working day. The closure's sessions stay lost to the calendar, as recorded, and the make-up sessions are new ones.
- **The weekday** whose timetable the day follows.
- **The sessions,** that weekday's at the school. The A or B week that holds the day is chosen first, and the teacher can change the choice, so an A or B slot is never guessed. Two sessions never share a slot, and none goes in a slot the teacher already teaches that day.
- **The source and the certainty,** announced or expected, as for any calendar entry.
- **What changes** shows before saving:
  - the sessions;
  - where they go;
  - the closure;
  - for a make-up day, each class's spare sessions before the exams, before and after.
- **Saving** adds the day to the calendar. A second tap waits until the screen shows the first save. «تراجع» takes it back, and the history keeps both.
- **On Today,** the day's mark names it, such as «يوم تعويض», with the weekday it follows, in place of a holiday's mark, unless the day is closed. Its make-up sessions are confirmed like any other.

In the core, the day is a calendar entry of the school's layer, kept with the teacher's own entries.
- **Its fields:** the effect `adds-sessions`, what it adds (`make-up`, `support` or `revision`), the weekday it `follows`, the sessions it `takes`, and the closure it `replaces`. The sessions are kept by course, slot, group and A or B week, so redrawing the week keeps them.
- **Plan sessions:** `sessionsBetween` dates its make-up sessions with the others, so pacing, Today, the roll call and the term check see them at once. On a holiday inside a teaching week, a make-up session takes the place of the session the holiday took in the same slot.
- **Support and revision sessions:** `addedSessions` lists them, and `supportDayRows` turns them into rows for the page for additional lessons, timed by the bells. The page prints with the texts book ([#213](https://github.com/djazairdev/minhajna/issues/213)).
  - They count in the number a session outside the timetable takes on that page.
  - A joint class gets a row for each level, as a session outside the timetable does.
  - A session with no time at the school yet waits for one, and what changes says so.
  - On Today they show only as the day's mark; offering them for a roll call is left to [#224](https://github.com/djazairdev/minhajna/issues/224).
- **Taking it back:** `calendar.removed` takes back an entry the teacher added.
- **Calendar files:** a file can name such a day, but never the sessions it takes.

## The result

| Check | Result |
|---|---|
| «إضافة يوم تعويض أو دعم أو مراجعة» opens «إضافة حصص», titled with its subtitle | **Passed** |
| The kind runs right to left: «تعويض», «دعم», «مراجعة في العطلة» | **Passed** |
| The first day offered is the next day off, Friday 23 October | **Passed** |
| On Thursday's timetable, both of Thursday's sessions are chosen first | **Passed** |
| What changes reads «الجمعة 23 أكتوبر، على توقيت الخميس: حصتان، 4AM1 · 08:00، 4AM2 · 09:00.» in order | **Passed** after a fix |
| Saving shows «أُضيف اليوم إلى الرزنامة.», and the same sessions are no longer chosen first | **Passed** |
| Choosing one again shows that two sessions would share a slot, and nothing is saved | **Passed** |
| «تراجع» takes the day back | **Passed** |

Two faults were found and fixed while checking:
- In what changes, the Latin class names reordered the Arabic sentence. Each session is now isolated, and stays on one line.
- The certainty had no visible label; «اليقين» now shows above it, as in the design.

The review before committing found more, all fixed:
- Redrawing the week dropped a day's sessions, as they were kept by the timetable's IDs.
- A make-up session on a holiday inside a teaching week gave way to the session the holiday took.
- The number of a session outside the timetable left out support-day rows.
- Today showed a closure's mark on a holiday inside the closure.
- A day from a calendar file in a holiday week dropped the A and B sessions.
- A closure starting on a day off set a weekday off; it now takes the closure's first working day.
- A joint class's slot showed once for each level in what changes.
- A quick second tap could add a support day twice.

The emulator's teacher had no week drawn. For this check only, a made-up Monday and Thursday were recorded from a copy of the screen that was never committed.

## Repeating the checks

1. Build and install the debug app: `./gradlew :app:installDebug` in `apps/android/android`.
2. Set up classes and draw the week, then open Today, press the plus beside Help, and press «إضافة يوم تعويض أو دعم أو مراجعة» at the foot.
3. Choose a weekday with sessions, read what changes, add the day, then choose one of its sessions again and press «تراجع».

The core tests in `packages/core/test/added-days.test.ts` and `added-days-read.test.ts`, and the app tests in `apps/android/__tests__/add-sessions.test.tsx` cover:
- a make-up day on a Saturday, with the plan's spare sessions before the exams and the closure's sessions still lost;
- a make-up day on a holiday inside a teaching week;
- a redrawn week, and a day from a file in a holiday week;
- the A and B week's sessions, chosen by the teacher;
- the refusals: outside the year, a day off, sessions off the weekday, a bad closure, a shared slot, no source;
- support and revision days, off the plan, on the page's rows and in the number of a session outside the timetable;
- taking a day back, with the history kept;
- calendar files;
- Today's mark;
- the screen.

## Still open

- **TalkBack in Arabic and text at 200%,** on a real phone.
- **The calendar's own screen,** where an entry is changed or removed later, with #222.
- ~~The page for additional lessons with these sessions, and the subject's pages with the make-up sessions, with #213.~~ Both print since #213's first two pull requests ([texts-book.md](texts-book.md)).
