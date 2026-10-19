# Printing the week, and the weekly timetable

How the teacher's weekly timetable as a document, the one PDF a print shop can use, and «طباعة الأسبوع», the screen that prints the week, were checked for [#215](https://github.com/djazairdev/minhajna/issues/215) (PRD [§3.8](../prd/PRD.md#38-the-documents), [§4.6](../prd/PRD.md#46-how-sessions-are-generated)). Every record in these checks is made up. They ran on 19 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [The weekly timetable](#the-weekly-timetable)
- [One PDF for the print shop](#one-pdf-for-the-print-shop)
- [The print screen](#the-print-screen)
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

## One PDF for the print shop

«طباعة الأسبوع» binds the chosen documents into one PDF (R-3.8-52), each made as the Documents tab makes it. `src/documents/print-set.ts` builds the PDF, and the phone's web engine prints it as one document, with portrait and landscape pages in their own orientation.

- **Each document as it prints alone.** A document's own styles apply to its pages only, through `:where()`, which adds no weight to a rule, so each page lays out as it does on its own.
- **Books.** A book is a document's pages for one class, such as its texts book or its roll-call book, or all its pages for a document kept as one, such as the journal. A document's copies, such as a journal's days, are gathered book by book, so each class's pages come together. A day with no session in a journal kept for each class, or in the specialist's journal, names no book and is left out.
- **Binding margins (R-3.8-51).** The wider margin, 18 mm against 12, falls on the spine's side of a portrait page: the right of a page in Arabic and the left of one in French or English, on every document. Printed on both sides, it alternates with the side facing the spine. Landscape pages keep 12 mm on their long edges, as their layouts fill the rest. Without binding margins, both sides get 15 mm. The text keeps its width either way, so no page's layout changes.
- **Both sides (R-3.8-54).** Each book starts on a sheet of its own, so a class's pages can go into its own book: a blank page goes before a book that would start on the back of a sheet. Only the web engine knows how many pages each book takes, so a counting pass prints the set once with a red and green mark at the top of each book's first page, taking no room; the native module reads the colours at two points on each page and deletes that PDF at once.
- **The summary (R-3.8-56).** The printed pages, the sheets they take, and their cost at about 5 DA a page.

What the web engine does, found on the emulator's (Chromium 124):

- A named page with `size: A4 landscape` gives landscape pages in a portrait document, laid out at their full size. Other sizes snap to A4.
- `@page :left` and `:right` give the two sides their margins, and a right-to-left document starts on a left page, as an Arabic book does.
- `break-before: right` adds no blank page, so the set adds its own.
- On a named page, a repeated table footer moves to a page of its own, which would print «داخلي · سري» alone on an extra page. So the set's own page takes the orientation of the documents with pupils' data when they share one, such as the roll-call book's landscape in a CEM teacher's week, and only the other orientation is named. A page with pupils' data on the named one keeps «داخلي · سري» at its head on every printed page and at its foot at its end only.

## The print screen

«طباعة الأسبوع» is the Documents tab's first row, with how many documents have something new since their last print, such as «7 وثائق فيها جديد», or «لا جديد منذ آخر طباعة» (answers 249 to 252).

- **The documents (R-3.8-53).** Each document the teacher's set can hold, those with something new ticked. Its line says its range, what that covers, such as «من 15 أكتوبر 2026 إلى 22 أكتوبر 2026», «سبتمبر 2026، أكتوبر 2026» or «ساري من الإثنين 21/09/2026», or «لا جديد», then its pages once counted. The journal counts its own days with a session; the roll-call and texts books their months, a month printed part-way offered again; the year's documents until printed once that year; and the timetable its version, until printed. The strip is not in the set.
- **The range (R-3.8-55).** A day or month document's «نطاق الطباعة» sheet chooses what is new, a month of the school year, or two dates, a day at a time, the first never after the second. The sheet says what the range covers as it changes. A journal also chooses one journal or one per class there.
- **The choices.** One or two sides; the signature box, blank until the drawn signature (#236), and the documents' template, the default until #237, shown and disabled; binding margins; a blank copy of each ticked document. They stay on this phone, out of the history, in the app's own preferences, which backups leave out. The first time, it prints on two sides with binding margins.
- **The summary.** A moment after a change, the counting pass counts each book's pages, and the summary gives the pages, sheets and cost. When the pages cannot be counted, it says so, and printing still works, with no blank page between books.
- **The record.** A print counts once Android's print screen opens or the PDF is saved, and records each document's range in the teacher's private history; a cancelled save records nothing. A ticked document with nothing in its range prints only its blank copy, if asked, and leaves no record.

## The result

| Check | Result |
|---|---|
| Android tests | 1219 pass. The new ones cover the version in force with its bell times, each class's hours and the total, the day it applies from and the boxes; another day's version, and the first before it applies; the first version that ever applies, never last school year's; a week A slot counting half; the teacher's own time; a week of two schools; the blank version; and the Documents tab's line, file name and empty state |
| On the emulator, «استعمال الزمن الأسبوعي» prints one A4 portrait page: «CEM Test» and «السنة الدراسية 2026-2027» on top; 4AM1 and 4AM2 on Monday and Thursday at «08:00 – 09:00» and «09:00 – 10:00»; «4AM1: ساعتان · 4AM2: ساعتان · المجموع 4 ساعات في الأسبوع»; «ساري من الإثنين 21/09/2026»; and the three boxes | **Passed** |
| A fuller made-up week printed through desktop Chrome, with a pedagogical half-day, fits one sheet | **Passed** |
| Android tests for the print set | 1231 pass. The new ones cover a document read back with each page's book, the frame's foot after its content, a day with no session left out, the binding margin's side, books gathered across days, each class's pages naming its book, styles scoped with no added weight, the set's own page and the named one, the margins on one side and on both, the blank pages, the counts read from the marks, and the pages, sheets and cost |
| On the emulator, a CEM teacher's set: the timetable, a week of the journal kept for each class, the roll-call book and the texts book, on both sides. The counting pass found 8 books of 1, 2, 2, 3, 1, 1, 1 and 1 pages in 0.84 s; the PDF has those 12 pages and 5 blank ones, the roll-call pages in landscape, the binding margin alternating, and each document laid out as on its own | **Passed** |
| On the emulator, a set whose documents with pupils' data mix orientations, the roll-call book in landscape and a portrait page: the set's own page is portrait, the roll-call pages are named landscape pages of one page a class, and both kinds keep «داخلي · سري» above and below their content | **Passed** |
| Android tests for the print screen | 1252 pass. The new ones cover the documents listed and what is new in each, nothing new once all are printed until the next session and the next month; each ticked document's copies with its blank copy after them; a document with nothing in its range; each document's pages and line; the choices kept on the phone, a damaged one giving way to its default; the Documents tab's row; the counting once, the summary, and a blank page before a book that would start on a back; printing and the PDF leaving their record, a cancelled save none; only the ticked documents printing, once for a double tap; a journal's month, the next one, two dates and its layout; and printing when the pages cannot be counted |
| On the emulator, a CEM teacher's Documents tab says «7 وثائق فيها جديد». The screen ticks the seven, counts 9, 3, 1, 4, 4, 2 and 2 pages, and says «25 صفحة · 16 ورقة بوجهين · نحو 125 دج». A journal's month and two dates change its line and its pages | **Passed** |
| On the emulator, «طباعة» opens Android's print screen with 31 pages, the 25 and 6 blank ones, the binding margin alternating. Back on the screen, each document says «لا جديد». The roll-call book for October saved as «طباعة الأسبوع 2026-10-19.pdf»: three landscape pages, 4AM1's, a blank one and 4AM2's, with «داخلي · سري» | **Passed** |

## Repeating the checks

1. Open the Documents tab and «استعمال الزمن الأسبوعي».
2. Press «حفظ PDF» and look at the grid, the hours and the day it applies from.
3. Step to a day before a later version of the timetable applies, and save again.
4. Open «طباعة الأسبوع» from the Documents tab's first row, and wait for the summary.
5. Change a journal's range and the sides, and watch its line and the summary.
6. Press «طباعة», go back, and see «لا جديد» on each document printed.

## Still open

- The page on paper, printed at 100% on A4, against a school's timetable form.
- A print shop's PDF printed on both sides, with portrait and landscape pages, at a print shop: the right pages in the right order, each book on its own sheets, the binding margin on the spine's side.
- The counting pass's time on a budget phone, and the print screen's with a full school year.
- TalkBack on the print screen and its range sheet, on a real phone.
- TalkBack on the output's day choice, on a real phone.
