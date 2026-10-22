# Catch-up options, catch-up sessions and the support queue

Checks of 22 October 2026 for [#228](https://github.com/djazairdev/minhajna/issues/228), from [#345](https://github.com/djazairdev/minhajna/pull/345), [#346](https://github.com/djazairdev/minhajna/pull/346), [#347](https://github.com/djazairdev/minhajna/pull/347) and [#348](https://github.com/djazairdev/minhajna/pull/348), on main `c10c844`. Made-up content only.

## What changed

- **Catch-up options** (answers 349 to 352, [Catchup](../design/screens/Catchup.png)): while a class has used buffers or is behind its plan before the next exams, the class's plan shows «خيارات الاستدراك». The screen gives the class's pace, then the rungs in order:
  - Rung 1 is words only: the teacher shortens the item in progress, and the app changes nothing.
  - Rung 2 states the buffers used and left before the next exams. The class's TD line states its own sessions and items left.
  - Rung 3 lists the pack's merges and the optional items, among the items not yet taught that the next exams' term needs. None is ticked. Each has its own «تأكيد», with «تراجع» at once and a take-back in the list of decisions.
  - Rung 4 opens «إضافة حصة».
  - Rung 5, re-pacing, comes with [#229](https://github.com/djazairdev/minhajna/issues/229) and is not shown until then.
  - The closing line says nothing is dropped or pushed past the exams without the teacher knowing, and that every change can be taken back from the history.
- **Catch-up sessions** (answers 353 to 358, [Catchup-add](../design/screens/Catchup-add.png)): one session for one class, on a day and a bell slot, never a clock time.
  - The screen offers the next six free times of the two weeks from tomorrow, or «موعد آخر»: any day to the year's end and its slots with a time. A slot where the teacher already teaches, in any school, is refused with the class it clashes with. Two schools' slots meet when their bell times overlap.
  - It is a plan session: it takes the class's next item, shows on Today and goes on the subject's pages with its date.
  - When the class has make-ups due, it makes up the oldest by default, and the make-up comes back if the session is cancelled.
  - A session not yet recorded can be cancelled, with «تراجع».
- **Support queue** (answers 359 and 360, [Support-queue](../design/screens/Support-queue.png)): each class has its own list of support items in the teacher's words, to add, reorder and delete. It never moves the main plan or counts in its delay.
  - Each support or «تدارك» session logged takes the first item not finished. The extra-session form shows it, with «أُنجز العنصر» ticked by default.
  - The logged session keeps the item it took, so later edits never rewrite the past.
- **Scheduled support sessions** (answers 361 and 362): «إضافة حصة» offers «حصة استدراكية» or «دعم أو تدارك».
  - A support session takes a free time and the teacher's time, but moves no plan, makes up nothing and goes on the additional lessons page once logged.
  - The queue pairs the sessions not yet logged with the items left, in order, as «تأخذ: …». From its day on, «تسجيل» opens the extra-session form filled in with the class, the kind, the day, the bell times and the paired item. Saving it ends the scheduled session. Until then «إلغاء» cancels it, with «تراجع».
  - Today shows the day's scheduled support sessions after the session cards.
  - Cancelling one says a support session was cancelled, and an undo refused because its time was taken says so.

No permission or network call changes. The lesson record gains three kinds of event (`catchup.set`, `catchup.removed`, `support.set`), which the records the app sends and the sync check carry like the others, and a logged extra session gains optional fields (`item`, `finished`, `scheduled`).

## Automated checks

| Check | Result |
|---|---|
| Core tests | `catch-up.test.ts` (3), `catch-up-sessions.test.ts` (4), `catch-up-times.test.ts` (3), `support-queue.test.ts` (4), `support-schedule.test.ts` (5): the rungs and their undo, free times across schools and added days, make-ups linked and freed again, items taken once and kept, scheduled sessions never in the plan and ended once, from their day on |
| Android tests | `plan-catchup.test.tsx` (8), `plan-catchup-add.test.tsx` (8), `plan-support.test.tsx` (8), `plan-support-schedule.test.tsx` (7), and `plan-catchup-scale.test.tsx` (4: the options, both kinds of «إضافة حصة» with «موعد آخر» and its month open, and the support list, in Arabic and English, at 100% and 200%: every control named and every text free to grow and wrap) |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:** each rung reads its number, then its heading as a header, then its lines, and each «تأكيد» names its choice. Each free time on «إضافة حصة» reads its day and bell time. Each support item reads its number and title; the move and delete buttons come after the list, once an item is selected. Each scheduled session's «تسجيل» and «إلغاء» name its time.
- **On a phone:** right to left and left to right, with text at 200%. The rungs, the free times, the month grid and the support list wrap without clipping, with touch targets of at least 48 dp, on Android 8 at 360×800.
- **On paper:** the texts book with a catch-up session on the subject's pages, and a logged support session on the additional lessons page, with its date and time.
