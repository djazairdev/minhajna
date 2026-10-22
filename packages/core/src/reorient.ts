// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Reshaping a level's classes after reorientation (#231, Reorient, R-4.7-39,
// answers 391 and 393), on the day the new class lists come, such as 8 October
// for 2AS: from that day, the old classes are archived, read and print only,
// and each new class's course continues the course of the old class it names,
// taking its recorded sessions, plan position and changes, layers and lists.
// Every pupil of the old classes leaves on that day, changing class, and joins
// the new class chosen for them, or none for a class the teacher does not
// teach; their roll calls stay with the old class. The timetable's sessions of
// an old class's courses go to the new class that takes its history, from that
// day; a second new class taking the same history starts with none, to draw.
// The day is the one the reshaping is recorded on: never one gone by, since a
// timetable never reaches back before the day it is recorded (PRD §4.6) and the
// sessions in between would belong to no class; never one to come, so an old
// class is never left waiting for its archive. Tests and added sessions of the
// old classes on or after the day are moved or cancelled first; homework that
// comes back on or after it stays with the old class, uncounted, its list gone.
// Nothing is recorded until the events are.

import type { Context } from './context.ts';
import { addDays, compareDays, isWithin, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { wholeGroup, type Course, type Pupil, type SchoolClass } from './records.ts';
import { isEnrolled } from './roll-call.ts';
import { versionOn } from './sessions.ts';
import { current } from './state.ts';

export interface Reorientation {
  readonly day: Day;
  /** The classes the school reshapes, all of one school and grade. */
  readonly olds: readonly string[];
  /** The new classes, each with the old class whose history it takes. */
  readonly classes: readonly { readonly name: string; readonly takes: string }[];
  /**
   * Where a pupil of the old classes goes: a new class by its place in
   * `classes`, or null for a class the teacher does not teach. A pupil
   * left out goes to the first new class that takes their old class.
   */
  readonly pupils: ReadonlyMap<string, number | null>;
}

/** The pupils of the old classes listed on the day, each with where they go, by class in the old classes' order. */
export function reorientedPupils(context: Context, plan: Reorientation): { pupil: Pupil; to: number | null }[] {
  const listed = [...context.state.pupils.values()].filter(
    (pupil) => plan.olds.includes(pupil.classId) && isEnrolled(pupil, addDays(plan.day, -1)),
  );
  return plan.olds.flatMap((old) =>
    listed
      .filter((pupil) => pupil.classId === old)
      .map((pupil) => {
        const chosen = plan.pupils.get(pupil.id);
        const first = plan.classes.findIndex((one) => one.takes === old);
        return { pupil, to: chosen === undefined ? (first < 0 ? null : first) : chosen };
      }),
  );
}

/** Why a reorientation cannot be applied, as the screen names it. */
export type ReorientRefusal =
  | 'unknown-class'
  | 'mixed-classes'
  | 'archived'
  | 'day'
  | 'past'
  | 'future'
  | 'no-name'
  | 'same-name'
  | 'other-history'
  | 'recorded'
  | 'test'
  | 'added'
  | 'timetable'
  | 'unknown-target';

/** Why the reorientation, recorded on `today`, does not hold, or null when it does. */
export function reorientRefusal(context: Context, plan: Reorientation, today: Day): ReorientRefusal | null {
  const { state, ref } = context;
  const olds = plan.olds.map((id) => state.classes.get(id));
  const first = olds[0];
  if (first === undefined || olds.some((one) => one === undefined)) return 'unknown-class';
  const same = (one: SchoolClass | undefined) => one?.schoolId === first.schoolId && one.grade === first.grade;
  if (!olds.every(same)) return 'mixed-classes';
  if (olds.some((one) => one?.archivedFrom !== undefined)) return 'archived';
  if (!isWithin(plan.day, addDays(ref.year.from, 1), ref.year.to)) return 'day';
  if (compareDays(plan.day, today) < 0) return 'past';
  if (compareDays(plan.day, today) > 0) return 'future';
  const names = plan.classes.map((one) => one.name.trim());
  if (names.length === 0 || names.some((name) => name === '')) return 'no-name';
  if (new Set(names).size !== names.length) return 'same-name';
  if (plan.classes.some((one) => !plan.olds.includes(one.takes))) return 'other-history';
  const ids = new Set(oldCourses(context, plan).map((course) => course.id));
  const late = [...state.sessions.values()].some((versions) => {
    const record = current(versions);
    return record !== null && ids.has(record.session.courseId) && compareDays(record.session.day, plan.day) >= 0;
  });
  if (late) return 'recorded';
  const ahead = (one: { readonly courseId: string; readonly day: Day }) =>
    ids.has(one.courseId) && compareDays(one.day, plan.day) >= 0;
  if ([...state.tests.values()].some(ahead)) return 'test';
  if ([...state.catchUps.values()].some(ahead)) return 'added';
  if (state.timetables.some((one) => compareDays(one.from, plan.day) > 0)) return 'timetable';
  const moved = reorientedPupils(context, plan);
  if (moved.some(({ to }) => to !== null && (to < 0 || to >= plan.classes.length))) return 'unknown-target';
  return null;
}

/** The old classes' courses of the school year. */
function oldCourses(context: Context, plan: Reorientation): Course[] {
  return [...context.state.courses.values()].filter(
    (course) => plan.olds.includes(course.classId) && course.year === context.ref.year.id,
  );
}

/** The events, to record on `today`, that reshape the classes; throws, with the refusal, when they do not hold. */
export function reorient(context: Context, plan: Reorientation, today: Day, newId: () => string): RecordEvent[] {
  const refusal = reorientRefusal(context, plan, today);
  if (refusal !== null) throw new RangeError(refusal);
  const { state } = context;
  const olds = plan.olds.map((id) => state.classes.get(id)!);
  const names = plan.classes.map((one) => one.name.trim());
  const before = oldCourses(context, plan);
  const ids = new Set(before.map((course) => course.id));
  const moved = reorientedPupils(context, plan);

  const made = plan.classes.map((one, index) => {
    const old = state.classes.get(one.takes)!;
    const whole = newId();
    const schoolClass: SchoolClass = {
      id: newId(),
      schoolId: old.schoolId,
      level: old.level,
      grade: old.grade,
      ...(old.stream !== undefined && { stream: old.stream }),
      name: names[index]!,
      groups: [{ id: whole, kind: 'whole', name: names[index]! }],
      ...(old.rollCallUnit !== undefined && { rollCallUnit: old.rollCallUnit }),
    };
    const courses = before
      .filter((course) => course.classId === old.id)
      .map((course): Course => ({
        ...course,
        id: newId(),
        classId: schoolClass.id,
        continues: { courseId: course.id, from: plan.day },
      }));
    return { schoolClass, courses };
  });

  const events: RecordEvent[] = made.flatMap(({ schoolClass, courses }) => [
    { kind: 'class.set', schoolClass } as const,
    ...courses.map((course) => ({ kind: 'course.set', course }) as const),
  ]);
  for (const old of olds) events.push({ kind: 'class.set', schoolClass: { ...old, archivedFrom: plan.day } });
  for (const { pupil, to } of moved) {
    events.push({
      kind: 'pupil.moved',
      pupilId: pupil.id,
      movement: { day: plan.day, kind: 'out', reason: 'class-change', confirmed: true },
    });
    const target = to === null ? undefined : made[to];
    if (target === undefined) continue;
    events.push({
      kind: 'pupil.set',
      pupil: {
        name: pupil.name,
        sex: pupil.sex,
        ...(pupil.registration !== undefined && { registration: pupil.registration }),
        ...(pupil.latinName !== undefined && { latinName: pupil.latinName }),
        id: newId(),
        classId: target.schoolClass.id,
        groups: [],
        movements: [{ day: plan.day, kind: 'in', reason: 'class-change' }],
      },
    });
  }

  const version = versionOn(state.timetables, plan.day);
  if (version !== null) {
    const successor = new Map<string, { courseId: string; whole: string }>();
    for (const { schoolClass, courses } of made) {
      for (const course of courses) {
        const old = course.continues?.courseId ?? '';
        if (!successor.has(old)) successor.set(old, { courseId: course.id, whole: wholeGroup(schoolClass).id });
      }
    }
    const wholes = new Set(olds.map((one) => wholeGroup(one).id));
    const entries = version.entries.flatMap((entry) => {
      if (!ids.has(entry.courseId)) return [entry];
      const next = successor.get(entry.courseId);
      return next === undefined || !wholes.has(entry.groupId)
        ? []
        : [{ ...entry, id: newId(), courseId: next.courseId, groupId: next.whole }];
    });
    events.push({ kind: 'timetable.set', version: { ...version, id: newId(), from: plan.day, entries } });
  }
  return events;
}
