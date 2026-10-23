# Corrections after the term (#243)

Checks of 23 October 2026 for [#243](https://github.com/djazairdev/minhajna/issues/243), on `feat/243-fix-core` and `feat/243-fix-screen`. Made-up classes and records only.

Circular 376 locks the system on the term's last day and reopens it for about two weeks for corrections, each with the teacher's report. Once a term's last day has passed, its marks change only through a correction (answer 468). Two pull requests: this core, then «تصحيح بعد الفصل» with the teacher's report.

## Part 1: the correction record (core)

- **When a term has ended:** the day after its last day, by the school year's dates. The correction window's own dates are the administration's to announce, so the app neither stores nor enforces them.
- **A correction** (`mark.corrected`, R-5.5-02, R-5.5-03):
  - It holds the mark as corrected, the value recorded before, and a reason: an error adding up the paper, an error copying the mark, a review after an appeal, or another reason.
  - It may also hold a detail of up to 200 characters, for the report only.
  - It is refused when it changes nothing, when the mark is above its maximum or has more than two decimals, or when the detail is too long.
  - The history keeps both versions. The state keeps the corrected mark, and every correction with its day, in the order made.
- **The effect before saving:** the pupil's term average, the class average and how many reach 10, or 5 in primary, before and after.
- **The activity log** lists a correction under «التصحيحات»: the class, the term, the mark (a test by its title), the pupil by their number on the list, the values before and after, and the reason. The detail never shows. On sync, a correction is the same record as the mark it corrects.

| Check | Result |
|---|---|
| Core tests (`mark-fix.test.ts`, 5 tests) | Pass. They cover the term's end; a correction's reason, trimmed detail and refusals; the state and the history keeping both versions; a term's own corrections; the effect on the pupil's average, the class average and the count reaching 10; and the log line without the detail. |
| Sync tests (`conflicts.test.ts`) | Pass. Two devices correcting the same mark differently conflict on that mark's own record. |
| Android tests (`log-text.test.ts`) | Pass. They cover the log's line for a correction, with a pupil on the list and one who has left, a test by its title or «الفرض» when it is gone, with every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run | Pass |
| Android emulator, release build signed with the debug key | On Friday 23 October the app started, and «سجل النشاط» opened with its earlier lines and tabs. No correction can be made on the emulator before part 2's screen, so the line itself was checked in the tests. |

## Part 2: «تصحيح بعد الفصل» and the report

- **The hub of an ended term:** a line says the term's marks change only through a correction, and the «تصحيح بعد الفصل» row, with how many corrections the term has, takes the place of the rows that enter marks: the component marks, each test, the exam, and the practical work or oral. The grade book, the appreciations and the export stay.
- **The screen** (Export-fix, R-3.7-10):
  - It names the class, subject and term, and says the window for corrections is the administration's to announce: the app neither keeps nor enforces it. Before the term ends, it says the marks change from the hub.
  - Choose the pupil in list order, with their number and registration number, then one of the term's marks: each component, by month in primary, each test and the exam with its day, and the practical work or oral when the formula weighs it. Each shows its recorded value.
  - The new value is a mark within the maximum, typed in Western or Arabic-Indic digits with a point or a comma, or «غائب», for any mark. The reason is required, and the detail is optional, up to 200 characters.
  - Before saving, the effect shows the pupil's term average and the class average before and after, with how many reach 10, or 5 in primary, or says the pupil or the class has no average yet. When the average moves to another appreciation band, «تغيّرت فئة المعدل: مراجعة التقدير» links to «التقديرات».
  - Saving records the correction, keeps the pupil chosen and clears the rest of the form.
- **The term's corrections** stay listed, latest first, each read as one line: the pupil's number and name, the mark before and after, the reason and the day. A mark the term no longer has, such as an oral the formula stopped weighing, is named by its part.
- **«تقرير تصحيح نقطة»:**
  - One A4 portrait page per correction, marked «داخلي · سري»: the school and the school year, the class, subject and term, the pupil's name and registration number, the mark and its day, before and after, the reason with its detail, the correction's day, the teacher's box and the director's visa.
  - The drawn signature goes on a middle-school report only, as on the grade book.
  - It is printed or saved as a PDF named by the pupil's number, never their name, and each print or save goes into the activity log with the term.
- **«تحديث الملف»** opens the export's file screen, which makes the sheet again from the corrected register. The ostad view follows by itself.
- **An archived class** can still be corrected, since its ended term came before the archive (answer 469).

| Check | Result |
|---|---|
| Android tests (`mark-fix-screen.test.tsx`, 8 tests) | Pass. They cover the hub before and after the term's end; the pupils, with isolated names; the marks with their days and recorded values; a refused value, an unchanged one and a missing reason; a value in Arabic-Indic digits; the effect, with the band's notice and the link to the appreciations; a pupil with no average, and a component corrected to «غائب»; a kept correction with the value before and the detail, listed, its report printed and saved under the pupil's number and logged with the term; an oral the formula no longer weighs, named by its part; and every text in French and English. |
| Type check, ESLint, Prettier, root lint, typecheck and tests, the app's full Jest run (254 suites, 2,233 tests) | Pass |
| Android emulator, release build signed with the debug key, with my emulator's clock moved to Sunday 20 December 2026 and put back afterwards | Pass. On the first term's hub, the line and «تصحيح بعد الفصل» took the place of the rows that enter marks, while the second term, under way, kept its rows. The screen listed the demo class's 45 pupils with their registration numbers and, for the first, each component, Fard1 on Tuesday 10 November at 14.00 and the exam at 16.75. Correcting Fard1 to 15,5 after an appeal recorded it, listed it as «Fard1: من 14.00 إلى 15.50» and changed its recorded value. The printed report was one A4 page with every fact and both boxes. For a pupil with missing components, the effect said there is no average, and «غائب» was offered for a component. |

Still to check, on [#206](https://github.com/djazairdev/minhajna/issues/206):
- the screen and the report with TalkBack;
- a phone in French and English;
- the printed report on paper;
- a teacher correcting a mark after a real term, within the administration's window.
