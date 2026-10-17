# The session's details (#34)

Checks of 17 October 2026 for the «تفاصيل الحصة» pull request of [#34](https://github.com/djazairdev/minhajna/issues/34), on `feat/34-entry`. Made-up schools, classes and timetables only.

## What changed

- **«تفاصيل الحصة» on Today's focus card** opens the session's entry (Entry screen). Its first line names the class, the day and the time, from the timetable and the bell times, never from when the teacher tapped (R-3.3-25).
- **The row the texts book will take** (R-3.8-14, the row only):
  - the date as the book writes it, and the time;
  - the unit, the item, the stages covered;
  - content from outside the plan, a test, the homework with its due day, and the factual line.

  It is the core's own confirmation, worked out without recording, so it shows exactly what «تأكيد الحصة» writes, and it follows every change.
- **The session's type**, from the profile's eight (R-3.3-15). Choosing a type of another queue, such as a test, changes what the session takes from the plan.
- **The stages covered**, as checkboxes from the first stage not yet covered. Unchecking one leaves it and the ones after it to go on next time.
- **Content from outside the plan**, behind «إضافة محتوى من خارج المخطط» (R-2.3-10, R-3.3-21, R-4.7-16). It is written as is, and no plan item moves.
- **Homework and its due day** (R-3.3-19). The days the class next has this subject over four weeks are offered, skipping holidays, the first chosen. «تاريخ آخر» shows the rest.
- **A test given** (R-3.3-20). It is kept as the profile's `test` session type, so documents name it in their own language.
- **A factual line**, optional, for the book and shared statements (R-3.3-22).
- **A private note** (R-3.3-23, R-6.5-02). It stays on the teacher's devices, with the warning against pupils' health or discipline details (R-3.3-24).
- **«تأكيد الحصة» records it all in one step** and goes back to Today. Nothing is recorded before.
- **Not here yet, in #34's next pull requests:**
  - «تغيير الدرس», with «درس آخر لهذه الحصة» (the core's `changed` outcome is #165);
  - «تصحيح الحصة» for a recorded session. Until then, the entry says that a recorded session is corrected on its own page.
- **Later:** «تغيير هذه الحصة لهذا اليوم وحده» (a one-day timetable change), and the book's page number.

## Checks

| Check | Result |
|---|---|
| Android tests | 665 pass. The new ones cover the book row and nothing recorded before «تأكيد الحصة»; the details recorded in one step, with the private note in the note only and on no outbound route; the stages covered; a test session taking no lesson; a recorded session not entered again; and every control named and 48dp in Arabic right to left and English left to right |
| Core tests | 216 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 25 October, the made-up 4AM class's focus card had «نتيجة أخرى» and «تفاصيل الحصة». The entry read «القسم التجريبي4AM3 · الأحد 25/10/2026 · 08:00 – 09:00». The book row read «2026/10/25», «المقطع: المقطع 2 (مثال)», «تابع: فهم المنطوق 2 (مثال)», «- تطبيق», «- تقويم».

- Unchecking «تقويم» took its line out of the row.
- Typing homework offered «الإثنين 26/10», «الإثنين 02/11», «الأحد 08/11» and «تاريخ آخر», skipping the autumn holiday and 1 November. The row gained the homework with its due day.
- «تأكيد الحصة» went back to Today, with the session done and the 09:00 session proposing «تابع: فهم المنطوق 2 (مثال)» from «تقويم».

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
