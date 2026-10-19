# The Class page (#279)

Checks of 19 October 2026 for [#279](https://github.com/djazairdev/minhajna/issues/279), on `feat/279-class-page`. Made-up classes and pupils only.

## What changed

- **The Classes tab's cards** now offer «القسم», which opens the Class page, beside «دفتر النصوص»; the plan opens from the page (answer 257).
- **The Class page** reads the record and adds nothing to it:
  - the subject and the pupil count, and chips to switch to the teacher's other classes of the subject;
  - today's session with its time and roll call, opening the roll call, when the class has pupils;
  - a row for each record, each with what it holds and opening its screen:
    - the texts book, with the last confirmed session and its page;
    - the plan, with its pace and the guided work against what is left;
    - the roll-call book, with the month's absences and lateness so far in half-days and the attendance rate (answer 253), for the pupils listed, or «لا مناداة بعد» until a roll call is taken this month, whatever the rule for those not taken; the row stays disabled until the month screen of #217 exists;
    - homework, with everything due today, whichever group it was set to;
    - sessions outside the timetable;
    - supervised or extra lessons, page 08 of the texts book, with their count;
    - assessment, disabled, «يأتي في إصدار لاحق»;
  - the pupils in the class list's order, each with the month's absences and lateness so far, and «إضافة أو نقل»; a pupil opens nothing until the pupil screen of #217 exists.
- **The settings button** in the top bar opens the class's settings that exist (answer 256): the seating plan, the counting rules and pupil moves, each closing the sheet first.

## Checks

| Check | Result |
|---|---|
| Core tests | Pass |
| Android tests | 1264 pass, 8 of them new: the texts with nothing taken, no pupils, the half-day counts for the class and each pupil, the month counted only up to today and no roll call said as such when the rule counts those not taken as present, every homework due today including a half group's, each row's screen and the switch, the month and pupil rows once given, and the settings sheet |
| Type check, ESLint, Prettier | Pass |
| Android emulator, debug build | The Classes tab showed «القسم» on both cards; the page of 4AM1 showed the texts book's last session «الخميس 8 أكتوبر · الصفحة 02», the roll-call row «أكتوبر: لا مناداة بعد» disabled, one supervised lesson and assessment disabled; the settings sheet opened the seating plan and came back; the chip switched the page and its title to 4AM2. With no pupils typed, the list says «لا تلميذ» and no roll-call strip shows |

## Still to do by a person

TalkBack in Arabic on the page and its sheet (see #206).
