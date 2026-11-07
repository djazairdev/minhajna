// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What joining a school records on the teacher's phone (answer 808): the
// school, each class with its whole-class group, its pupils, a course for each
// class and subject the school gives the teacher, and a timetable version with
// the school's sessions. Every record takes an ID made from the phone's school
// and the delivery's own IDs, joined by dots, which no directory ID holds, so
// joining again updates rather than duplicates, and what did not change records
// nothing. The school's lists and names stand over the phone's. A pupil gone
// from the delivery gets a leaving movement, never a deletion, and one the
// school moved to another class leaves and arrives as a class change, matched
// by registration number; a number that is not digits, or that two pupils
// share, is not taken. A pupil the school lists again while a leaving a join
// made awaits confirmation arrives back once it is due; any other leaving
// stands, and is counted for the teacher to see. A pupil whose data was erased
// and whom the school still lists comes back as a new arrival, since an erasure
// keeps no ID. A new course follows the default pack for its grade and subject
// (`bundledPin`), or free entry; a course already there keeps its pin. A class
// with no session yet takes a course for each of the teacher's subjects at the
// school, so it shows. An archived class is left as it is. The new version
// replaces only the school's own sessions: it keeps the teacher's own time and
// sessions, the other schools', and an entry's weeks, room, session type and
// group; the classes the school no longer gives lose their sessions and are
// named, and a version the teacher planned for a later day, which the new one
// replaces, is counted.

import type { Pupil } from './attendance-records.ts';
import { compareDays, type Day } from './day.ts';
import type { TeacherDelivery } from './directory-book.ts';
import { classMoves, pupilEvents, same } from './directory-join-pupils.ts';
import type { RecordEvent } from './events.ts';
import type { PlanPack } from './pack.ts';
import { bundledPin } from './pack-catalogue.ts';
import type { Course, School, SchoolClass, TimetableEntry } from './records.ts';
import type { SchoolYear } from './reference.ts';
import type { State } from './state.ts';
import { courseOf } from './week.ts';

/** A delivered class, by its record's ID, with its pupils and whether the phone had it. */
export interface JoinClass {
  readonly id: string;
  readonly name: string;
  readonly pupils: number;
  readonly isNew: boolean;
}

/** What a join changes, to show before the teacher approves it, and the records that make it. */
export interface JoinPlan {
  readonly events: readonly RecordEvent[];
  readonly classes: readonly JoinClass[];
  /** The names of the school's classes whose sessions leave the week, as the delivery no longer gives them. */
  readonly dropped: readonly string[];
  readonly sessions: number;
  /** Pupils added to a class the phone already had, moved to it, or back before their leaving was confirmed. */
  readonly arriving: number;
  /** Pupils gone from the delivery, who get a leaving movement. */
  readonly leaving: number;
  /** Pupils the school still lists whose leaving the phone recorded and which stands. */
  readonly stillListed: number;
  readonly weekChanged: boolean;
  /** Timetable versions planned for a later day, which the new version replaces. */
  readonly replaced: number;
}

export interface JoinInput {
  readonly state: State;
  readonly year: SchoolYear;
  readonly today: Day;
  readonly delivery: TeacherDelivery;
  /** The phone's school the delivery goes to; the recorded one stands over it when there is one. */
  readonly school: School;
  readonly packs: readonly PlanPack[];
  /** A new timetable version's ID. */
  readonly newId: () => string;
}

const slotKey = (entry: TimetableEntry) =>
  `${entry.weekday}/${entry.slot.half}/${entry.slot.index}/${entry.courseId}/${entry.groupId}/${entry.weeks}`;

/** The start of every record ID a join makes for the phone's school `schoolId`. */
export const joinedPrefix = (schoolId: string) => `dir.${schoolId}.`;

