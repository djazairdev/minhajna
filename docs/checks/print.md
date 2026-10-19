# Printing the week, and the weekly timetable

How the teacher's weekly timetable as a document was checked for [#215](https://github.com/djazairdev/minhajna/issues/215) (PRD [§3.8](../prd/PRD.md#38-the-documents), [§4.6](../prd/PRD.md#46-how-sessions-are-generated)). Every record in these checks is made up. They ran on 19 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [The weekly timetable](#the-weekly-timetable)
- [The result](#the-result)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## The weekly timetable

«استعمال الزمن الأسبوعي» on the Documents tab prints the teacher's week on an A4 portrait page (R-3.8-37, Timetable-doc). Its output chooses the day, and the page shows the timetable version in force that day with this school year's classes; before one applies, the first to apply after it, never last school year's. Each version prints with the day it applies from, such as «ساري من الإثنين 21/09/2026», so a change to the timetable brings a new copy (R-4.6-04).

- **The head:** the schools of its classes and the school year; the title; the teacher's name as given in setup, the subject or subjects, and the classes.
- **The grid:** the week's days and slots, a grey rule between the morning and the afternoon. Each slot has its usual bell time when the schools agree on it, even in Ramadan, or its name. Each cell shows what the week's grid shows: the class, its school in a week of two schools, a half group, «(أ)» or «(ب)» for week A or B, and the teacher's own time, such as «نصف يوم بيداغوجي».
- **The hours:** each class's hours a week, a week A or B slot counting half, rounded to the half hour, such as «4,5 ساعة», and their total.
- **The boxes:** the teacher's signature and the director's and the inspector's visas, each with a line for its date, left for the pen; the drawn signature comes with #236.

The blank version keeps the schools, the year, the labels, the days and the slots, with an empty grid. A teacher with no timetable drawn has nothing to print, blank or not, and the Documents tab says so.

## The result

| Check | Result |
|---|---|
| Android tests | 1219 pass. The new ones cover the version in force with its bell times, each class's hours and the total, the day it applies from and the boxes; another day's version, and the first before it applies; the first version that ever applies, never last school year's; a week A slot counting half; the teacher's own time; a week of two schools; the blank version; and the Documents tab's line, file name and empty state |
| On the emulator, «استعمال الزمن الأسبوعي» prints one A4 portrait page: «CEM Test» and «السنة الدراسية 2026-2027» on top; 4AM1 and 4AM2 on Monday and Thursday at «08:00 – 09:00» and «09:00 – 10:00»; «4AM1: ساعتان · 4AM2: ساعتان · المجموع 4 ساعات في الأسبوع»; «ساري من الإثنين 21/09/2026»; and the three boxes | **Passed** |
| A fuller made-up week printed through desktop Chrome, with a pedagogical half-day, fits one sheet | **Passed** |

## Repeating the checks

1. Open the Documents tab and «استعمال الزمن الأسبوعي».
2. Press «حفظ PDF» and look at the grid, the hours and the day it applies from.
3. Step to a day before a later version of the timetable applies, and save again.

## Still open

- The page on paper, printed at 100% on A4, against a school's timetable form.
- TalkBack on the output's day choice, on a real phone.
