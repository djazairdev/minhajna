// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes' records the director reads in a demo world (#585, D-Record,
// R-5.10-02, R-7.8-06, answer 613): with the school key held on this device,
// the channel of every code or key issued to a teacher of the staff list, a
// code or key replaced included, so weeks signed before a new phone stay, as
// the proposals are read (proposal-session.ts), and on it the weeks the joined
// device signed, every signature checked against the world's certifier
// (week-record.ts); a teacher's course gathers its weeks from all their
// channels, each week from one channel only, whole, at its highest version with
// the versions below it, a later code or key's winning a tie, so two phones'
// chains never mix; each course told apart by its teacher, so a class's course
// taught by two teachers in turn keeps each one's weeks, and named by its class
// and subject as its latest week names them and by the teacher's name in the
// staff list, its weeks newest first; the courses grouped by class, the classes
// in the standing timetable's order of classes by name key, then by name, a
// class's courses by subject, then teacher. Each week comes with the code or
// key it came under and the visas on it there (week-visa.ts). A week's chain is
// whole when every version below its highest was read, from the original on.
// Errors carry world-session.ts's codes and those of holding the school key.

import {
  channelStream,
  channelVisas,
  channelWeeks,
  issuesIn,
  keptVersions,
  readJoined,
  standingVersion,
  timetableNameKey,
  timetableNames,
  type ChannelWeek,
  type DemoSchool,
  type KeptIssue,
  type SignedTimetable,
  type WeekVisa,
  type Day,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { assignmentsOf, holdSchool, joinCode, type IssueDesk } from './issue-session';

type RecordsWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;
type Staff = Pick<DemoSchool, 'name' | 'teachers'>;

/** A signed week as the director reads it: the code or key it came under, and its visas, one a version at most. */
export interface RecordedWeek extends ChannelWeek {
  readonly issue: KeptIssue;
  readonly visas: readonly SignedTimetable<WeekVisa>[];
}

/** One course's signed weeks on a teacher's channel, newest first. */
export interface CourseRecord {
  /** The teacher's ID in the staff list and the course, which tell a course's records apart. */
  readonly key: string;
  readonly course: string;
  /** The teacher's name in the staff list. */
  readonly teacher: string;
  /** The class and subject as the latest week names them. */
  readonly class: string;
  readonly subject: string;
  readonly weeks: readonly RecordedWeek[];
}

/** A class of the school and its courses' records, in the timetable's order of classes. */
export interface ClassRecords {
  readonly class: string;
  readonly courses: readonly CourseRecord[];
}

const COLLATOR = new Intl.Collator('ar', { numeric: true });

function groupBy<T>(items: readonly T[], key: (one: T) => string): Map<string, T[]> {
  const found = new Map<string, T[]>();
  for (const one of items) found.set(key(one), [...(found.get(key(one)) ?? []), one]);
  return found;
}

/** Whether every version of a week below its highest was read and verified, from the original on. */
export const wholeChain = (one: ChannelWeek) =>
  one.earlier.length === one.week.version && one.earlier.every((each, at) => each.week.version === at);

/** The signed weeks on the channels of the school's teachers, by class, with the school key. */
export async function readRecords(
  world: RecordsWorld,
  school: Staff,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ClassRecords[]> {
  return recordsOf(world, await holdSchool(world, kit, send, false), school, kit, send);
}

/** The signed weeks on the channels of the school's teachers, by class, with the school key as held. */
export async function recordsOf(
  world: RecordsWorld,
  desk: IssueDesk,
  school: Staff,
  kit: WorldKit,
  send: Send,
): Promise<ClassRecords[]> {
  const space = desk.held.school;
  const standing = standingVersion(keptVersions(world.book.entries, space));
  const rows = (standing?.sessions ?? []).map((one, at) => ({ ...one, row: at + 1 }));
  const order = timetableNames(rows, 'class').map(timetableNameKey);
  const assigned = await assignmentsOf(desk, school.teachers, kit);
  const teacherOf = new Map([...assigned].map(([id, assignment]) => [assignment, id]));
  const [ca, batches] = [await caKey(world.world, send), await spaceBatches(world.world, space, send)];
  const checker = { key: ca, checker: kit };
  const found = new Map<string, { teacher: string; course: string; weeks: Map<Day, RecordedWeek> }>();
  for (const issue of issuesIn(world.book.entries, space)) {
    const person = school.teachers.find((one) => one.id === teacherOf.get(issue.assignment));
    if (person === undefined) continue;
    const code = await joinCode(world.world, desk, issue);
    const theirs = batches.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
    const joined = await kitStep(() => readJoined(code, theirs, checker, kit.cipher, kit.mac));
    const visas = await kitStep(() => channelVisas(code, theirs, checker, joined, kit.cipher, kit.mac));
    for (const one of await kitStep(() => channelWeeks(code, theirs, checker, joined, kit.cipher, kit.mac))) {
      const ours = visas.filter((each) => each.value.course === one.week.course && each.value.week === one.week.week);
      const key = `${person.id}\n${one.week.course}`;
      const course = found.get(key) ?? {
        teacher: person.name,
        course: one.week.course,
        weeks: new Map<Day, RecordedWeek>(),
      };
      const before = course.weeks.get(one.week.week);
      if (before === undefined || one.week.version >= before.week.version)
        course.weeks.set(one.week.week, { ...one, issue, visas: ours });
      found.set(key, course);
    }
  }
  const courses = [...found].map(([key, one]): CourseRecord => {
    const weeks = [...one.weeks.values()].sort((a, b) => (a.week.week < b.week.week ? 1 : -1));
    const { class: name, subject } = weeks[0].week;
    return { key, course: one.course, teacher: one.teacher, class: name, subject, weeks };
  });
  const place = (name: string) => {
    const at = order.indexOf(timetableNameKey(name));
    return at === -1 ? Infinity : at;
  };
  return [...groupBy(courses, (one) => timetableNameKey(one.class)).values()]
    .map((found) => ({
      class: found[0].class,
      courses: found.sort((a, b) => COLLATOR.compare(a.subject, b.subject) || COLLATOR.compare(a.teacher, b.teacher)),
    }))
    .sort((a, b) => place(a.class) - place(b.class) || COLLATOR.compare(a.class, b.class));
}
