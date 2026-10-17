# Correcting a recorded session (#34)

Checks of 17 October 2026 for the «تصحيح الحصة» pull request of [#34](https://github.com/djazairdev/minhajna/issues/34), on `feat/34-fix`. Made-up schools, classes and timetables only.

## What changed

- **«تصحيح» on a done card** on Today opens the recorded session as «تصحيح الحصة» (Entry-fix), with the promise that the first version stays in the record, and the texts book row as it was recorded.
- **The same form, from what was recorded**: the lesson, the session's type, the stages, content from outside the plan, the homework and its due day, a test, the factual line and the private note. The stages are counted from the position the class had before the session (the core's `proposalAt`).
- **A correction keeps both versions** (PRD §3.1, rule 4). It gives a new outcome only when the lesson or the stages change, so the outcome already recorded stays otherwise. A detail cleared is taken out of the new version (`Details` fields can be `null` in a correction).
- **A coded reason**, optional: «أُضيف بعد التأكيد», «خطأ في الإدخال» or «سبب آخر». Only the code shows with the correction. The words of «سبب آخر» stay in the private note, on no outbound route.
- **What the activity log will add**: each change as «كان …، أصبح …», dated by day, never by hour (PRD §5.5).
- **The reminder** to correct the paper book too, and sign it, if the session was copied there.
- «حفظ التصحيح» waits until something changes.
- **Later:** «تغيير هذه الحصة لهذا اليوم وحده» (a one-day timetable change), and the book's page number.

## Checks

| Check | Result |
|---|---|
| Android tests | 672 pass. The new ones cover the form opening from what was recorded with nothing saved before a change, the homework taken out with both versions kept and the change shown by day, and the stages changed with the words of «سبب آخر» in the private note only and on no outbound route |
| Core tests | 222 pass, including a correction's proposal and a detail taken out |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 25 October, the made-up 4AM class's 08:00 session was recorded with homework. «تصحيح» on its done card opened «تصحيح: تبقى الصيغة الأولى في السجل» with the row as recorded.

- Clearing the homework showed «الواجب المنزلي: كان …، يُسلَّم الإثنين 26/10، أصبح لا شيء» and «يُضاف يوم 25/10/2026، دون ساعة.».
- Choosing «خطأ في الإدخال» and «حفظ التصحيح» went back to Today, with the session still done on «فهم المنطوق 2 (مثال)».

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
