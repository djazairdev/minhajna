# Another outcome from Today (#32)

Checks of 17 October 2026 for the fourth pull request of [#32](https://github.com/djazairdev/minhajna/issues/32) and the first of [#33](https://github.com/djazairdev/minhajna/issues/33), on `feat/32-outcome`. It comes after Today (#162) and Codex's bottom sheet (#152). Made-up schools, classes and timetables only.

## What changed

- **«نتيجة أخرى» on the focus card** opens a bottom sheet, «كيف سارت الحصة؟», with the class, the time and the item. Every outcome is recorded on the second tap (R-2.3-08, R-3.3-07 to R-3.3-11). Closing the sheet before a choice records nothing (R-2.3-14).
- **A lesson with stages** offers its stages from the first one not yet covered, as chips: the last stage the session reached (R-4.7-11). Stages, not percentages. What is left goes on in the next session as «تابع».
- **An item without stages** asks whether it goes on («جارٍ») or is finished («انتهى», with the item proposed after it). It can also be merged with the next item.
- **The other outcomes:**
  - skipping the lesson;
  - teaching again the last item taught in the course, when there is one;
  - «لم تُعقد الحصة».
- **A reason for a skip or a session not held** is optional (R-3.3-12, R-4.5-17):
  - The skip or «لم تُعقد الحصة» is already recorded when the reason step opens, as on the Sheet-reason screen.
  - The choices are «دون سبب», the calendar's reasons, and «سبب آخر» with a short text of at most 60 characters.
  - «تمّ» keeps the reason in the session's private note, on the teacher's devices. It never goes into the session's record, and the core's test checks that no route out of the device carries it.
  - For a session not held, the sheet says that the progress statement counts it under «أخرى», without its reason.
  - Closing keeps the outcome with no reason. «نتيجة أخرى» goes back to the other outcomes, and choosing another one replaces it.
- **The snackbar says what was recorded.** «تراجع» brings back what was there before the sheet, the note included, even after a second choice in the same sheet.
- **The done card says what the session wrote:**
  - the items taught or taught again;
  - «تُرك: …» for a skipped lesson;
  - «لم تُعقد الحصة» for a session not held, as the screens say it (it read «لم تُنجز الحصة»).

  Before, a skipped session read «سُجّلت في دفتر النصوص» twice.
- **Not here yet, in #33's next pull request:**
  - the make-up mark «تُعوَّض هذه الحصة» for a session not held;
  - the dated hints, such as «يُكمل في حصة الإثنين 09/11 (تابع)»;
  - the sessions spent on an item without stages.
- **Later, in #32:**
  - «تفاصيل الحصة»;
  - choosing another item than the one proposed for a skipped session;
  - an extra session.

## Checks

| Check | Result |
|---|---|
| Android tests | 658 pass. The new ones cover each outcome as the core records it: stages, an item going on or finished, merged, skipped, taught again and not held. They also cover each outcome recorded on the second tap, the reason kept in the private note only, «تراجع» bringing back the note too, «نتيجة أخرى» going back and replacing the outcome, closing before a choice without recording, a skip closed with no reason, the done card of a skip and of a lesson taught again, and every control named and 48dp in the three languages and both directions |
| Core tests | 212 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, a made-up 4AM class had two sessions that day with the example pack. On the 08:00 session, «نتيجة أخرى» opened the sheet. The item had no stages, so it offered «جارٍ», «انتهى» with «فهم المنطوق 2 (مثال)» proposed next, merging, skipping and «لم تُعقد الحصة». There was no «أعاد» option, since nothing had been taught before.

- **«جارٍ»** recorded the session. The snackbar read «سُجّلت الحصة، ويُكمل الباقي في الحصة القادمة», and the 09:00 session proposed «تابع: الوضعية المشكلة الانطلاقية 2 (مثال)». «تراجع» brought the proposal back.
- **Skipping with «سبب آخر» and a short text** recorded the skip. The done card read «تُرك: الوضعية المشكلة الانطلاقية 2 (مثال)», and the 09:00 session proposed «فهم المنطوق 2 (مثال)» with its four stages.
- **On that session, the sheet offered the four stages as chips.** «بناء» recorded it with the rest to go on, and the day read «حصتان مؤكّدتان من حصتين اليوم».
- **On Monday 19 October**, the session proposed «تابع: فهم المنطوق 2 (مثال)» from «تطبيق». «لم تُعقد الحصة» recorded it on the second tap, and the reason step opened with «سُجّلت «لم تُعقد الحصة». ويبقى «فهم المنطوق 2 (مثال)» أول القائمة، فيُقترح في الحصة القادمة.». «عطلة» then «تمّ» closed it. «تراجع» brought the proposal back.

## Still to do by a person

- TalkBack in Arabic, and text at 200%, on a real phone, with the sheet open.
- Timing a session with another outcome against the target in R-3.1-02.