/** The records that bring the phone in line with `delivery`, and what they change. */
export function joinPlan(input: JoinInput): JoinPlan {
  const { state, year, today, delivery, packs } = input;
  const before = state.schools.get(input.school.id) ?? input.school;
  const prefix = joinedPrefix(before.id);
  const shut = (classId: string) => state.classes.get(`${prefix}c.${classId}`)?.archivedFrom !== undefined;
  const open = delivery.sessions.filter((one) => !shut(one.classId));
  const school: School = {
    ...before,
    ...(delivery.school !== null && {
      code: delivery.school.id,
      name: delivery.school.name,
      zone: delivery.school.wilaya,
      levels: [...new Set([...before.levels, delivery.school.level])],
    }),
    subjects: [...new Set([...before.subjects, ...open.map((one) => one.subject)])],
  };
  const level = delivery.school?.level ?? school.levels[0] ?? '';
  const events: RecordEvent[] = same(school, state.schools.get(school.id)) ? [] : [{ kind: 'school.set', school }];
  const pupilsOf = new Map<string, Pupil[]>();
  for (const pupil of state.pupils.values()) {
    pupilsOf.set(pupil.classId, [...(pupilsOf.get(pupil.classId) ?? []), pupil]);
  }
  const moves = classMoves(state, delivery, prefix, today, shut);
  const last = inForce(state, today);
  const kept = new Map(last?.entries.map((entry) => [entry.id, entry]));
  const classes: JoinClass[] = [];
  const entries: TimetableEntry[] = [];
  const counts = { arriving: 0, leaving: 0, stillListed: 0 };
  for (const delivered of delivery.classes) {
    const id = `${prefix}c.${delivered.id}`;
    const had = state.classes.get(id);
    if (had?.archivedFrom !== undefined) continue;
    const groups = had?.groups.map((group) => (group.kind === 'whole' ? { ...group, name: delivered.name } : group));
    const schoolClass: SchoolClass = {
      ...had,
      id,
      schoolId: school.id,
      level,
      grade: delivered.grade,
      name: delivered.name,
      groups: groups ?? [{ id: `${id}.w`, kind: 'whole', name: delivered.name }],
    };
    if (!same(schoolClass, had)) events.push({ kind: 'class.set', schoolClass });
    classes.push({ id, name: delivered.name, pupils: delivered.pupils.length, isNew: had === undefined });
    const listed = pupilEvents(pupilsOf.get(id) ?? [], id, delivered.pupils, today, had !== undefined, moves);
    events.push(...listed.events);
    counts.arriving += listed.arriving;
    counts.leaving += listed.leaving;
    counts.stillListed += listed.stillListed;
    const sessions = delivery.sessions.filter((one) => one.classId === delivered.id);
    const subjects = sessions.length > 0 ? [...new Set(sessions.map((one) => one.subject))] : before.subjects;
    const courses = new Map<string, Course>();
    for (const subject of subjects) {
      const found = courseOf(state, id, subject, year.id);
      const course: Course = found ?? {
        id: `${id}.${subject}.${year.id}`,
        classId: id,
        subject,
        year: year.id,
        pack: bundledPin(packs, delivered.grade, subject),
      };
      if (found === undefined) events.push({ kind: 'course.set', course });
      courses.set(subject, course);
    }
    const whole = schoolClass.groups.find((group) => group.kind === 'whole')?.id ?? `${id}.w`;
    for (const session of sessions) {
      const course = courses.get(session.subject);
      if (course === undefined) continue;
      const entryId = `${prefix}s.${session.id}`;
      const was = kept.get(entryId);
      const group = schoolClass.groups.some((one) => one.id === was?.groupId) ? was?.groupId : undefined;
      entries.push({
        sessionType: 'lesson',
        weeks: 'every',
        ...was,
        id: entryId,
        weekday: session.weekday,
        slot: session.slot,
        courseId: course.id,
        groupId: group ?? whole,
      });
    }
  }
  const given = new Set(classes.map((one) => one.id));
  const ours = (entry: TimetableEntry) => entry.id.startsWith(`${prefix}s.`) && !archived(state, entry);
  const classOf = (entry: TimetableEntry) => state.courses.get(entry.courseId)?.classId ?? '';
  const left = new Set(
    (last?.entries ?? [])
      .filter(ours)
      .map(classOf)
      .filter((id) => !given.has(id)),
  );
  const dropped = [...left].flatMap((id) => state.classes.get(id)?.name ?? []);
  const week = [...(last?.entries.filter((entry) => !ours(entry)) ?? []), ...entries];
  const keys = (list: readonly TimetableEntry[]) => list.map(slotKey).sort();
  const weekChanged = !same(keys(week), keys(last?.entries ?? []));
  const from = last === undefined || compareDays(today, year.from) < 0 ? year.from : today;
  const later = state.timetables.filter((one) => compareDays(one.from, from) > 0).length;
  if (weekChanged) {
    events.push({
      kind: 'timetable.set',
      version: {
        id: input.newId(),
        from,
        entries: week,
        blocks: last?.blocks ?? [],
        source: 'package',
        ...(last?.options !== undefined && { options: last.options }),
      },
    });
  }
  return {
    events,
    classes,
    dropped,
    sessions: entries.length,
    ...counts,
    weekChanged,
    replaced: weekChanged ? later : 0,
  };
}

/** Whether an entry's class is archived, which a join leaves as it is. */
function archived(state: State, entry: TimetableEntry): boolean {
  const course = state.courses.get(entry.courseId);
  return state.classes.get(course?.classId ?? '')?.archivedFrom !== undefined;
}

/** The version in force on `today`, or the last one recorded when none has started yet. */
function inForce(state: State, today: Day) {
  const started = state.timetables.filter((one) => compareDays(one.from, today) <= 0);
  return (started.at(-1) ?? state.timetables.at(-1))?.version;
}
