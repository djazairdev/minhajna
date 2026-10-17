# Joint primary classes (#43)

Checks of 17 October 2026 for [#43](https://github.com/djazairdev/minhajna/issues/43). Made-up data only. This first pull request, on `feat/43-joint-core`, adds the core; the setup screen (Setup-4d-Joint) and Today's card for several levels (P-Multi) follow.

## The model

A joint class is one class with two or three levels of primary, each on its own plan (PRD §3.2, R-3.2-13):

- **Each level is a group of the class,** of a new kind, `level`, with its grade. A pupil's level is their group, which PRD §5.6 already allows ("class and group"), so no pupil field is added. The class's own `grade` is its first level.
- **Each level has its own course,** with a new `grade` field, so its own pack, queue and progress (PRD §4.7: "one queue for each level").
- **The timetable keeps one entry per slot.** The teacher teaches every level in the same room at the same time, so a slot is not a clash. The entry may name any level's course.
- **Sessions fan out:** each slot of a joint class is one session for each level's course in that subject, with the calendar of that level's grade. An exam for 5AP marks the 5AP session and leaves the 4AP one.
- **One roll call:** primary counts by half-day, and a joint class's sessions share it. A class set to count by session shares one roll call per slot.

`joint.ts` holds the helpers: `levelGroups`, `isJoint`, `classGrades`, `courseGrade`, `forGrade`, `pupilGrade`, `entryCourses` and `jointProblems`, which checks for two or three different levels of the class's own, in order, the first being the class's grade. `courseOf` takes an optional grade.

No dependency, permission, network call or stored value changes. A history without joint classes reads exactly as before.

## Checks

| Check | Result |
|---|---|
| Core tests | 262 pass, 7 of them new in `test/joint.test.ts`: levels and pupils' levels, each level's course, one session per level per slot, a proposal from 5AP's pack and none for 4AP on free entry, one roll call by half-day or by session, an exam for one grade, and the class's levels checked |
| Lint, type check, Prettier | Pass |
