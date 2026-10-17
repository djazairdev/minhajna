// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joint primary classes (PRD §3.2): one teacher, one room, two or three
// levels, each on its own plan. Each level is a group of the class, so a
// pupil's level is their group, as PRD §5.6 allows. Each level has its own
// course, so its own queue and pack (PRD §4.7), while the timetable keeps
// one entry per slot and the roll call stays one for the whole class.

import type { ClassGroup, Course, Pupil, SchoolClass } from './records.ts';
import type { Level } from './reference.ts';
import type { State } from './state.ts';

/** A joint class holds two or three levels. */
export const JOINT_LEVELS = { min: 2, max: 3 } as const;

export type JointProblem = 'level-count' | 'repeated-level' | 'outside-level' | 'level-order' | 'first-grade';

/** A joint class's level groups, in the class's order; none for any other class. */
export function levelGroups(schoolClass: SchoolClass): readonly (ClassGroup & { readonly grade: string })[] {
  return schoolClass.groups.filter(
    (group): group is ClassGroup & { readonly grade: string } => group.kind === 'level' && group.grade !== undefined,
  );
}

export function isJoint(schoolClass: SchoolClass): boolean {
  return levelGroups(schoolClass).length > 0;
}

/** A joint class's levels, or any other class's one grade. */
export function classGrades(schoolClass: SchoolClass): readonly string[] {
  const groups = levelGroups(schoolClass);
  return groups.length > 0 ? groups.map((group) => group.grade) : [schoolClass.grade];
}

/** The level a course follows: its own in a joint class, or its class's. */
export function courseGrade(course: Course, schoolClass: SchoolClass): string {
  return course.grade ?? schoolClass.grade;
}

/** The class as one of its levels sees it, for the calendar's entries for some grades and the level's packs. */
export function forGrade(schoolClass: SchoolClass, grade: string): SchoolClass {
  return grade === schoolClass.grade ? schoolClass : { ...schoolClass, grade };
}

/** A pupil's level in a joint class, once placed in one. */
export function pupilGrade(pupil: Pupil, schoolClass: SchoolClass): string | undefined {
  return levelGroups(schoolClass).find((group) => pupil.groups.includes(group.id))?.grade;
}

/**
 * The courses a timetable entry stands for: its own, or in a joint class
 * every level's course in the same subject and year, in the levels' order.
 * The teacher teaches them in the same slot.
 */
export function entryCourses(state: State, course: Course): readonly Course[] {
  const schoolClass = state.classes.get(course.classId);
  if (schoolClass === undefined || !isJoint(schoolClass)) return [course];
  const grades = classGrades(schoolClass);
  const levels = [...state.courses.values()]
    .filter(
      (candidate) =>
        candidate.classId === course.classId &&
        candidate.subject === course.subject &&
        candidate.year === course.year &&
        grades.includes(courseGrade(candidate, schoolClass)),
    )
    .sort((a, b) => grades.indexOf(courseGrade(a, schoolClass)) - grades.indexOf(courseGrade(b, schoolClass)));
  return levels.length > 0 ? levels : [course];
}

/**
 * What is wrong with a joint class: two or three different grades of its
 * level, in the level's order, the first being the class's own grade.
 */
export function jointProblems(schoolClass: SchoolClass, level: Level): JointProblem[] {
  const grades = levelGroups(schoolClass).map((group) => group.grade);
  const order = level.grades.map((grade) => grade.code);
  const problems: JointProblem[] = [];
  if (grades.length < JOINT_LEVELS.min || grades.length > JOINT_LEVELS.max) problems.push('level-count');
  const repeated = new Set(grades).size !== grades.length;
  if (repeated) problems.push('repeated-level');
  const outside = level.code !== schoolClass.level || grades.some((grade) => !order.includes(grade));
  if (outside) problems.push('outside-level');
  const rank = grades.map((grade) => order.indexOf(grade));
  if (!outside && !repeated && rank.some((at, index) => index > 0 && at < (rank[index - 1] ?? 0))) {
    problems.push('level-order');
  }
  if (grades.length > 0 && grades[0] !== schoolClass.grade) problems.push('first-grade');
  return problems;
}
