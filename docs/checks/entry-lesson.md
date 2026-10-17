# Another lesson for a session (#34)

Checks of 17 October 2026 for the «تغيير الدرس» pull request of [#34](https://github.com/djazairdev/minhajna/issues/34), on `feat/34-lesson`. Made-up schools, classes and timetables only.

## What changed

- **«تغيير الدرس» beside the texts book row** opens «درس آخر لهذه الحصة» (Entry-lesson), a sheet naming the class, the time and the proposed item.
- **The plan around the class's position**: the three items before it, with the day each was taught, and five from it, with the day the class would reach each one if nothing changes. The proposed item is marked «المقترح اليوم», the one after it «التالي».
- **A search** over the class's plan, by title or field.
- **Another item** is written in the book instead of the proposal, with the core's `changed` outcome (#165). The proposed item stays first in its queue and is proposed again next time.
- **An item taught before** is taught again, as `retaught`.
- **Content from outside the plan** («محتوى من خارج المخطط») is written as is, and «تأكيد الحصة» waits for its words. No plan item moves.
- The stages covered are shown only for the proposed item.
- **Not here yet:** «تصحيح الحصة» for a recorded session, in #34's next pull request.

## Checks

| Check | Result |
|---|---|
| Android tests | 669 pass. The new ones cover the plan around the class with its days, the search, another item written instead with the proposed one still first, an item taught again, content from outside the plan needing its words, and every control named and 48dp |
| Core tests | 220 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 25 October, «تفاصيل الحصة» on the made-up 4AM class's 09:00 session, then «تغيير الدرس», opened the sheet with «القسم التجريبي4AM3 · 09:00 – 10:00 · المقترح: فهم المنطوق 2 (مثال)».

- Under «المخطط الرئيسي، حول موقع القسم»: «الوضعية الإدماجية 1 (مثال)», «تقويم ومعالجة 1 (مثال)», and «الوضعية المشكلة الانطلاقية 2 (مثال)» with «دُرّس الأحد 18/10».
- Under «موقع القسم»: «فهم المنطوق 2 (مثال)» checked as «المقترح اليوم», then «فهم المكتوب 2 (مثال)» with «التالي · الإثنين 26/10», «الظاهرة اللغوية 2 (مثال)» with «الإثنين 02/11», and the next two with «الأحد 08/11», skipping the autumn holiday.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
