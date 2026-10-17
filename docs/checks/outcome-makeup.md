# Dated hints and the make-up mark (#33)

Checks of 17 October 2026 for the second pull request of [#33](https://github.com/djazairdev/minhajna/issues/33), on `feat/33-makeup`. It comes after «نتيجة أخرى» (#163). Made-up schools, classes and timetables only.

## What changed

- **The core says where what is left goes on** (`carryTo`, R-4.7-12):
  - the next session of the same class, group and subject in the same queue, never a TD, remediation, test or exam session, nor one the calendar takes;
  - the session of another kind it passes over, if any;
  - it looks eight weeks ahead.
- **The sheet's hints name that session by its day**, as on the Sheet and Sheet-nostage screens:
  - «ما بقي يُكمل في حصة الأحد 25/10 (تابع).»;
  - «يُكمل في حصة الإثنين 09/11 (تابع)، لا في فرض الأحد 08/11.»;
  - «حصة الأحد 11/10 للأعمال الموجهة» for a TD item.

  Without a later session, they keep «في الحصة القادمة».
- **An item without stages says how many sessions it has taken** (R-4.2-06): «حصتان حتى الآن.» when it goes on, «في حصتين.» when it is finished.
- **A session not held can be marked «تُعوَّض هذه الحصة»** (PRD §3.3, §7.7):
  - The mark is kept on the session's record, because a session owed a make-up is part of the lesson record. The reason stays private.
  - Only this mark, or the director's request, makes a session owed. The app never decides it.
  - The done card reads «لم تُعقد الحصة · تُعوَّض».
- **Nothing lost** (§6.8):
  - A reason is kept the moment its chip is chosen.
  - A typed reason is kept when the sheet closes, by «تمّ» or by closing it.
  - A note is written only when it changes.
- **Not here yet:**
  - the week's summary with «حصة تعويض مستحقة» (§3.9);
  - scheduling a make-up session (§7.7).

## Checks

| Check | Result |
|---|---|
| Core tests | 216 pass. The new ones cover the next session in the same queue, a test passed over, nothing after the year ends, and the make-up mark kept only when given and travelling with the record while the reason does not |
| Android tests | 661 pass. The new ones cover the dated hints and the sessions spent, the make-up mark and its done card, a reason kept as soon as it is chosen, and the hint's words in the three languages |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Monday 19 October, the made-up 4AM class's session proposed «تابع: فهم المنطوق 2 (مثال)». «نتيجة أخرى» read «ما بقي يُكمل في حصة الأحد 25/10 (تابع).» under the stages.

«لم تُعقد الحصة» recorded the session, and the step read «… فيُقترح الأحد 25/10.». «تُعوَّض هذه الحصة» was checked, with its note below. «تمّ» left the done card reading «لم تُعقد الحصة · تُعوَّض».

## Still to do by a person

- TalkBack in Arabic and text at 200%, with the reason step open, on a real phone.
