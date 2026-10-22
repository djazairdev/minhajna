# The primary day, plan and week

Checks of 22 October 2026 for [#230](https://github.com/djazairdev/minhajna/issues/230), from [#354](https://github.com/djazairdev/minhajna/pull/354) to [#363](https://github.com/djazairdev/minhajna/pull/363), built in the order of answer 373. Made-up packs, classes and pupils only.

## What changed

- **A primary slot's types** (answer 374, [Week-slot-primary](../design/screens/Week-slot-primary.png)):
  - A week pack may carry its weekly model, the activity types it uses with their sessions a week.
  - Week-slot offers the subject's activities as chips, with «بلا نوع» first, and the session type apart: «درس», «معالجة» or «دعم».
  - A slot keeps its types when it is saved again. The bell-time line shows the slot's times from the school's bells.
- **Plan weeks in the engine** (answer 375):
  - A slot with an activity takes the first unfinished item of that type in the class's plan week, and never runs ahead into the next plan week while the current one has items left.
  - The proposal names its plan week and counts the week's sessions of its type: «قراءة، الحصة 1 من 3».
- **Remediation and support lists** (answers 376 to 378):
  - Each class and subject has «قائمة المعالجة» beside «قائمة الدعم». A timetabled «معالجة» or «دعم» session takes the next item of its list, and Today shows up to three items on its card: «اليوم», «الحصة القادمة», «بعدها».
  - The session keeps the item it took. Neither list moves the main plan or counts in its delay.
  - Each list opens from the class's plan, and from Week-slot for a slot of its type.
- **Today in bands** (answers 379, 380 and 385, [P-Today](../design/screens/P-Today.png)):
  - A primary day comes in «الصبيحة» and «المساء», each with one roll call for each class called by the half day.
  - «تأكيد اليوم كله كما هو مقترح» records every session still awaiting, with «تراجع». «الكراس اليومي» opens the day's journal.
  - The afternoon's roll call says it is taken on its own only when the class has a morning roll call that day.
- **The plan in plan weeks** (answer 381, [Plan-primary](../design/screens/Plan-primary.png)):
  - A week pack's rows come by plan week, «أسبوع المخطط 5», with its days and sequence.
  - The pace card says the weeks behind beyond the buffers, the class's plan week and the plan's, the sessions the calendar took, counted apart, and the weekly model.
  - «إعادة توزيع بقية الفصل» opens from the plan while it is offered.
- **Stale packs** (answers 382 to 384, [Plan-stale](../design/screens/Plan-stale.png)):
  - A stale pack proposes nothing. No buffer, delay, term check, re-pace draft, exam-window warning or drift is counted from it.
  - The plan says why and offers «استعماله بحذر», the pack as printed, and «كتابة العناصر», which asks first and then leaves the pack for the class's own list.
  - «سؤال المفتش» prints an A4 sheet with the pack, its release and its reason, the question, and boxes signed by hand. Nothing is sent.
- **The double shift** (answers 385 and 386, [Week-draw-primary](../design/screens/Week-draw-primary.png)):
  - A slot saved from Week-slot goes into the same slot of the other half-day for the other week, with its activity and room, and removing it clears both. A session added there takes the slot's week. The afternoon gets a fifth slot with the morning's.
  - For a primary teacher, the option becomes «الدوامان»: the class and its room, the other class in the room by name, this week and next week by letter, the facts, and links to the calendar's week letter and the roll-call rules. At large text each week's row stacks its parts.

No permission or network call changes. The lesson record gains a remediation list beside the support list, and a session keeps the list item it took. A pack may carry `activities` and `staleReason`, and a week version `sharedWith`.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `plan-week.test.ts`, `remediation-list.test.ts`, `list-pairs.test.ts`, `stale-pack.test.ts` and `week.test.ts`: plan weeks and their numbering, the two lists and their pairing, nothing counted from a stale pack, and the fifth afternoon slot |
| Android tests | `week-slot-primary`, `today-plan-week`, `plan-remediation`, `today-lists`, `today-bands`, `plan-primary-weeks`, `plan-stale`, `stale-question`, `week-double-shift` and `week-two-shifts`. Also `primary-scale.test.tsx`: Today in bands, the plan by plan week, a stale plan with «استعماله بحذر» open, «سؤال المفتش», a primary slot and «الدوامان», in Arabic and English at 100% and 200%. Every control is named, every text is free to grow and wrap, and «الدوامان»'s weeks stack at 200% |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - each band reads its name as a header, then its roll call, then its sessions;
  - a list card reads its items with «اليوم» and «الحصة القادمة»;
  - each plan week reads its heading;
  - «الدوامان» reads each week as one line, with the half each class takes;
  - «سؤال المفتش» reads the sheet in order, then «طباعة» and «حفظ PDF».
- **On a phone:**
  - right to left and left to right, with text at 200%, on Android 8 at 360×800;
  - the bands, the list cards, the plan weeks, the stale plan and «الدوامان» wrap without clipping, with touch targets of at least 48 dp.
- **On paper:**
  - «سؤال المفتش» on A4, with the reason and both boxes;
  - the day's journal from «الكراس اليومي».
