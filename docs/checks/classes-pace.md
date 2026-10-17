# Each class against the plan (#37)

Checks of 17 October 2026 for the Classes tab pull request of [#37](https://github.com/djazairdev/minhajna/issues/37), on `feat/37-pace`. Made-up schools, classes, pupils and timetables only.

## What changed

- **The Classes tab** lists one card per class and subject, by class name. The heading names the subjects, the schools and the pupils («اللغة العربية · متوسطة النجاح · 105 تلاميذ»).
- **Each card** gives the class, its pupils on the roll today, its first session today («اليوم 08:00»), and where it stands against the plan, in sessions:
  - **Buffers first** (R-4.7-21): while the buffers left before the next exams absorb a delay, it reads «استُعملت حصتان من الاحتياط، وتبقى حصة واحدة», never as delay.
  - **Beyond the buffers:** «حصتان خلف المخطط، بعد الاحتياط كله».
  - **Otherwise, the spare time** (R-4.7-22): «لا تأخر · 6 حصص احتياطية», the sessions left before the next exams minus what the plan still needs by then. When the plan needs more than is left, it says so as a fact.
  - **A class with no pack** is not compared: «دون حزمة: لا مقارنة بالمخطط».
- A session still awaiting confirmation never reads as a delay. Progress is the class's, for its subject and year (R-2.3-16), and the words state facts (R-3.1-15).
- The core's `pace` now gives `bufferLeft`, the buffers still left once those used are taken off.
- The navigation preview's button stays on the Documents tab.
- **Not here:** the Class page with the progress by item and stage and where the plan says the class should be (R-4.7-10), and the TD line, in #37's next pull request. The year switch, the weekly digest, the attendance and the roll call and texts book buttons come with their own issues.

## Checks

| Check | Result |
|---|---|
| Android tests | 701 pass. The new ones cover one card per class with its pupils, its first session today and its line; a class with no pack; buffers used, then all used, with sessions awaiting confirmation adding no delay; the spare sessions, none spare, and the delay beyond the buffers; and every part named in Arabic, French and English, right to left and left to right |
| Core tests | 230 pass, with the buffers left on the plan, once one is used, and once all are |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 25 October, the Classes tab read «الأقسام», «اللغة العربية · CEM · 45 تلميذاً», and one card: «القسم التجريبي4AM3», «45 تلميذاً», «اليوم 08:00», «استُعملت حصتان من الاحتياط، ولم يبقَ منه شيء».

## Still to do by a person

- TalkBack in Arabic and text at 200%, on a real phone.
