# Holidays and exam weeks on Today (#36)

Checks of 17 October 2026 for the Today-holiday and Today-exams pull request of [#36](https://github.com/djazairdev/minhajna/issues/36), on `feat/36-today`. Made-up schools, classes and timetables only; the calendar is the bundled 2026-2027 one.

## What changed

- **A holiday, a closure or an exam window marks the day** with its name in chalk on the board (R-3.3-05, holidays and exam weeks only). Under it: «عطلة وطنية، لا حصص اليوم.» for a national holiday, «عطلة، لا حصص اليوم.» for another, «توقّف الدراسة، لا حصص اليوم.» for a closure, and the exam window's dates with «اليوم 2 من 5».
- **The sessions the calendar took** are no longer listed one by one. They are counted apart, «3 حصص لم تُعقد بسبب الرزنامة», with the note that the weekly summary counts them separately, so they never read as slow teaching, and that the lessons move to the next sessions (R-3.9-03, R-4.5-06, R-4.7-20). The day's facts then leave them out.
- **In an exam week**, «المخطط متوقف أثناء الاختبارات»: no lesson is proposed, no session counts as not held or as delay, and each class keeps its position. No count of lost sessions is shown.
- **The next session the calendar leaves to teach**, «الحصة القادمة», when the day has none (the core's `nextSession`, #171). The following lessons go on from what was taught (R-2.3-12): the engine already moves them past the calendar.
- **Exam windows for some grades only** now mark the day of a class they cover (#171): every exam window in the Algerian calendar is limited to grades.
- **Not here:** the exam timetable, invigilation and «إدخال النقاط» on Today-exams, which need the teacher's own entries and the marks; seminars, councils and cover (choice F4).

## Checks

| Check | Result |
|---|---|
| Android tests | 692 pass. The new ones cover a holiday with its name, the sessions it took counted apart and the next session; an exam week pausing the plan with no count of lost sessions; a holiday week with no session; an ordinary day with no mark; and every part named and 48dp in Arabic, French and English, right to left and left to right |
| Core tests | 229 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, with the made-up 4AM class drawn on Sunday and Monday:

- **Thursday 29 October:** «عطلة الخريف», «عطلة وطنية، لا حصص اليوم.», and «الحصة القادمة» «القسم التجريبي4AM3 · 08:00 – 09:00 · الإثنين 2 نوفمبر», since the holiday runs to Sunday 1 November.
- **Sunday 1 November:** the same banner, «حصتان لم تُعقدا بسبب الرزنامة» with its note, and the same next session. The fact line gave only the earlier sessions awaiting confirmation.
- **Monday 7 December:** «اختبارات الفصل الأول», «6 ديسمبر – 10 ديسمبر · اليوم 2 من 5», «المخطط متوقف أثناء الاختبارات», and the next session on «الأحد 13 ديسمبر».

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
