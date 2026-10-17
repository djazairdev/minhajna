# A class's plan, item by item (#37)

Checks of 17 October 2026 for the class plan pull request of [#37](https://github.com/djazairdev/minhajna/issues/37), on `feat/37-screen`. Made-up schools, classes and timetables only.

## What changed

- **«المخطط» on each card of the Classes tab** opens the class's plan.
- **Where the class stands**, buffers first, as on the card, then «حتى اختبارات الفصل الأول (06/12): 15 حصة للدرس، ويحتاج منها المخطط 17 حصة.»: the sessions left before the next exams and what the plan still needs by then (R-4.7-22).
- **Each unit's items** (the core's `planView`, #174), with:
  - the days an item was taught, or the day the plan would reach it if nothing changes, in a lighter colour;
  - «انتهى», «تُرك», «جارٍ», or «جارٍ · 3 من 4 مراحل» for the stages covered;
  - «الموقع» where the class is: the item the plan goes on with after its last recorded session;
  - «موقع المخطط» where the plan says the class should be, with the note that it is only a reference, never moves the class and is never a judgement of the work (R-4.7-10, R-3.1-15);
  - «احتياط» on the plan's buffers.
- **TD items** follow in their own list, «الأعمال الموجهة».
- **A class with no pack** is not compared.
- Each row is read by TalkBack as one sentence: the title, the days and every tag.
- **Not here:** the Class page's other rows (the roll call, the texts book, homework, marks), the pack's release and changes, and the unit chips of the Plan screen, which come with their own issues.

## Checks

| Check | Result |
|---|---|
| Android tests | 710 pass. The new ones cover where the class stands with the sessions left before the exams; each item with its days, status, position and the plan's place; a class with no pack; the «المخطط» button on the Classes tab; and every row named in Arabic, French and English, right to left and left to right |
| Core tests | 235 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 25 October, «المخطط» on the made-up 4AM class opened «القسم التجريبي4AM3 · اللغة العربية», «استُعملت حصتان من الاحتياط، ولم يبقَ منه شيء», «حتى اختبارات الفصل الأول (06/12): 15 حصة للدرس، ويحتاج منها المخطط 17 حصة.», and the reference note. Under «المقطع 2 (مثال)»: «الوضعية المشكلة الانطلاقية 2 (مثال)» with «تُرك»; «فهم المنطوق 2 (مثال)», taught 18/10 to 25/10, with «جارٍ · 3 من 4 مراحل» and «الموقع»; then 26/10, 08/11, 08/11, 09/11 and 15/11 for the items ahead, the last with «احتياط». The class's first unit was never recorded on this emulator, so its items carry no day, and «موقع المخطط» stood on «فهم المكتوب 1 (مثال)».

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
