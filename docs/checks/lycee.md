# The lycée day, plan and reorientation

Checks of 22 October 2026 for [#231](https://github.com/djazairdev/minhajna/issues/231), from [#365](https://github.com/djazairdev/minhajna/pull/365) to [#371](https://github.com/djazairdev/minhajna/pull/371), built in the order of answer 387. Made-up packs, classes and pupils only.

## What changed

- **The whole day at once** (answer 387, [L-Today](../design/screens/L-Today.png), [Today-saturday](../design/screens/Today-saturday.png)):
  - «تأكيد اليوم كله كما هو مقترح» shows at every level on a day with two or more sessions awaiting a proposal or a list, after the cards, with «تراجع».
  - A Saturday that is a school day says so on Today: «السبت يوم دراسة في استعمال الزمن الساري».
  - A pair of half-group sessions on the main plan counts once for the class's progress, on the day its second half has it: in the pace, the term check, re-pacing and weekly targets. Roll calls, the texts book and TD still count each half's session.
- **The half-group pair** (answer 388, [L-Today](../design/screens/L-Today.png)):
  - A half's session on the main plan shows both halves' turns at its lesson: its own today, and the other half's day and week letter, the whole class's session that takes it first, or that it has had it.
  - The item counts as done for the class once both halves have had it (R-4.7-15).
- **The TD list** (answer 389):
  - A directed-work session shows the class's next three TD items in place of the proposal, «اليوم», «الحصة القادمة» and «بعدها», with «بعد الفرض» when a test comes between.
  - TD never moves the main plan; the note says where the group stays on it.
- **Weekly targets** (answer 390, [Plan-lycee](../design/screens/Plan-lycee.png)):
  - A hybrid pack's week marks become targets, «هدف الأسبوع N», due on the last school day of the class's Nth teaching week.
  - The plan shows each target after its item, with its day. The pace card names a target missed and the next one, whether it will be reached in time, and the main sessions left beside those its items still need, buffers aside.
- **Reorientation** (answers 391 to 393, [Reorient](../design/screens/Reorient.png)):
  - «إعادة تشكيل الأقسام» opens from a lycée class's settings, on the day the new class lists come, such as 8 October for 2AS. It applies from that day, never ahead or behind.
  - Each new class takes an old class's history: its recorded sessions, plan position, changes, layers, lists and re-paces, half-groups' coverage included. A second class taking the same history starts with no timetabled sessions.
  - Each pupil leaves the old class with «تغيير القسم في المؤسسة» and joins the new class chosen, or none for a class the teacher does not teach. Roll calls stay with the old class.
  - The screen previews each new class and lists what stays with the old ones, asks before applying, and names its reason when it refuses.
  - The old classes are archived: they read and print only, come last on the Classes tab with «مؤرشف منذ …», and take no new test, session, pupil or plan change.
  - Each new class's texts book carries on its old class's pages, its first confirmed row opening with «أُعيد تشكيل القسم يوم …».

No permission or network call changes. A course may carry `continues`, the course whose history it takes, and a class `archivedFrom`.

## Automated checks

| Check | Result |
|---|---|
| Core tests | `half-turns.test.ts`, `half-pair.test.ts`, `td-list.test.ts`, `week-targets.test.ts` and `reorient.test.ts`: pairs counted once, both halves' turns, the TD list and its places, targets and their days, and a reshaping's history, archive, pupils, timetable and refusals |
| Android tests | `today-day-end`, `today-bands`, `today-halves`, `today-td-list`, `plan-targets`, `class-page`, `reorient`, `reorient-rules` and `reorient-archive`. Also `lycee-scale.test.tsx`: Today with a TD list and «تأكيد اليوم كله», Today with a half-group's pair, a hybrid plan's targets, and «إعادة تشكيل الأقسام» with a class's pupils open, in Arabic and English at 100% and 200%. Every control is named and every text is free to grow and wrap |
| Languages | Every new text in Arabic, French and English, with the same placeholders |
| Colour | Checked by reading the code: nothing new relies on colour alone. Targets say «هدف», «بُلغ» or «فات موعده», and refusals are text |
| Type check, ESLint, Prettier | Pass |

## Still to do by a person

These are added to the list in [#206](https://github.com/djazairdev/minhajna/issues/206):
- **TalkBack in Arabic:**
  - «تأكيد اليوم كله كما هو مقترح» and its «تراجع»;
  - the half-group pair reads each half with its day and week letter;
  - the TD list reads its items with «اليوم» and «الحصة القادمة»;
  - each weekly target reads its title, its end, its day and whether it is reached;
  - «إعادة تشكيل الأقسام» reads the old classes, each new class's card, each pupil's choices and the confirmation;
  - the Saturday line on Today;
  - an archived class's page and plan read «مؤرشف منذ …».
- **On a phone:**
  - right to left and left to right, with text at 200%, on Android 8 at 360×800;
  - the pair, the TD list, the targets and the reshaping screen with 35 pupils open wrap without clipping, with touch targets of at least 48 dp;
  - on a budget phone, the time to open Today with a TD list and a half-group pair, to open a hybrid class's plan, and to apply «تطبيق إعادة التشكيل» to two classes of about 40 pupils, recorded in #206.
- **On paper:**
  - a new class's texts book printed for October, with the old class's rows, «أُعيد تشكيل القسم يوم …» and the page numbers going on;
  - the archived class's book printed up to the day before.
- **With teachers:** a 2AS teacher's reshaping on the day the lists come, with pupils going to classes the teacher does not teach.
