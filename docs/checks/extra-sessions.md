# Sessions outside the timetable

How logging a session outside the timetable was checked for [#219](https://github.com/djazairdev/minhajna/issues/219) (PRD [§3.3](../prd/PRD.md#33-today-and-the-session), [§3.8](../prd/PRD.md#38-the-documents)). Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What it does](#what-it-does)
- [The result](#the-result)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## What it does

«حصة خارج استعمال الزمن» logs a support, catch-up, review or supervised-study session for one of the teacher's classes (R-3.3-16). It opens from the plus beside Help on Today and from the foot of a class's plan.

- **The class and the kind.** The choices are each of the teacher's classes in each subject taught there, and a joint class once for each of its levels. A class whose week is not drawn yet can have one too: its course is made when the session is saved, as drawing the week would make it.
- **The day,** on a month's grid that starts on Sunday, from the school year's first day to today or the year's last day. A later day is crossed out and cannot be chosen, since a session is logged once it has taken place. Before the year starts, the screen says so and logs nothing.
- **The times,** typed as in the paper book, such as 15:00, in Western or Eastern Arabic digits. The time of the tap is never recorded (R-3.3-17).
- **A topic,** optional, in the teacher's words. It is a private note that stays on the teacher's own devices: it never goes onto the texts book's page, a handover or a statement. «تراجع» clears it with the session. The screen asks not to write pupils' names in it.
- **The row it takes** on the texts book's page for supervised or additional lessons shows before saving: number, subject, kind, date and time (R-3.8-26). The page itself prints with the texts book ([#213](https://github.com/djazairdev/minhajna/issues/213)).
- **It does not move the plan,** and the class's buffers stay as they were (R-3.3-18).
- **Saving** keeps the class, the kind and the day for the next one. A second tap waits for the first save. «تراجع» removes the session, and the history keeps both.

In the core, a session outside the timetable is its own record, `extra.logged`, in the lesson-record layer. A removal is `extra.removed`. They never enter the plan's sessions, so pacing, Today and the roll call do not see them. The topic is a `session.noted` private note keyed `extra:<id>`, in the own-devices layer.

Make-up sessions, which count as plan sessions and go on the subject's pages, come with make-up, support and revision days: see [make-up-days.md](make-up-days.md).

## The result

| Check | Result |
|---|---|
| The plus on Today opens the screen, and TalkBack names it «حصة خارج استعمال الزمن» | **Passed** |
| A teacher with two classes and no drawn week can choose either one | **Passed** |
| The month's grid runs right to left from Sunday; days after today are crossed out and refused | **Passed** |
| The preview row reads, for TalkBack, «الرقم 1، المادة اللغة العربية، النوع دعم، التاريخ 2026/10/01، التوقيت 15:00 – 16:30» | **Passed** |
| Saving shows «حُفظت الحصة في دفتر النصوص.», clears the times and the topic, and the next row is number 2 | **Passed** |
| «تراجع» removes it, and the next row is number 1 again | **Passed** |
| The screen is hidden from screenshots unless the teacher allows them | **Passed.** The window is `SECURE` |
| Each day on the grid is a touch target of at least 48 dp | **Passed.** 56 × 50 dp on a 411 dp wide screen, about 49 dp wide on a 360 dp one |

Faults found and fixed while checking:
- In the preview, the date wrapped onto two lines; the columns now have their own widths.
- The time fields' example looked like a typed value; it now reads «مثل: 15:00».

The review before committing found more, all fixed:
- The topic could have carried pupils' names onto shared records; it is now a private note.
- A day before the year's first day or after its last could be chosen.
- A quick second tap saved the session twice.
- A joint class had one choice, so its levels' courses were mixed.
- The preview's number ignored the day and time of earlier rows, and counted other years' sessions.
- «تراجع» pressed twice recorded two removals.
- The days on the grid were smaller than 48 dp.
- Times in Eastern Arabic digits, or with «٫» or «،» between hours and minutes, were refused.
- A removed session kept its topic note.

## Repeating the checks

1. Build and install the debug app: `./gradlew :app:installDebug` in `apps/android/android`.
2. Set up two classes without drawing the week, then open Today and press the plus beside Help.
3. Choose a class, a kind, a day before today, and type the times. Read the preview, save, then press «تراجع».

The core tests in `packages/core/test/extra.test.ts` and the app tests in `apps/android/__tests__/extra-session.test.tsx` cover:
- the rules: no later day, the school year, the times in either digits, the course and the kind;
- corrections and removals, with the history kept;
- the plan left unmoved;
- the page's numbering for each class and year;
- the layers, with the topic kept off every shared route;
- the screen, from both entry points, for a joint class, before the year, and against a double tap.

## Still open

- **TalkBack in Arabic and text at 200%,** on a real phone.
- **The texts book's page** for these sessions, with #213.
