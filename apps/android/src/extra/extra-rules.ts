// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the screen for a session outside the timetable (#219) works from:
// the teacher's classes in each subject as choices and their courses, the
// days a session can be dated, the number its row takes on the page, and
// the month's days on a grid that starts on Sunday.

import {
  addDays,
  classGrades,
  compareExtras,
  courseOf,
  isJoint,
  weekday,
  type Course,
  type CountryProfile,
  type Day,
  type State,
  type SupervisedRow,
} from '@minhajna/core';
import { localized } from '../setup/names';

/** A month as YYYY-MM. */
export type Month = string;

export const monthOf = (day: Day): Month => day.slice(0, 7);

/** The month `count` months after `month`, or before it when negative. */
export function addMonths(month: Month, count: number): Month {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

/** The month's weeks, Sunday first; a place outside the month is null. */
export function monthWeeks(month: Month): (Day | null)[][] {
  const first = `${month}-01` as Day;
  const days: (Day | null)[] = Array.from({ length: weekday(first) }, () => null);
  for (let day = first; day.startsWith(month); day = addDays(day, 1)) days.push(day);
  while (days.length % 7 !== 0) days.push(null);
  return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}

export interface ClassChoice {
  readonly value: string;
  readonly label: string;
  readonly classId: string;
  readonly subject: string;
  /** In a joint class, the level, whose course takes the session. */
  readonly grade?: string;
  /** The course, when it exists; it is made on saving otherwise. */
  readonly courseId?: string;
}

/**
 * Each of the teacher's classes in each subject taught there, from its
 * courses and its school's subjects, so a class whose week is not drawn yet
 * can have one too; a joint class once for each of its levels. The subject
 * is added to a class's name only when the teacher teaches more than one.
 */
export function classChoices(
  state: State,
  profile: Pick<CountryProfile, 'subjects'>,
  year: string,
  levelLabel: (grade: string) => string,
): ClassChoice[] {
  const pairs = [...state.classes.values()].flatMap((schoolClass) => {
    const taught = [...state.courses.values()].filter((course) => course.classId === schoolClass.id);
    const subjects = new Set([
      ...taught.map((course) => course.subject),
      ...(state.schools.get(schoolClass.schoolId)?.subjects ?? []),
    ]);
    const grades: readonly (string | undefined)[] = isJoint(schoolClass) ? classGrades(schoolClass) : [undefined];
    return [...subjects].flatMap((subject) =>
      grades.map((grade) => ({
        schoolClass,
        subject,
        grade,
        course: courseOf(state, schoolClass.id, subject, year, grade),
      })),
    );
  });
  const many = new Set(pairs.map((pair) => pair.subject)).size > 1;
  return pairs
    .map(({ schoolClass, subject, grade, course }) => ({
      value: [schoolClass.id, subject, grade ?? ''].join('|'),
      classId: schoolClass.id,
      subject,
      label: [
        schoolClass.name,
        grade === undefined ? null : levelLabel(grade),
        many ? subjectName(profile, subject) : null,
      ]
        .filter((part) => part !== null)
        .join(' · '),
      ...(grade !== undefined && { grade }),
      ...(course !== undefined && { courseId: course.id }),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'));
}

/** The choice's course, or a new one for its class, subject, year and level. */
export function courseOfChoice(state: State, choice: ClassChoice, year: string, newId: () => string) {
  const found = courseOf(state, choice.classId, choice.subject, year, choice.grade);
  if (found !== undefined) return { course: found, isNew: false };
  const course: Course = {
    id: newId(),
    classId: choice.classId,
    subject: choice.subject,
    year,
    pack: null,
    ...(choice.grade !== undefined && { grade: choice.grade }),
  };
  return { course, isNew: true };
}

/** The number a new session takes on the page: after every row that comes before it by day and time. */
export function rowNumber(rows: readonly SupervisedRow[], session: Pick<SupervisedRow, 'day' | 'from' | 'to'>): number {
  const placed = { ...session, id: '\uffff', courseId: '', kind: 'support' as const };
  return rows.filter((row) => compareExtras({ ...row, id: '', courseId: '' }, placed) < 0).length + 1;
}

/** The days a session can be dated: the school year, up to today; none before the year starts. */
export function loggableDays(year: { readonly from: Day; readonly to: Day }, today: Day) {
  const last = today < year.to ? today : year.to;
  return { first: year.from, last, open: year.from <= last };
}

/** A subject's name in the interface's language, or its code. */
export function subjectName(profile: Pick<CountryProfile, 'subjects'>, code: string): string {
  const subject = profile.subjects.find((candidate) => candidate.code === code);
  return subject === undefined ? code : localized(subject.name);
}
