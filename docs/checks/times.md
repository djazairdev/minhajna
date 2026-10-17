# Bell times (#29)

Checks of 17 October 2026 for the second pull request of [#29](https://github.com/djazairdev/minhajna/issues/29), on `feat/29-times`, after the core and data (#150). Made-up schools only.

## What changed

- **Settings-times** opens from Setup-5-Week with «المواقيت». It shows:
  - today, with the times that apply, usual or Ramadan's, as the calendar says;
  - when Ramadan's times are expected, such as «ومواقيت رمضان متوقعة من حوالي الإثنين 8 فيفري 2027», or that today is in Ramadan;
  - the level the times follow, from setup, and the shift, from Week-draw;
  - a choice of school, when the teacher has two.
- **The table** lists each slot of the drawn week under its half-day, with its time at the school, such as «ص1» at 08:00 – 09:00. The range reads in the screen's direction: in Arabic the start is on the right, as the design draws it. «العادية» and «رمضان» switch the table, and the one that applies today says «اليوم».
- **Setting a time.** Tapping a slot opens its start and end, typed as on the school's bell: 8:15, 08.15 and 8h15 all read as 08:15.
  - «حفظ» keeps it on the school at once (`School.bells`), and the row says «وقت المؤسسة» in words.
  - «وقت القالب» sets the template's time back.
  - A time that is not one, or an end before the start, is kept nowhere, and the wrong field says how to write it.
- **Ramadan** keeps each session's place and start, the school's own start included, and shortens it to the level's length. A level with no template, such as primary for now, says so, and so does one with no Ramadan length.
- **The rules,** under the table: a Ramadan session counts as a full one; the texts book prints the real time; the timetable and the number of sessions before the exams don't change; recorded sessions are never rewritten.
- **The reference data** now includes `bells.json`, read through the core with the profile and the calendar. A refused file refuses all three, as before.

## Checks

| Check | Result |
|---|---|
| Android tests | 575 pass, 14 of them new: a refused bells file, reading typed times, today's times and the expected Ramadan, the template's times, a time set on the school and set back, a time refused under the wrong field, Ramadan's times and a day in Ramadan, a second school with no template, no fixed heights, and every slot and field named and 48dp in the three languages and both directions |
| Core tests | 204 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On Saturday 17 October 2026, Settings-times read «اليوم، السبت 17/10/2026» with «المواقيت العادية», and «ومواقيت رمضان متوقعة من حوالي الإثنين 8 فيفري 2027». It showed both made-up schools, «التعليم المتوسط», and the double shift drawn earlier. Slot ص3 was set to 10:15 – 11:05 and read «وقت المؤسسة». In Ramadan's table it ran from 10:15 to 11:00, and ص1 from 08:00 to 08:45.

## Still to do by a person

TalkBack in Arabic on this screen, with the other setup screens (see the BrowserStack note on #20).
