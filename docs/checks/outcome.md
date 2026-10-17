# Another outcome from Today (#32)

Checks of 17 October 2026 for the fourth pull request of [#32](https://github.com/djazairdev/minhajna/issues/32), on `feat/32-outcome`. It comes after Today (#162) and Codex's bottom sheet (#152). Made-up schools, classes and timetables only.

## What changed

- **«نتيجة أخرى» on the focus card** opens a bottom sheet, «كيف سارت الحصة؟», with the class, the time and the item. Nothing is recorded until a choice is made, and closing the sheet chooses nothing (R-2.3-14).
- **A lesson with stages** offers its stages from the first one not yet covered, as chips: the last stage the session reached (R-4.7-11). Stages, not percentages. What is left goes on in the next session as «تابع».
- **An item without stages** asks whether it goes on («جارٍ») or is finished («انتهى», with the item proposed after it). It can also be merged with the next item.
- **The other outcomes:**
  - skipping the lesson;
  - teaching again the last item taught in the course, when there is one;
  - «لم تُعقد الحصة».
- **A reason for a skip or a session not held** is optional:
  - The choices are «دون سبب», the calendar's reasons, and «سبب آخر» with a short text of at most 60 characters.
  - The reason stays in the private note on the teacher's devices. It never goes into the session's record.
  - For a session not held, the sheet says that the progress statement counts it under «أخرى», without its reason.
  - «نتيجة أخرى» goes back to the other outcomes, and «تمّ» records the choice.
- **The snackbar says what was recorded**, and «تراجع» still undoes it.
- **The done card says what the session wrote:**
  - the items taught or taught again;
  - «تُرك: …» for a skipped lesson;
  - «لم تُنجز الحصة» for a session not held.

  Before, a skipped session read «سُجّلت في دفتر النصوص» twice.
- **Not here yet:**
  - «تفاصيل الحصة»;
  - choosing another item than the one proposed for a skipped session;
  - an extra session.

## Checks

| Check | Result |
|---|---|
| Android tests | 657 pass. The new ones cover each outcome as the core records it: stages, an item going on or finished, merged, skipped, taught again and not held. They also cover the reason kept in the private note only, «نتيجة أخرى» going back, closing without recording, the done card of a skip and of a lesson taught again, and every control named and 48dp in the three languages and both directions |
| Core tests | 212 pass |
| Type check, ESLint, Prettier | Pass |
| Android 15 emulator, release build | Pass, as described below |

On the emulator, set to Sunday 18 October, a made-up 4AM class had two sessions that day with the example pack. On the 08:00 session, «نتيجة أخرى» opened the sheet. The item had no stages, so it offered «جارٍ», «انتهى» with «فهم المنطوق 2 (مثال)» proposed next, merging, skipping and «لم تُعقد الحصة». There was no «أعاد» option, since nothing had been taught before.

- **«جارٍ»** recorded the session. The snackbar read «سُجّلت الحصة، ويُكمل الباقي في الحصة القادمة», and the 09:00 session proposed «تابع: الوضعية المشكلة الانطلاقية 2 (مثال)». «تراجع» brought the proposal back.
- **Skipping with «سبب آخر» and a short text** recorded the skip. The done card read «تُرك: الوضعية المشكلة الانطلاقية 2 (مثال)», and the 09:00 session proposed «فهم المنطوق 2 (مثال)» with its four stages.
- **On that session, the sheet offered the four stages as chips.** «بناء» recorded it with the rest to go on, and the day read «حصتان مؤكّدتان من حصتين اليوم».

## Still to do by a person

- TalkBack in Arabic, and text at 200%, on a real phone, with the sheet open.
- Timing a session with another outcome against the target in R-3.1-02.
