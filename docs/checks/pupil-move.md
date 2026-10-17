# Pupils who join or leave (#40)

Checks of 18 October 2026 for [#40](https://github.com/djazairdev/minhajna/issues/40), on `feat/40-move`. Made-up schools, classes and pupils only.

## What changed

- **The core** records the moves of PRD §3.2 in `pupil-moves.ts`:
  - `joinPupil` adds a pupil at the end of the class list, called from the day they join. It checks the class, a name, and a registration number of digits only that no other pupil of the school has.
  - `leavePupil` records a departure with its day and coded reason. The pupil stays on the list until `confirmDeparture` records the director's confirmation.
  - `pendingDeparture` gives the departure still awaiting it. Reasons are codes, never words about the pupil: `transfer`, `class-change` and `other`.
- **«إضافة أو نقل»** (`Pupil-move`) opens from the roll call. Two chips choose «التحاق» or «مغادرة» until the segmented control comes (#136).
  - Joining asks for the name, the sex, the registration number if the official file gives it, the day and the reason. «يُضاف آخر القائمة برقم 46، كما في دفتر المناداة الورقي، ويُحسب حضوره من هذا التاريخ.»
  - Leaving asks for the pupil, from the class list in a sheet, then the day and the reason. «يبقى في القائمة مع سبب مغادرته حتى يُسجَّل تأكيد المدير.» The pupils awaiting it are listed below, each with «تأكيد».
  - The day is today or the next working day, or, under «تاريخ آخر», a working day of the two weeks around today.
- **The roll call** shows «غادر في 11 أكتوبر · ينتظر تأكيد المدير» under a pupil whose departure awaits confirmation.
- **Numbers stay as on paper.** A pupil keeps their number on the roll call for good. A pupil who leaves keeps theirs, and one who joins takes the next.
- **Not here:** half-groups for a pupil who joins, which the class's groups screen will set, and the Pupil screen.

## Checks

| Check | Result |
|---|---|
| Android tests | 758 pass. The new ones are in `__tests__/pupil-move.test.tsx`. They cover: a pupil joining at the end of the list from their day; the registration number checked; a pupil leaving who stays on the roll call with a note until the director confirms; the confirmation; numbers kept; the link from the roll call; and every text in French and English. `accessibilityProblems` is empty |
| Core tests | 247 pass. The new ones are in `packages/core/test/pupil-moves.test.ts` |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, the made-up 4AM class's roll call of Sunday 11 October was opened from «إدخال مناداة من الورقة».

- «إضافة أو نقل» read «القسم التجريبي · 45 تلميذاً».
- Joining «Anis Belhadj» from 11 October, as a transfer, added him as number 46 on that roll call, with 46 present.
- Pupil 2 leaving on 11 October, as a transfer, showed «غادر في 11 أكتوبر · ينتظر تأكيد المدير» under the name, and the pupil was still counted.
- «تأكيد» cleared the list awaiting confirmation. The roll call then read 45 present, numbered 1, 3, 4 … 46.

The emulator check led to two fixes:

- the roll call no longer renumbers the class after a departure;
- the number in the joining note is kept in its own direction, so the Arabic comma after it stays Arabic.

It also found three problems outside this change, each filed as its own issue:

- the «تاريخ آخر» chip shows only «تاريخ» ([#185](https://github.com/djazairdev/minhajna/issues/185));
- a session without a pack offers no roll call on Today ([#184](https://github.com/djazairdev/minhajna/issues/184));
- the app opens on the welcome screen again after a restart ([#183](https://github.com/djazairdev/minhajna/issues/183)).

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
