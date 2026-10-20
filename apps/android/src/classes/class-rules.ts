// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Classes tab says of each class (#37): its pupils, its first
// session today, and where it stands against the plan, in sessions. Buffers
// come first: while the buffers left before the next exams absorb a delay,
// it reads as buffer used, never as delay; with none, the spare sessions
// before the next exams are given. Progress belongs to the class, the
// subject and the year, not to the teacher, and the words state facts
// (PRD §2.3, §3.1 rule 8, §4.7). A session awaiting confirmation never
// reads as a delay. Each year of a joint class has its own row (#43).

import {
  classGrades,
  courseGrade,
  isEnrolled,
  isJoint,
  levelGroups,
  pace,
  termCheck,
  todayView,
  type Context,
  type Course,
  type Day,
  type Pace,
  type SchoolClass,
  type Session,
  type TermCheck,
} from '@minhajna/core';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

export interface ClassRow {
  readonly course: Course;
  readonly schoolClass: SchoolClass;
  /** The course's year, in a joint class. */
  readonly grade?: string;
  readonly pupils: number;
  /** The class's first session today that the calendar leaves, if any. */
  readonly today: Session | null;
  readonly pace: Pace | null;
  readonly check: TermCheck | null;
}

/** Every course of the teacher's classes, by class name, then subject. */
export function classRows(context: Context, day: Day): ClassRow[] {
  const { state } = context;
  const sessions = todayView(context, day).sessions.filter((item) => item.status !== 'calendar');
  const rows: ClassRow[] = [];
  for (const course of state.courses.values()) {
    const schoolClass = state.classes.get(course.classId);
    if (schoolClass === undefined) continue;
    const grade = isJoint(schoolClass) ? courseGrade(course, schoolClass) : undefined;
    const year = levelGroups(schoolClass).find((group) => group.grade === grade)?.id;
    rows.push({
      course,
      schoolClass,
      ...(grade !== undefined && { grade }),
      pupils: [...state.pupils.values()].filter(
        (pupil) =>
          pupil.classId === schoolClass.id &&
          isEnrolled(pupil, day) &&
          (year === undefined || pupil.groups.includes(year)),
      ).length,
      today: sessions.find((item) => item.course.id === course.id)?.session ?? null,
      pace: pace(context, course.id, day),
      check: termCheck(context, course.id, day),
    });
  }
  return rows.sort(
    (a, b) =>
      a.schoolClass.name.localeCompare(b.schoolClass.name, 'ar') ||
      classGrades(a.schoolClass).indexOf(a.grade ?? '') - classGrades(b.schoolClass).indexOf(b.grade ?? '') ||
      a.course.subject.localeCompare(b.course.subject),
  );
}

/** Where the class stands: behind beyond the buffers, buffers used, or the spare sessions before the exams. */
export function paceLine(t: Translate, row: Pick<ClassRow, 'pace' | 'check'>, sessionMinutes?: number): string {
  const { pace: p, check } = row;
  if (p === null) return t('classes.noPack');
  const withMinutes = (sessions: string, count: number) =>
    sessionMinutes === undefined
      ? sessions
      : t('settings.withMinutes', {
          sessions,
          minutes: t('settings.minutes', { count: Math.round(count * sessionMinutes) }),
        });
  const sessions = (count: number) => withMinutes(t('count.sessions', { count }), count);
  const delay = Math.round(p.delay);
  if (delay > 0) return t('classes.behind', { sessions: sessions(delay) });
  const used = Math.round(p.bufferUsed);
  const left = Math.round(p.bufferLeft);
  if (used > 0) {
    return left > 0
      ? t('classes.bufferUsed', { used: sessions(used), left: sessions(left) })
      : t('classes.bufferAll', { used: sessions(used) });
  }
  if (check === null) return t('classes.onPlan');
  const spare = check.gives - check.needs;
  return spare >= 0
    ? t('classes.onPlanSpare', { spare: withMinutes(t('classes.spare', { count: spare }), spare) })
    : t('classes.onPlanShort', { sessions: sessions(-spare) });
}
