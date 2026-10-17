# Joint primary classes (#43)

Checks of 17 October 2026 for [#43](https://github.com/djazairdev/minhajna/issues/43). Made-up data only. The first pull request, on `feat/43-joint-core`, adds the core; the second, on `feat/43-joint-setup`, adds the class at setup; the third, on `feat/43-joint-today`, gives Today one card for each slot (P-Multi).

## The model

A joint class is one class with two or three levels of primary, each on its own plan (PRD §3.2, R-3.2-13):

- **Each level is a group of the class,** of a new kind, `level`, with its grade. A pupil's level is their group, which PRD §5.6 already allows ("class and group"), so no pupil field is added. The class's own `grade` is its first level.
- **Each level has its own course,** with a new `grade` field, so its own pack, queue and progress (PRD §4.7: "one queue for each level").
- **The timetable keeps one entry per slot.** The teacher teaches every level in the same room at the same time, so a slot is not a clash. The entry may name any level's course.
- **Sessions fan out:** each slot of a joint class is one session for each level's course in that subject, with the calendar of that level's grade. An exam for 5AP marks the 5AP session and leaves the 4AP one.
- **One roll call:** primary counts by half-day, and a joint class's sessions share it. A class set to count by session shares one roll call per slot.

`joint.ts` holds the helpers: `levelGroups`, `isJoint`, `classGrades`, `courseGrade`, `forGrade`, `pupilGrade`, `entryCourses` and `jointProblems`, which checks for two or three different levels of the class's own, in order, the first being the class's grade. `courseOf` takes an optional grade.

No dependency, permission, network call or stored value changes. A history without joint classes reads exactly as before.

## At setup

- **«قسم مشترك (ابتدائي)»** on Setup-4-Classes, beside «إضافة قسم», shows where a school teaches primary. Its form follows Setup-4d-Joint: «قسم مشترك», «ابتدائي · مستويان أو ثلاثة في قسم واحد», the years («مستويات القسم», hint «مستويان أو ثلاثة.»), the class's name, and «إضافة القسم المشترك». It adds only two or three different years of primary.
- **The class's card** reads «قسم مشترك», then each year with its pupils.
- **Typing the list** asks each pupil's year («المستوى») and counts each year's pupils. A pupil cannot be added without one.
- **The plan step** shows the class under each of its years, so each year gets its own pack or free entry, and Ready checks each. The week stays one slot for all the years.
- **Today and the Classes tab** name the year of each session, such as «4-5A · 5 ابتدائي», and the Classes tab gives each year its own row and pupils.
- **The seating plan** does not offer the years as groups: they share the room.

## On Today

Following P-Multi, a joint class's slot is one card:

- **Each year** has its badge, «4» or «5», and its own line: the plan's proposal in pencil on the focus card, its lesson on a later card, or what was written once recorded, with «تصحيح».
- **One tap** on «تأكيد الحصة للمستويين» confirms every year that has a proposal, and «تراجع» takes them all back. A tap on a year's proposal confirms it alone. A year on free entry keeps «تفاصيل الحصة» on the focus card, to write what was done.
- **One roll call** for the class, on the card.
- `today-actions.ts` now holds Today's taps and their undo, which kept `Today.tsx` under 300 lines; `JointCard` sits beside Today, as it is not a design-system component.

Operator's choices (decision 220):

- Setup-4d-Joint also draws the pupils from the official list and each year's pack. The official list waits for #42, so the year is chosen when typing; packs stay at the plan step, where every class pins its pack, rather than in a second place.
- The years show by their names in the profile at setup, and as «4 ابتدائي» on Today, as P-Multi writes them.
- P-Multi types the free-entry year's text inside the card. Today keeps one way to write a session, «تفاصيل الحصة», so the card's confirm records the proposals only, and says so: «يُؤكَّد لكل مستوى ما اقتُرح له. ونقرة على المقترح تؤكّده وحده.»
- JointCard is not added to the component gallery: the gallery takes design-system components only, and the design system changes only through an approved pull request.


| Check | Result |
|---|---|
| Core tests | 262 pass, 7 of them new in `test/joint.test.ts`: levels and pupils' levels, each level's course, one session per level per slot, a proposal from 5AP's pack and none for 4AP on free entry, one roll call by half-day or by session, an exam for one grade, and the class's levels checked |
| Lint, type check, Prettier | Pass |
| Android tests | 992 pass, 10 of them new in `joint-class.test.tsx` and `joint-rules.test.ts`. `dependency-notices` fails only locally, where `node_modules` still has react 19.3.0 |
| Android tests, Today | 997 pass with the Today part, 3 of them new in `today-joint.test.tsx` |
| Android 15 emulator, debug build | A fresh setup with a primary school: a joint class of 4AP and 5AP, two made-up pupils one in each year, three slots, the 5AP example pack pinned and 4AP on free entry. Ready counts 2.5 hours a week. Today shows each slot as one card: 4AP on free entry with «تفاصيل الحصة», 5AP's proposal in pencil, one roll call, and «تأكيد الحصة لمستوى واحد»; the tap records 5AP only, and «تراجع» takes it back |
