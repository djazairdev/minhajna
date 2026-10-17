# Ready and the September check (#31)

Checks of 17 October 2026 for [#31](https://github.com/djazairdev/minhajna/issues/31), on `feat/31-ready`, after the plan step (#154) and the core's TD count (#155). Made-up schools, classes and timetables only.

## What changed

- **Setup-7-Ready.** «إنهاء الإعداد» on the plan step now opens it. It has no step bar. The hero reads «كل شيء جاهز» in the smaller title size, then «ويمكن تعديل أي شيء لاحقاً من الإعدادات.».
- **What setup kept** is listed with ticks:
  - the classes and pupils, such as «3 أقسام · 47 تلميذاً»;
  - the week's hours at each school;
  - for each grade and subject, whether the plan is pinned for every class, for some, or for none (the items are then typed);
  - the national calendar.
- **The September check** (R-2.3-02, R-4.2-07, R-4.7-23, R-4.11-06) has one card for each grade and subject that has a class with a pinned pack. The card is titled before the term's exams, such as «فحص سبتمبر، قبل اختبارات الفصل الأول (6 ديسمبر 2026، تاريخ تقديري)». A date that is not yet announced says so. Without an exam window, the term's end is used.
  - A table gives, for each class, the plan's sessions the timetable and the calendar give, those the plan needs, then the TD sessions and items, counted apart. TalkBack reads each class as one line.
  - Under the table, each class's gap is a fact: «13 حصة للاحتياط», «ينقص 7 حصص عن حاجة المخطط», or no spare.
  - When there are spare sessions, the card says they are for remediation and the unexpected, not free time. When TD is taught, it says that TD adds neither to the plan's sessions nor to its spare ones.
- **Counted from the year's first day.** A session still awaiting confirmation stays among those the year gives, so setting up in October never reads the weeks before as lost (PRD §2.3, rule 5).
- **No pack yet.** When no class has a pinned pack, the card says there is nothing to check yet.
- **The next session** shows the class, the slot's time from the bell times (#151), the day and what the plan proposes. Without a pack, it says that what was done is typed.
- **«إلى صفحة اليوم»** opens the tabs, with nothing to go back to.
- **Not here:**
  - the printed check for an inspector, with PDF and QR, which is #44;
  - where a class starts in its plan.
- **Other changes:**
  - a tick icon from the canvas;
  - the welcome hero's title now spans the hero, as Android measured «كل شيء جاهز» narrower than it drew it and clipped «جاهز»;
  - the setup steps' stack screens moved to `SetupScreens.tsx`, to keep the navigator under 300 lines.

## Checks

| Check | Result |
|---|---|
| Android tests | 593 pass, 8 of them new. They cover what setup kept; the check with one class short and one with spare sessions, and TD apart; the next session's time and proposal; no pack pinned; and every control named and 48dp in the three languages and both directions. The welcome test now walks through Ready |
| Core tests | 210 pass, after #155 |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, «إنهاء الإعداد» opened Ready, with «كل شيء جاهز» in full and five ticks. The classes and pupils read «3 أقسام · 47 تلميذاً», and the week «7 ساعات في الأسبوع، في CEM El Nadjah، CEM El Amel».

The check was titled before the term-1 exams of 6 December 2026, marked as an expected date. 4AM3 had 31 sessions given and 18 needed, with «13 حصة للاحتياط». 4AM1 had 11 and 18, with «ينقص 7 حصص عن حاجة المخطط». The header and body columns lined up.

The next session was 4AM3, 08:00 – 09:00, on Sunday 18 October, with «الإنتاج الكتابي 1 (مثال)» proposed. «إلى صفحة اليوم» opened the tabs.

## Still to do by a person

- TalkBack in Arabic on Ready, with the other setup screens (see the BrowserStack note on #20).
- Timing a first setup against the 10-minute target, on a real phone.
