# The texts book's pages

How the texts book's pages for each class and subject, its page 08 for supervised or additional lessons, and its pages in the app were checked for [#213](https://github.com/djazairdev/minhajna/issues/213) (PRD [§3.8](../prd/PRD.md#38-the-documents)), in its three pull requests. Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

- [What it does](#what-it-does)
- [The result](#the-result)
- [Repeating the checks](#repeating-the-checks)
- [Still open](#still-open)

## What it does

The Documents tab lists «دفتر النصوص» with the daily journal and the roll-call book. It prints the month of the day it is opened, as recorded or blank, through the phone's print service or as a PDF.

- **One run of pages for each class and subject** the teacher teaches this school year, in the order of the Classes tab. A subject with no session confirmed in the month has no page that month. When no subject has one, each gets a page that says so.
- **The head,** in the book's language, Arabic, right to left: the school, the school year, the class, the subject, and «دفتر النصوص · الصفحة 2» in Ruqaa. The paper book's pages are numbered from the school year's first. Each month starts a new page, so a month printed later carries on from where the month before stopped.
- **The columns,** as in the paper book: the date, the time, the topic or work set, and the signature. They are written in the subject's language and run in its direction (R-3.1-18, R-3.8-63): French and English from left to right, with French headings such as «Émargement» for French. Until the app speaks German, Spanish and Italian, their pages keep the book's Arabic words and direction, and the teacher's own text in them runs left to right.
- **A row for each confirmed session** (R-3.8-14), as «تفاصيل الحصة» already shows it: the unit, the lesson and its stages, «تابع» for a continued lesson, content from outside the plan, a test, the homework with its due day, and the factual line.
  - A session awaiting confirmation never prints (R-2.3-14). One the calendar took prints only if the teacher had confirmed it, as in the daily journal.
  - Make-up sessions print on the subject's pages, with their dates (R-3.8-28).
- **The date** is Gregorian, with Western digits (R-3.8-59): year first on a right-to-left page, as the book is written by hand, and day first on a left-to-right one.
- **The time** comes from the school's bells, with Ramadan's times on a Ramadan day, so a shortened session prints its real length (R-4.5-14). It is written as by hand, as the design screens write it: «08سا – 09سا» or «08سا – 08سا45» in Arabic, with the start on the right, and «08h – 09h» in French.
- **Rows are never cut** across pages. A row's height is estimated by wrapping its words, on the safe side, with each entry's ruled foot counted. Empty rules 7.3 mm apart fill each page to its foot. The signature column stays blank, to sign by hand.
- **A joint class** has a run of pages for each level, named with its level, as on the Classes tab.
- **The blank version** gives each class and subject one page, with its head filled in and its rules empty.

**Page 08, for supervised or additional lessons** (Decision 835 of 13/09/1991, R-3.8-26), is its own entry on the Documents tab, «الدروس المحروسة أو الإضافية», since it holds the whole school year.

- **One page 08 for each class** taught this school year, in Arabic, on the book's head, titled «الدروس المحروسة أو الإضافية بالمؤسسة» with the decision as its footnote.
- **A row for each session** logged outside the timetable (support, catch-up, review, supervised study) and each session of a support or revision day (R-3.3-18). Rows are numbered in order through the year, as the screen for a session outside the timetable numbers them.
- **The columns:** the number, the subject (with its level in a joint class), the kind of activity, the date, and the time as by hand, «14سا – 15سا30».
- **A class with none** gets the page blank, with its heads and empty rules (R-3.8-29), and so does every class in the blank version.
- A year with more rows than a page holds runs on to another page. A long subject name wraps, and the rules it takes are counted.
- Make-up sessions are not here: they go on the subject's pages (R-3.8-28).

**The book in the app** (P09, P10) opens from «دفتر النصوص» on each class's card on the Classes tab.

- **One class and subject, page by page as it prints,** in the subject's language and direction, opening on the latest page. «الصفحة السابقة» and «الصفحة التالية» turn the pages.
- **The class's other subjects** are chips at the top.
- **A confirmed row** carries a check in the signature column and opens «تفاصيل الحصة» to correct it.
- **A session awaiting confirmation, up to today,** shows grey on the page of its month, marked «تنتظر التأكيد» or «مقترح · اليوم», in what confirming it as proposed would record. It never counts towards the printed pages or their numbers, so a month of awaiting sessions only is named by its month alone, «لا صفحة مطبوعة بعد» (R-2.3-14). When a lesson is proposed, «تمّت كما هو مقترح» confirms it with one tap, with «تراجع» (R-2.3-07), as on Today; «تراجع» goes once the session is recorded otherwise, so it never takes back a later correction. «تفاصيل الحصة» opens it for another outcome.
- **«طباعة» and the month on screen** opens the texts book's output for that month, so any month of the year prints. The output screen now names the period it prints, such as «قسمان · سبتمبر 2026».
- **The time is written as by hand** in «تفاصيل الحصة»'s preview and in its row as recorded, and the homework's own words are isolated, so a French line keeps its order inside an Arabic one there, on screen and on paper.

In the reference data, profile release `2026.4` gives the profile a teaching language, `ar`, and gives French, English, German, Spanish and Italian their own. Tamazight keeps the profile's language for now (`data/README.md`).

## The result

| Check | Result |
|---|---|
| «دفتر النصوص» is listed with «قسمان · أكتوبر 2026» | **Passed** |
| Its output screen says the signature column stays blank and no session awaiting confirmation prints | **Passed** |
| With sessions confirmed in September and October, October's pages are numbered 2, one for each class | **Passed** |
| The head runs right to left: the school and «القسم: 4AM1» on the right, the year and the subject on the left, the title in Ruqaa | **Passed** |
| Dates read «2026/10/01», times «08سا – 09سا», the start on the right as on Today | **Passed** |
| A session still awaiting confirmation is left out | **Passed** |
| A long topic wraps onto three lines and the homework line keeps its due date in order; the page still fits on one A4 | **Passed** |
| The print service's preview shows the same pages | **Passed** |
| The French page, blank, runs left to right under the Arabic head (in a desktop browser, from the test data) | **Passed** after a fix |
| «الدروس المحروسة أو الإضافية» is listed with «قسمان · الصفحة 08 · السنة الدراسية» | **Passed** |
| With no session outside the timetable, each class's page 08 prints blank, with its heads, as the Supervised-empty screen draws it | **Passed** |
| A supervised study logged on 6 October, 14:00 to 15:30, prints as row 1: «اللغة العربية · دراسة محروسة · 2026/10/06 · 14سا – 15سا30» | **Passed** |
| Each class card on the Classes tab has «المخطط» and «دفتر النصوص» | **Passed** |
| 4AM1's book opens on «الصفحة 2 · أكتوبر 2026», with three confirmed rows and the awaiting sessions of 12 and 15 October in grey, offering «تفاصيل الحصة» only, as nothing is proposed without a plan pack | **Passed** after a fix |
| «الصفحة السابقة، 1» shows September's page; «طباعة سبتمبر 2026» opens the output for «قسمان · سبتمبر 2026», and the PDF's page 1 holds September's rows | **Passed** |
| A confirmed row opens «تفاصيل الحصة» in correction mode, and going back keeps the page | **Passed** |

Three faults were found and fixed while checking:
- The first PDF after the app started printed with its text hidden: it was printed before its fonts had loaded. That fault affected every document, and is fixed separately in [#260](https://github.com/djazairdev/minhajna/pull/260).
- About every tenth empty rule dropped out of the PDF, as a thin drawn stripe can. The empty rules are now table rows.
- «Émargement» did not fit its column; the signature column is wider.

The review before committing found more, all fixed:
- German, Spanish and Italian pages put the book's Arabic words in a left-to-right layout.
- The estimate of a row's height counted characters, not words, so a row of long words could take a rule more than counted, and two such rows could push empty rules onto a sheet of their own.
- The Documents tab offered the texts book with an empty document when the teacher's classes were all of another school year.
- A joint class's level without its own grade was not named.
- A long word, such as a web address, ran into the signature column.
- On page 08, a long subject name that wrapped could push the page's foot onto a sheet of its own; pages now count the rules each row takes.
- The Documents tab counted classes of earlier years for the texts book.
- In the app, a session awaiting confirmation without a proposed lesson offered «تمّت كما هو مقترح»; it now offers only «تفاصيل الحصة», as Today does.
- A French homework line wrapped out of order inside an Arabic one; its words are now isolated.
- The row as recorded, in a correction, still gave the clock time; it now gives the book's, as the preview does.
- The audit found the app's page numbers counting a month of awaiting sessions, unlike print; «تراجع» able to withdraw a correction made after it; the last row hidden under the undo bar; a joint class's subject chips without their level; and, on re-audit, a month of awaiting sessions sharing its number with the next printed month. All are fixed and tested.

The emulator's teacher had no plan pack, so the sessions were confirmed with content from outside the plan.

## Repeating the checks

1. Build and install the debug app: `./gradlew :app:installDebug` in `apps/android/android`.
2. Set up classes, draw the week and confirm some sessions on Today, then open the Documents tab, press «دفتر النصوص», and save or print it, as recorded and blank.

The core tests in `packages/core/test/profile-languages.test.ts` and `data.test.ts`, and the app tests in `apps/android/__tests__/texts-book.test.ts` cover:
- each subject's language, and a profile without one;
- a confirmed session, and one awaiting confirmation;
- the Arabic head over French columns, left to right, and a German page;
- page numbers carried on from the month before;
- Ramadan's time;
- rows kept whole, wrapped by words, and the empty rules;
- the blank version, and a month with nothing confirmed;
- the Documents tab's entry, with no class of this school year, and the saved file's name;
- in `book-view.test.tsx`, the book in the app: page numbers, awaiting sessions on their month, one-tap confirmation and «تراجع», «تراجع» gone after a correction, numbers matching print after a month left awaiting, an earlier page, a row's details, the month's print, other subjects, and an empty book;
- in `supervised-page.test.ts`, page 08: sessions outside the timetable and a support day's, numbered; a class with none, and the blank version; a year of rows over several pages, with a long subject; and its entry.

To check page 08 on a phone, log a session from Today's plus, «حصة خارج استعمال الزمن», then open «الدروس المحروسة أو الإضافية» on the Documents tab.

## Still open

- **Page numbers for a session confirmed late.** Each month's pages are numbered after the months before, as recorded now. A session of an earlier month confirmed after that month was printed moves the numbers on, so a number can be skipped. Reprinting the earlier month from the book in the app puts the late row on paper; whether printed pages should then keep their numbers is left to the pilot's teachers.
- **Printed at 100% on A4 and compared with the paper book,** on paper, by the founder.
- **A month in under 10 seconds on a budget phone.**
- **TalkBack in Arabic and text at 200%,** on a real phone, for the printed pages and the book in the app.
- **Homework and what is due today** in the book, with [#214](https://github.com/djazairdev/minhajna/issues/214).
