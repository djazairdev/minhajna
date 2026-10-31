// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school's term report the director reads in a demo world (#589, D-Report,
// R-7.5-08, R-7.7-02, answer 617): the classes' records read with the school
// key (records-session.ts) and the standing timetable's classes by name key;
// the year's terms begun by the world's date, the one holding it, or else the
// latest begun, shown first; a class's level, the number its name starts with;
// and each teacher's course with a signed week in the term counted from the
// term's first day to the earlier of its last day and the world's date, as the
// teacher's own report counts it (courseDeliveries, answer 612), against the
// school's calendar, its half-days split by the bells of the school's level as
// the teacher's own report splits them, in the records' order of classes,
// subjects and teachers.

import {
  compareDays,
  courseDeliveries,
  keptVersions,
  standingVersion,
  timetableNames,
  type CourseDelivery,
  type Day,
  type DemoSchool,
  type SchoolYear,
  type Term,
  type TimetablePart,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import type { Send, WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { deliveryReading, type MineCalendar } from '../week/school-mine-session';
import { holdSchool } from './issue-session';
import { readRecords, type ClassRecords } from './records-session';

type DeliveryWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** A teacher's course over a term: its delivery, the teacher's name and the record's key. */
export interface CourseReport extends CourseDelivery {
  readonly key: string;
  readonly teacher: string;
}

/** What the report reads: the classes' records and the standing timetable's classes, in its order. */
export interface DeliveryDesk {
  readonly records: readonly ClassRecords[];
  readonly classes: readonly string[];
}

/** The terms of the year begun by a day, in order. */
export const termsBegun = (year: SchoolYear, day: Day): Term[] =>
  year.terms.filter((one) => compareDays(one.from, day) <= 0);

/** The term chosen first: the one holding the day, or else the latest begun, or null before any. */
export const termFirst = (terms: readonly Term[], day: Day): Term | null =>
  terms.find((one) => compareDays(day, one.to) <= 0) ?? terms.at(-1) ?? null;

/** A class's level: the number its name starts with, or null. */
export function levelOf(name: string): number | null {
  const found = /^\d+/.exec(name.trim());
  return found === null ? null : Number(found[0]);
}

/** Reads the classes' records with the school key and the standing timetable's classes. */
export async function readDelivery(
  world: DeliveryWorld,
  school: Pick<DemoSchool, 'name' | 'teachers'>,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<DeliveryDesk> {
  const records = await readRecords(world, school, kit, send);
  const desk = await holdSchool(world, kit, send, false);
  const standing = standingVersion(keptVersions(world.book.entries, desk.held.school));
  const rows = (standing?.sessions ?? []).map((one, at) => ({ ...one, row: at + 1 }));
  return { records, classes: timetableNames(rows, 'class') };
}

/**
 * Each teacher's course with a signed week in the term, from its first day to
 * the earlier of its last day and the world's date, in the records' order, its
 * half-days split by the school's bells as the teacher's own report splits them.
 */
export function termReport(
  desk: DeliveryDesk,
  mine: MineCalendar,
  term: Term,
  date: Day,
  bells: TimetablePart['bells'],
): CourseReport[] {
  const to = compareDays(date, term.to) < 0 ? date : term.to;
  const reading = deliveryReading(mine, desk.classes, bells);
  return desk.records.flatMap((one) =>
    one.courses.flatMap((course) =>
      courseDeliveries(
        course.weeks.map((each) => each.week),
        term.from,
        to,
        reading,
      ).map((delivery) => ({ ...delivery, key: course.key, teacher: course.teacher })),
    ),
  );
}
