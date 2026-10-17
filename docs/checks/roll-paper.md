# Entering a roll call from the paper sheet (#38)

Checks of 17 October 2026 for the second roll-call pull request of [#38](https://github.com/djazairdev/minhajna/issues/38), on `feat/38-paper`. Made-up schools, classes and pupils only.

## What changed

- **«إدخال مناداة من الورقة»** sits in Today's backlog card, under its hints, with «لحصة سابقة، وتُسجَّل بتاريخ تلك الحصة», as Today-backlog draws it (R-3.4-17).
- **Its sheet** lists the earlier sessions whose roll call is not recorded, from the backlog's week to yesterday, in order. Each row gives the day, the time and the class.
- **A row opens Roll-past** (#178), which records the roll call on the session's own date.
- **Left out of the sheet:** a roll call already recorded, a session recorded as not held, and a class with no list yet. When nothing is left, the sheet says so.
- **No strip on Today** for a class with no list yet, since it has no one to call.
- **Not here:** Month's day headers, which open Roll-past too, come with the Month screen.

## Checks

| Check | Result |
|---|---|
| Android tests | 738 pass. The new ones, in `__tests__/paper-rolls.test.tsx`, cover: the sessions listed in order and the one chosen opened; a roll call already recorded, a session not held and a class with no list left out; the sheet with nothing left; and the texts in French and English. `accessibilityProblems` is empty |
| Core tests | 236 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, the backlog card showed «إدخال مناداة من الورقة» under its hints.

- Its sheet listed the made-up 4AM class's earlier sessions from «الإثنين 21 سبتمبر · 08:00 – 09:00» on, day by day.
- «الإثنين 28 سبتمبر» opened the roll call with «من ورقة المناداة الورقية», «تُسجَّل الغيابات بتاريخ الحصة، 28/09/2026، لا بتاريخ اليوم. ويحفظ السجل يوم إدخالها، 18/10/2026، دون ساعة.» and «حفظ مناداة 28 سبتمبر».
- Saving one absence went back to Today. Reopened, the sheet no longer listed 28 September.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
