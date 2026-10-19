# A pupil in the roll-call book (#217)

Checks of 19 October 2026 for the Pupil and Pupil-year screens of [#217](https://github.com/djazairdev/minhajna/issues/217), on `feat/217-pupil`. Made-up classes and pupils only.

## What changed

- **Where it opens** (answer 259): a pupil's row on the Class page, and their name in the Month and yearly tables, which become buttons.
- **The head** gives the class, the list number and the registration number when there is one. Chips cover the months up to today and «السنة الدراسية».
- **A month so far** shows «ح-ك», «غ», «ح-ف» and the rate, in half-days in the teacher's own sessions with the class. The note names the subject only when the class has one course.
- **The school year** shows a row for each month and one for the year. It runs to June unless July has a roll call (answer 255), and links «الملخص السنوي للقسم».
- **«الغيابات»** lists each half-day missed, with its day, time and half, and a «مبرر / غير مبرر» toggle:
  - it corrects every roll call that marked that half-day (a middle-school morning of two sessions counts once);
  - justifying uses «تصحيح من الإدارة», and flipping back uses «خطأ في التسجيل» (answers 254, 258 and 259);
  - it records at once, and a second tap waits until the save is done or refused;
  - if the record refuses a correction because the pupil is not on that roll call's list, a note says so; it clears when the month changes.
- **«تصحيح غياب أو تأخر مسجّل»** opens a sheet of the period's roll calls that have the pupil on their list or still mark them, each with the pupil's mark, and each opens Correct. A roll call the timetable no longer gives is listed but can't be opened.
- **«التأخر»** lists each late arrival with its day and time, from the counting start, as the counts do.
- **Before the school year** the page shows its head and says there is nothing yet.
- **The core** now checks only the corrected pupil against the roll call's list, so a correction no longer fails when another pupil marked in that roll call has since changed group. This also fixes the Correct screen, which now shows a note instead of crashing when the pupil is not on the roll call's list.
- **«سجل التعديلات»** follows the chips (answer 259). It shows when each mark was first recorded, then each change with its reason, newest first. A line that a half-day's roll calls share is shown once; one roll call's repeated changes are all kept.
- **«تسجيل انتقال أو مغادرة»** opens the pupil moves.

## Checks

| Check | Result |
|---|---|
| Core tests | 301 pass, 1 new: a correction after another marked pupil changed group, and a pupil off the list refused |
| Android tests | 1281 pass, 10 of them new, and one month test extended. They cover: the month's figures; a morning of two roll calls missed once; the toggle correcting both roll calls once, even when tapped twice, then flipping back as an entry error; the log, newest first; late arrivals and the roll calls to correct; the year to June with its spoken total; a name in the month table opening the pupil; repeated changes kept in the log; the page before the year starts; late arrivals before the counting start left out; the correction sheet leaving out a roll call taken before the pupil joined; and the record of a mark kept in the log after the pupil left and the mark was corrected. A Correct test covers the refusal note for that pupil, with nothing recorded, and the note clearing when another mark is chosen. All controls are named and at least 48dp |
| Type check, ESLint, Prettier | Pass |
| Android emulator, debug build | Opened from the month table and the Class page. October showed 2 possible, 2 absent and 0%. Justifying 12 October recorded the change at once, and the log read «12 أكتوبر: من غياب غير مبرر إلى غياب مبرر · تصحيح من الإدارة» above the two records. The year showed October's row and the year's total. The correction sheet opened Correct on 12 October |

The review before committing found more, all fixed:
- A failed save could leave the toggles disabled.
- A correction failed, and crashed, when another pupil marked in the roll call had since changed group.
- The note named the subject while counting all the teacher's sessions with the class.
- The page was blank before the school year starts.
- One roll call's repeated changes on one day merged in the log.
- The time of an absence ran across a session that wasn't missed.
- Late arrivals before the counting start were listed.
- The correction sheet listed roll calls taken before the pupil joined, and Correct crashed on them.
- The refusal note stayed after the month changed, and its wording gave the wrong cause.
- A change on a roll call the pupil had since left showed without the line that recorded the mark.
- Correct's refusal note stayed after choosing another mark.

Faults found while building and fixed:
- Two quick taps on the toggle recorded the correction twice.
- On a day with both a record and a change, the change sat below the record.
- A morning of two roll calls repeated each line of the log.

## Still to do by a person

TalkBack in Arabic on both screens and the correction sheet (see #206).
