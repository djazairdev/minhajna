# Correcting a pupil's roll call, and the counting rules (#39)

Checks of 17 October 2026 for the screens pull request of [#39](https://github.com/djazairdev/minhajna/issues/39), on `feat/39-correct`, built on the core's `correctPupil`, `previewCorrection` and `counting.set` (#180). Made-up schools, classes and pupils only.

## What changed

- **A pupil's name opens «تصحيح المناداة»** on a roll call already taken, when no change is pending there. `RollCallRow` takes an optional name button for this, 48dp tall, spoken as «تصحيح مناداة …».
- **The Correct screen** shows:
  - the pupil, the class and the year;
  - the session's day and time, and what was recorded: «المسجّل: تأخر، لا يُحسب غياباً · سُجّل في 18/10/2026»;
  - «يصبح», with four choices: «حضور», «تأخر، لا يُحسب غياباً», «غياب مبرر» and «غياب غير مبرر». The one recorded reads «…، كما سُجّل». The note says only whether an absence is justified is recorded, never its cause (R-3.4-10);
  - the four coded reasons (R-5.5-03);
  - «يُضاف إلى سجل التعديلات», with the line it adds and the month's totals before and after. For example, «أكتوبر: غ 0 ← 1 · النسبة 100% ← 0% · ويُحذف التأخر بتاريخه» (R-3.4-18);
  - «تبقى النسختان في السجل، بالتاريخ دون ساعة» (R-5.5-02, R-5.5-05).
- **«حفظ التصحيح»** stays disabled until the mark changes and a reason is chosen. The roll call behind it then shows the new version.
- **«قواعد العدّ»** (`Roll-rules`) opens from the roll call and from the correction's month totals. It shows:
  - the day counting starts: the year's first day, «الدخول المدرسي», or the start of a later week;
  - two checkboxes, for whether training days and seminars, and sessions not held, count in possible attendance;
  - holidays and one-shift days, stated, since the core does not make them settings;
  - the unit for the teacher's classes: the session in CEM and lycée, the half-day in primary.

  Each change is recorded at once, and «استرجاع القيم الأولى» restores the defaults (R-3.4-19, R-3.4-22).
- **Not here:** the Pupil and Month screens, which open Correct too, and a Switch control, which the rules will use once #137 brings it.

## Checks

| Check | Result |
|---|---|
| Android tests | 752 pass. The new ones are in `__tests__/correct.test.tsx` and `__tests__/roll-rules.test.tsx`. They cover: the names opening the correction only on a roll call taken with nothing pending; what was recorded; the save needing a change and a reason; the log line and the month's totals; a new version with its reason; an absence justified; lateness turned into an absence; the roll call following the correction; the start days; the defaults and the rules stated; each change recorded and the defaults restored; the links from the roll call and the correction; and every text in French and English. `accessibilityProblems` is empty |
| Core tests | 243 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, the made-up 4AM class's roll call of that morning was already taken.

- The names were buttons. Pupil 2's opened the correction with «المسجّل: تأخر، لا يُحسب غياباً · سُجّل في 18/10/2026».
- Choosing «غياب غير مبرر» and «خطأ في التسجيل» showed the log line and «أكتوبر: غ 0 ← 1 · النسبة 100% ← 0% · ويُحذف التأخر بتاريخه».
- Saving went back to the roll call, which then read 44, 1 and 1 with pupil 2 absent.
- «قواعد العدّ» showed the defaults and «وحدة العدّ: الحصة».
- Ticking the seminars and choosing «الأحد 4 أكتوبر 2026» as the start were recorded at once. «استرجاع القيم الأولى» brought back 21 September and the empty checkboxes.

The emulator check led to three fixes:

- the percentages and the pupil's line are now kept in their own direction;
- the restore button is disabled once the defaults are back.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
