# Corrections after the term (#243)

Checks of 23 October 2026 for [#243](https://github.com/djazairdev/minhajna/issues/243), on `feat/243-fix-core`. Made-up classes and records only.

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
