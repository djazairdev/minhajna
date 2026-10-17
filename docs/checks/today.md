# Today and the one tap (#32)

Checks of 17 October 2026 for the third pull request of [#32](https://github.com/djazairdev/minhajna/issues/32), on `feat/32-today`. It comes after the undo in the core (#159) and the Proposal, DueStrip (#158) and SessionCard (#161) components. Made-up schools, classes and timetables only.

## What changed

- **The Today tab** replaces its stand-in page. Under the day, in the display face, and its date, one line of facts says whether earlier sessions await confirmation and how many of today's are confirmed. For example: «27 حصة سابقة تنتظر التأكيد · حصة واحدة اليوم». It states facts and never judges (R-3.1-15).
- **The day's sessions in order** (R-2.3-03, R-3.3-01). Each card shows the class, and the group when it is not the whole class. It also shows the slot's time from the bell times (#29), or the slot's name without them, and the subject (R-3.3-02).
- **The next session awaiting confirmation is the focus card.** It shows the plan's proposal in pencil (R-3.3-03, R-4.7-03):
  - the tag, with «يتابع من الحصة السابقة» when the item carries over;
  - the unit;
  - the item, as «الموضوع» or «تابع» (R-4.7-13);
  - the stages this session covers, or which of the item's sessions it is.
- **«تمّت كما هو مقترح» records it in one tap** (R-2.3-07, R-3.3-06). Nothing is recorded before (R-2.3-14, R-3.1-05). The card becomes a done card with what was written, and the next session becomes the focus card. Its proposal follows what was really taught (R-2.3-12).
- **«تراجع» on the snackbar undoes the tap** (R-4.7-35). The undo is worked out before the tap, so it brings back exactly what was there. The history keeps both changes: a tap and its undo add two entries and change nothing else.
- **The other sessions** show their lesson. «تابع: …» marks an item that carries over, with the stage it goes on from (R-3.3-04). A session the calendar took shows why, and a class with no pack says that what was done is typed.
- **A help button** opens Help and the privacy notice.
- **The core context and a session's bell time** are now shared with Ready (`src/storage/core-context.ts`, `sessionTime` in `times-rules.ts`).
- **Not here yet:**
  - «نتيجة أخرى», with the other outcomes and the stage picker (R-4.7-11), which comes in the next pull request;
  - «تفاصيل الحصة»;
  - the due strips, which come with the roll call (#38) and homework;
  - an extra session.

## Checks

| Check | Result |
|---|---|
| Android tests | 627 pass. The 10 new ones cover the day's order and the focus card's proposal; the one tap and its undo, with the history two entries longer and the record back to awaiting; a day with no session; earlier sessions awaiting; and every control named and 48dp in the three languages and both directions, before and after a tap. Tests that open the tabs now give them made-up records |
| Core tests | 212 pass, after #159 |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, Today read «الأحد», «18 أكتوبر 2026» and «27 حصة سابقة تنتظر التأكيد · حصة واحدة اليوم». The focus card read 4AM3, «08:00 – 09:00», «اللغة العربية». Its proposal was in pencil: «المقطع: المقطع 1 (مثال)», «الموضوع: الإنتاج الكتابي 1 (مثال)» and the four stages.

One tap turned it into a done card reading «سُجّلت في دفتر النصوص», with «سُجّلت الحصة في دفتر النصوص» and «تراجع» on the snackbar. «تراجع» brought the proposal back. The help button opened Help.

## Still to do by a person

- TalkBack in Arabic, and text at 200%, on a real phone.
- Timing an ordinary session's confirmation against the 5-second target (R-3.1-02).
- Today opening in under 2 seconds on a budget phone.
