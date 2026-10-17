# Arranging the seating plan (#41)

Checks of 18 October 2026 for the setup pull request of [#41](https://github.com/djazairdev/minhajna/issues/41), on `feat/41-seats-setup`, built on the core's seating rules (#186). Made-up schools, classes and pupils only.

## What changed

- **«مخطط الجلوس»** (`Roll-seats-setup`) opens from the roll call's «ترتيب المقاعد», for the roll call's class or group. On first use it reads «أول استعمال: شكل القاعة، ثم المقاعد».
- **A plan per group.** The whole class and each half-group have their own plan, chosen with the segmented control (#156). A class with more than three groups gets chips.
- **The room's shape:**
  - the rows, «من السبورة إلى آخر القاعة»;
  - the seats in each row, «دون الممرات», each with the Stepper (#177);
  - the aisles: «كل مقعدين», «كل 3 مقاعد» or «دون ممرات».

  A line counts the seats and the empty ones, and states the largest room: 12 rows of 10 seats, 120 pupils.
- **The seats** sit under «السبورة». Each shows the pupil's number on the class list and the given name. TalkBack reads the row, the seat, the number and the full name.
  - A tap on a name without a seat, then on a seat, places the pupil.
  - A tap on a seated pupil chooses them. A tap on another seat then moves them, and the pupil there takes the old seat. A tap on their own seat empties it.
  - «ملء بترتيب القائمة» seats the rest in list order from the board. «إفراغ المقاعد» empties every seat, with «تراجع».
- **Each change is recorded at once,** in the private layer (PRD §3.4, §6.8). The note says so, in place of the design's «حفظ المخطط», since the PRD asks that nothing be lost.
- **Not here:** the roll call on the plan (`Roll-seats`), in the next pull request, and the one-page printout, after the Arabic PDF check (#44).

## Checks

| Check | Result |
|---|---|
| Android tests | 969 pass. The new ones are in `__tests__/seats-setup.test.tsx`. They cover: the first use; filling in list order; placing, moving and unseating; the room's shape; emptying with an undo; a plan per group; the link from the roll call; given names after a family name and its particles; and every text in French and English. `accessibilityProblems` is empty |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, the made-up 4AM class's roll call of 11 October opened «ترتيب المقاعد».

- The setup read «القسم التجريبي · أول استعمال: شكل القاعة، ثم المقاعد» and «45 تلميذاً · لحصص القسم كله», with 36 empty seats.
- «ملء بترتيب القائمة» seated pupils 1, 3, 4 … 37 from the board, pupil 2 having left, and left 9 without a seat.
- A tap on pupil 1's seat, then on pupil 4's, swapped them.
- «إفراغ المقاعد» emptied every seat, and «تراجع» brought them back.

The emulator check led to three fixes:

- every seat is now the same width, measured from the screen;
- a seat that is filled loses the dashed edge, which Android otherwise kept;
- the buttons now sit above the list of pupils without a seat.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
