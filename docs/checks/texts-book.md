# The texts book's subject pages

How the texts book's pages for each class and subject were checked for [#213](https://github.com/djazairdev/minhajna/issues/213) (PRD [§3.8](../prd/PRD.md#38-the-documents)), the first of its pull requests. Every record in these checks is made up. They ran on 18 October 2026 on `minhajna-claude-api35`, an Android 15 emulator with a 1080×2280 screen, without Google Play services.

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
- the Documents tab's entry, with no class of this school year, and the saved file's name.

## Still open

- **The page for supervised or additional lessons** (R-3.8-26, R-3.8-29), in the next pull request for #213.
- **The book's pages in the app** (P09, P10), with any month to print, in a later pull request for #213. Until then the Documents tab prints the current month.
- **Page numbers for a session confirmed late.** Each month's pages are numbered after the months before, as recorded now. A session of an earlier month confirmed after that month was printed moves the numbers on, so a number can be skipped. The rule comes with the choice of month.
- **Printed at 100% on A4 and compared with the paper book,** on paper, by the founder.
- **A month in under 10 seconds on a budget phone.**
- **TalkBack in Arabic and text at 200%,** on a real phone.
