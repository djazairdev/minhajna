# The roll-call book's month and year (#217)

Checks of 19 October 2026 for the Month and Month-year screens of [#217](https://github.com/djazairdev/minhajna/issues/217), on `feat/217-month`. Made-up classes and pupils only.

## What changed

- **The Class page's roll-call row** now opens the roll-call book, «دفتر المناداة · <class>», on the latest month.
- **Chips** for the school year's months up to today, then «الملخص السنوي».
- **A month** shows:
  - its Gregorian month and the Hijri months it spans, from the bundled Umm al-Qura table (answer 253);
  - the legend: «-» a morning, «ǀ» an afternoon, «+» a whole day, «(-)» justified, «+م½» a whole day with one half justified (answers 253 and 258);
  - a table of the class's session days up to today (answer 258). The names stay at the start, the days scroll sideways and open on the latest, and «غ», «ح-ف» and «تأخر» close each row. The counts are in half-days, for the pupils the Class page lists;
  - under the table, «ح-ك N لكل تلميذ», or the plain total when pupils differ, with the absences, the half-days possible and the rate;
  - «قواعد العدّ».
- **A day's head** opens its roll call, Roll-past for an earlier day. A day with two or more roll calls opens a sheet listing them by time, each saying whether it was taken (answer 255).
- **A roll call the timetable or the calendar no longer gives**, after a timetable change or a closure added later, still counts in the core, so its day keeps a column with its marks. Its sheet lists it, says so, and opens nothing.
- **A counting start date** inside the month, from the counting rules, is said under the table: no mark shows before it, as none is counted.
- **The yearly summary** gives «ح-ك», «غ», «ح-ف» and the rate for each month and for the year, for every pupil, with the class's totals in the last row. Months to come stay empty, and the year ends in June unless a roll call was taken in July (answer 255).
- **Accessibility:**
  - each pupil's row is read once, from the name: the counts, then each day missed in words;
  - each day's head is a 48dp button named by its day.
- **Not yet:** the print buttons wait for Roll-print, later in #217 (answer 258); the landscape roll pages still print from the Documents tab. A pupil's row opens their page once the Pupil screen exists.

## Checks

| Check | Result |
|---|---|
| Android tests | 7 new: every mark; the month's head, marks, spoken rows and totals; the sheet for a day with two roll calls; a roll call the timetable no longer gives, and a counting start date; the chips, an empty month and the rules; the yearly summary ending in June, with its class totals; French, left to right. All controls named and at least 48dp |
| Type check, ESLint, Prettier | Pass |
| Android emulator, debug build | Three made-up pupils joined 4AM1 from 5 October. A tap on 12 and 15 October opened Roll-past, and the absences and the late arrival were saved. The month then showed «-» on the right days, «غ 2 · ح-ف 0» for the pupil absent twice, the late arrival, and «ح-ك 2 لكل تلميذ · المجموع 3 غيابات من 6 · الحضور 50%». The head read «أكتوبر 2026 · ربيع الثاني – جمادى الأولى 1448». The yearly summary showed October's figures and the class total |

The review before committing found three faults, all fixed: a roll call left without its session had no column for its mark; «لكل تلميذ» ignored a pupil with nothing counted yet; and a counting start date hid earlier marks without saying so.

Two faults were found and fixed on the emulator:
- Android starts a right-to-left sideways scroll at its first day and ignores an early scroll. The Arabic days are now laid out in reverse in a left-to-right scroll, so the table opens on the latest day.
- The «ح-ف» and «تأخر» heads broke inside the word in narrow columns.

## Still to do by a person

TalkBack in Arabic on both screens and the day sheet (see #206). The yearly table is read as one row per pupil with the year's figures; whether each month's figures should be read too is for that check.
