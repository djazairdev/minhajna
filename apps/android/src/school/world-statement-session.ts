// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's statement in a demo world (#630, answer 725): the courses of the
// timetable in force (term-send-session.ts), each with the world's school's
// class and the pack it pins for the subject, which names what can be reached,
// and how long its whole-class sessions last; the statement the core works out
// for a course, from what the teacher says and the weeks they signed on this
// key, read on the school's calendar over the year so far, the class's
// calendar, its grade's exams being no losses and the next of them, or else the
// term holding the day, choosing the buffers; and the statement signed with the
// key the teacher joined with, naming the world, so that real mode refuses it,
// and its QR matrix when it fits one code. A week the school's seeded term
// holds is not the teacher's to count: a teacher who joined late counts the
// weeks since.

import {
  compareDays,
  fitsInQr,
  signStatement,
  timetableNameKey,
  worldCourseRecord,
  worldStatement,
  type Day,
  type DemoSchool,
  type PlanPack,
  type ProgressStatement,
  type SchoolJoined,
  type Subject,
  type WeekRecord,
  type WorldStatementReach,
} from '@minhajna/core';
import type { WorldKit } from '../demo/world-session';
import signature, { type QrMatrix } from '../native/NativeMinhajnaSignature';
import { sessionsOf } from '../timetable/teacher-session';
import { deliveryReading, standingOn, termOn, type MineCalendar } from '../week/school-mine-session';
import type { SignChannel } from '../week/week-sign-session';
import { termCourses, type TermCourse } from './term-send-session';

/** A course of the timetable, with the class and the pack the world's school gives it. */
export interface StatementCourse extends TermCourse {
  readonly room: DemoSchool['classes'][number] | null;
  readonly pack: PlanPack | null;
  /** How long its sessions last in the part, in minutes, a whole-class session's when it has one. */
  readonly sessionMinutes: number;
}

/** The part in force on a day, as the courses read it: a whole version, a one-day part giving way to one. */
export const partInForce = (parts: SignChannel['parts'], day: Day) =>
  (standingOn(parts, day) ?? [...parts].reverse().find((one) => !one.part.once))?.part;

/** The courses of the timetable in force, each with its class and pack, or none where the school has none. */
export function statementCourses(
  parts: SignChannel['parts'],
  day: Day,
  subjects: readonly Subject[],
  school: DemoSchool,
  packs: readonly PlanPack[],
): StatementCourse[] {
  const part = partInForce(parts, day);
  const sessions = part === undefined ? [] : sessionsOf(part);
  return termCourses(parts, day, subjects).map((course) => {
    const room = school.classes.find((one) => timetableNameKey(one.name) === timetableNameKey(course.class)) ?? null;
    const pin = course.code === null ? undefined : room?.packs[course.code];
    const pack =
      pin === undefined ? null : (packs.find((one) => one.id === pin.id && one.release === pin.release) ?? null);
    const own = sessions.filter((one) => one.class === course.class && one.subject === course.subject);
    const session = own.find((one) => one.group === '') ?? own[0];
    return { ...course, room, pack, sessionMinutes: session.end - session.start };
  });
}

/** The term of the next exams of a grade on the school's calendar, or else the term holding the day. */
export function nextExamsTerm(mine: MineCalendar, day: Day, grade: string): number | undefined {
  const next = mine.calendar.entries
    .filter(
      (one) =>
        one.effect === 'exam' &&
        one.term !== undefined &&
        (one.grades === undefined || one.grades.includes(grade)) &&
        compareDays(one.to, day) >= 0,
    )
    .sort((a, b) => compareDays(a.from, b.from))[0]?.term;
  return next ?? termOn(mine.calendar.year, day)?.number;
}

/** What a course's statement is worked out from. */
export interface CourseStatementInput {
  readonly school: Pick<DemoSchool, 'level'>;
  readonly course: StatementCourse;
  readonly reached: WorldStatementReach;
  /** The teacher's signed weeks. */
  readonly weeks: readonly WeekRecord[];
  readonly mine: MineCalendar;
  readonly bells: Parameters<typeof deliveryReading>[2];
  readonly day: Day;
}

/** The statement a course gives on a day, or null when it has no class or pack, or the statement would not read. */
export function courseStatement(input: CourseStatementInput): ProgressStatement | null {
  const { school, course, reached, weeks, mine, bells, day } = input;
  if (course.room === null || course.pack === null || course.code === null) return null;
  const name = timetableNameKey(course.class);
  const own = weeks.filter((one) => timetableNameKey(one.class) === name && one.totals.subject === course.code);
  const { level } = school;
  const reading = deliveryReading({ ...mine, level, rooms: [course.room] }, [], bells);
  const term = nextExamsTerm(mine, day, course.room.grade);
  return worldStatement({
    level,
    grade: course.room.grade,
    section: course.room.name,
    subject: course.code,
    year: mine.calendar.year.id,
    pack: course.pack,
    reached,
    record: worldCourseRecord(own, mine.calendar.year.from, day, reading),
    sessionMinutes: course.sessionMinutes,
    ...(term === undefined ? {} : { term }),
    day,
  });
}

/** The statement signed with the key the teacher joined with, naming the world. */
export const signedWorldStatement = (
  statement: ProgressStatement,
  world: string,
  join: Pick<SchoolJoined, 'certificate' | 'pkcs8'>,
  kit: Pick<WorldKit, 'sign'>,
): Promise<string> => signStatement(statement, join.certificate.publicKey, (text) => kit.sign(join.pkcs8, text), world);

/** A signed statement's QR matrix when it fits one code, or null. */
export const statementCode = async (text: string): Promise<QrMatrix | null> =>
  fitsInQr(text) ? signature.qrMatrix(text) : null;
