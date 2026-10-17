# Taking the roll on the seating plan (#41)

Checks of 18 October 2026 for the last pull request of [#41](https://github.com/djazairdev/minhajna/issues/41), on `feat/41-roll-seats`, built on the plan's setup (#187). Made-up schools, classes and pupils only.

## What changed

- **«القائمة» or «مخطط الجلوس»:** the roll call opens on the plan when its class or group has one, and on the list otherwise. «مخطط الجلوس» without a plan opens «ترتيب المقاعد».
- **A tap on a seat** marks an absence, a second a lateness, a third the pupil present again, as «لمسة على المقعد: غياب. الثانية: تأخر. الثالثة: حضور من جديد.» says. The figures follow. The list and the plan share the same marks, and «حفظ المناداة» records the same roll call from either (R-3.4-13).
- **The seat's look:**
  - an absent pupil's seat is board-coloured with «غ»;
  - a late pupil's seat is highlighted with «ت»;
  - TalkBack reads the row, the seat, the number, the full name and «حضور», «غياب» or «تأخر».
- **Pupils without a seat,** such as one who joined after the plan was made, are listed under the plan as rows of the list.
- **The private note** closes the plan: it stays on the teacher's devices.
- Roll's head moved to `RollHead.tsx`, to keep the screen under 300 lines.
- **Not here:** the plan printed on one A4 page, after the Arabic PDF check (#44).

## Checks

| Check | Result |
|---|---|
| Android tests | 972 pass. The new ones are in `__tests__/roll-seats.test.tsx`. They cover: the list until a plan exists, and the setup opened from the plan's tab; a seat cycling through absent, late and present; the same marks on the list and in the record; and pupils without a seat marked on their rows. `accessibilityProblems` is empty |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, the made-up 4AM class's roll call of 11 October opened from «إدخال مناداة من الورقة», with the plan made in #187.

- It opened on «مخطط الجلوس», with 45 present.
- One tap on pupil 3's seat turned it board-coloured with «غ», and the figures read 44 and 1.
- Two taps on pupil 31's seat highlighted it with «ت».
- The 9 pupils without a seat were listed below.
- «حفظ مناداة 11 أكتوبر» recorded it, and 11 October left the paper list.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
- The timing against paper with 40 or more pupils (R-3.1-03).
