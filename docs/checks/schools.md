# Two schools in one week

Checks of 22 October 2026 for [#232](https://github.com/djazairdev/minhajna/issues/232), from [#373](https://github.com/djazairdev/minhajna/pull/373) to [#377](https://github.com/djazairdev/minhajna/pull/377), answers 394 to 401. Made-up schools, classes and pupils only.

## What changed

- **Today by school** (answers 394 to 396, [PS-Today](../design/screens/PS-Today.png)):
  - On a day taught in two schools or more, Today groups its cards under one band per school and half-day, «مدرسة الفتح · الصبيحة».
  - A holiday, closure or exam window of one school marks only that school's cards, in its band, with the entry's name. The note on sessions lost to the calendar counts a holiday's or a closure's; an exam window's pause the plan instead, as below.
  - An exam window pauses the plan only for the classes it takes: «المخطط متوقف أثناء اختبارات …». The teacher's other classes carry on.
- **The Classes tab by school** (answers 397 and 398, [PS-Classes](../design/screens/PS-Classes.png)):
  - One section per school, with its classes and their count. An archived class is not counted.
  - A merged-week card, «استعمال الزمن: …», says the week joins every school's sessions on this phone. It counts only the clashes still open and opens the week.
  - A primary specialist, in one school or more, sees a note above the classes: only the teacher's own sessions count, with a roll call each session, and the half-day roll call stays with the class teacher.
  - A class's roll-call kind follows its own setting first, then the kind already on record, then the specialist rule, then the level. A roll call on record never changes kind.
- **The free-entry card** (answer 399):
  - A lesson, integration or TD session with no pack, a stale plan or a missing pack version shows «حصة اليوم، كتابة حرة» in place of a proposal. A joint class's session never does.
  - What the teacher writes is recorded as the session's text, as written in the texts book. «تأكيد اليوم كله كما هو مقترح» leaves these cards out.
- **A clash between two schools** (answers 400 and 401, [Week-slot](../design/screens/Week-slot.png), [Setup-5d-Two-schools](../design/screens/Setup-5d-Two-schools.png)):
  - Week-slot shows a two-school clash's two sessions, each with its class and school. The slot's editors are hidden, so the clash's slot edits nothing else.
  - «الإبقاء على الاثنين» keeps the clash against the recorded week. Once kept, the week no longer counts it open. «إعادة فتح التعارض» opens it again.
  - «تغيير يوم واحد» moves one session, on one of the next days that slot is taught, to a free time of its school with a bell time, «مدرسة الرياض · 15:15». It is never a change to the drawn week.
  - Each move from today on is listed with «إلغاء النقل». Once its session is recorded the move stays: «سُجّلت الحصة: يبقى النقل.»
  - Today shows both sessions of a clash, kept or not, so the teacher confirms the one held. It says which sessions meet, «يتزامن مع …», and that a moved session moved, «نُقلت من … لهذا اليوم».
  - Joint classes' cards do not show these lines yet: an accepted gap (answer 401).

No permission or network call changes. The record gains four events: `clash.kept`, `clash.reopened`, `move.set` and `move.removed`.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `roll-call.test.ts` and `session-moves.test.ts`: the roll-call kind on record, the specialist rule, keeping and reopening a clash, moves for every level of a joint class and a rotating group's turn, and the refusals of a past day, the same time, no session, a session moved already, a busy time and a recorded session |
| Android tests | `today-schools`, `classes-schools`, `classes-tab`, `today-free` and `week-clash`. Also `schools-scale.test.tsx`: Today's bands and same-time lines, the Classes tab by school with its merged-week card and register note, and the clash panel with a day chosen to move a session, in Arabic and English at 100% and 200%. Every control is named and every text is free to grow and wrap |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Colour | Checked by reading the code: nothing new relies on colour alone. A kept clash, a move and a paused plan are all said in text |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - Today's school bands and the partial or paused notes;
  - the Classes tab's school sections, the merged-week card and the register note;
  - the free-entry field, its label and its error;
  - the clash panel: both sessions, «الإبقاء على الاثنين», the day and time chips, «حفظ النقل» and «إلغاء النقل»;
  - Today's «يتزامن مع» and «نُقلت من» lines.
- **On a phone:**
  - right to left and left to right, with text at 200%, on Android 8 at 360×800;
  - the bands, the clash panel and the free-entry card wrap without clipping, with touch targets of at least 48 dp;
  - on a budget phone, the time to open Today and the Classes tab for a teacher in two schools, recorded in #206.
- **On paper:** a texts book printed for October with a free-entry session's text and a moved session at its new time.
- **With teachers:** a primary French specialist teaching in two schools, keeping one clash and moving another for one day.
