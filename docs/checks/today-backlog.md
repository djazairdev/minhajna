# Confirming past days at once (#35)

Checks of 17 October 2026 for the Today-backlog pull request of [#35](https://github.com/djazairdev/minhajna/issues/35), on `feat/35-backlog`. Made-up schools, classes and timetables only.

## What changed

- **Earlier sessions still awaiting confirmation** come first on Today, in one card, a week at a time, the earliest first, by day (R-3.9-07). Each row gives the time, the class and the lesson that would be written. The list is on the screen only: it is never printed, exported or totalled.
- **Every session with a proposal is checked.** One button, «تأكيد 3 حصص كما هو مقترح», confirms them at once (R-2.3-09, R-3.3-14). Nothing is recorded before it (R-2.6-02), and «تراجع» takes the whole batch back.
- **A tap leaves a session out.** It stays awaiting, and offers «نتيجة أخرى» and «تفاصيل الحصة». Both record it with the day it was taught, as for a session kept on paper and entered later (R-5.5-12).
- **A session with no proposal**, such as a class with no pack, is left out already, with «تفاصيل الحصة» only.
- **Once a week is confirmed, the next one shows.** «ثم يظهر الأسبوع الذي يليه» says when later weeks wait too.
- Each session is confirmed with the proposal shown, as if the earlier ones went as planned (the core's `backlogOf`, #168).
- **Not here:** «إدخال مناداة من الورقة», which opens Roll-past, comes with the roll call.

## Checks

| Check | Result |
|---|---|
| Android tests | 682 pass. The new ones cover the earlier week by day with every session checked and nothing recorded; the rest confirmed at once with the one left out kept and the undo; a session left out opening «نتيجة أخرى» and its details with its own day; later weeks; and every control named and 48dp in Arabic, French and English, right to left and left to right |
| Core tests | 225 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 25 October, the made-up 4AM class had 10 earlier sessions awaiting confirmation. The card showed «الإثنين 21 سبتمبر 2026» with one session checked, «تأكيد حصة واحدة كما هو مقترح», and «ثم يظهر الأسبوع الذي يليه».

- Tapping the session unchecked it. «نتيجة أخرى» and «تفاصيل الحصة» appeared, and the button read «لا حصة مختارة للتأكيد», disabled.
- «تفاصيل الحصة» opened the entry for «الإثنين 21/09/2026 · 08:00 – 09:00». «نتيجة أخرى» opened «كيف سارت الحصة؟» for it.
- Checking it again and confirming showed «سُجّلت حصة في دفتر النصوص». The next week followed: «الأحد 27 سبتمبر 2026» with two sessions and «الإثنين 28 سبتمبر 2026» with one, and the fact read 9 sessions.
- «تراجع» brought back 21 September and the count of 10.

A session confirmed late, after later ones were recorded, takes the proposal the plan gives it at its place, as if the earlier ones went as planned. The row shows that lesson before it is confirmed, and a tap leaves it out.

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
