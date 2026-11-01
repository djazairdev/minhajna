// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The director's operational view of the school (#569, PRD §7.6, R-7.5-11,
// R-7.6-01, R-7.6-06 to R-7.6-10, answers 587 and 591): one row for each class
// and subject, in the school's order, the classes as the school lists them and
// each class's subjects as its week first gives them, never sorted by delay. A
// level, a teacher's own classes, and the classes behind their plan can each be
// shown alone, as filters that keep that order; a class whose figures are not
// in the school's space is never among those behind, whatever it is. A row
// holds a teacher the timetable names, one row for each teacher who takes a
// subject in the class, or none for a vacant post, which stands as vacant, and
// where that teacher stands with the school's space on the world's date:
// joined, not joined during the trial term end, which leaves the class with its
// timetable only, or to join after it. Once a joined teacher's figures are in
// the space, it holds the class's standing, read from the course's signed weeks
// (week-standing.ts, answer 627), never the record before signing, and a class
// is behind its plan when its latest week runs long. Each teacher's weekly
// sessions come from the timetable, in the school's order of its staff, with
// the cover they gave, never set against a statutory load. Nothing here names a
// cause, a clock time or a score, and nothing counts collective action
// (R-1.11-04). In a demo world, the director's school is the world's first CEM.

import type { Day } from './day.ts';
import type { DemoSchool, DemoSession, DemoTeacher, DemoWorld } from './demo-world.ts';
import { spaceStanding, type SpaceStanding, type TrialTerm } from './school-trial.ts';
import type { CourseStanding } from './week-standing.ts';

/** A row of the dashboard: a class and subject, its teacher, where they stand, and the class's standing. */
export interface DashboardCourse {
  readonly classId: string;
  /** As the school writes it, such as 4AM2. */
  readonly className: string;
  readonly grade: string;
  readonly subject: string;
  /** A teacher the timetable names, or null for a vacant post. */
  readonly teacher: DemoTeacher | null;
  /** Where the teacher stands with the school's space on the world's date, or vacant when there is none. */
  readonly space: SpaceStanding | 'vacant';
  readonly standing: CourseStanding | null;
}

/** Each teacher's weekly sessions from the timetable, and the cover they gave. */
export interface TeacherLoad {
  readonly teacher: DemoTeacher;
  readonly sessions: number;
  readonly cover: number;
}

/** The school the director runs in a demo world: its first CEM, or null when it has none. */
export function directorSchool(world: DemoWorld): DemoSchool | null {
  return world.schools.find((school) => school.level === 'cem') ?? null;
}

/** A class's week, as the timetable gives it. */
export function classWeek(school: DemoSchool, classId: string): DemoSession[] {
  return school.week.filter((session) => session.classId === classId);
}

/**
 * The school's rows in its own order: each class as the school lists it, then each subject and teacher as the class's
 * week first gives them, a subject taken by two teachers giving a row for each. `joined` says whether a teacher has
 * joined the school's space, read against the trial term end on the world's date; `standing` gives a joined
 * teacher's figures for a class and subject, or null while the space holds none.
 */
export function dashboardCourses(
  school: DemoSchool,
  when: { readonly trial: TrialTerm | null; readonly date: Day },
  joined: (teacherId: string) => boolean,
  standing: (classId: string, subject: string) => CourseStanding | null,
): DashboardCourse[] {
  return school.classes.flatMap((one) => {
    const first = new Map<string, DemoSession>();
    for (const session of classWeek(school, one.id)) {
      const at = `${session.subject}|${session.teacherId}`;
      if (!first.has(at)) first.set(at, session);
    }
    return [...first.values()].map((session) => {
      const teacher = school.teachers.find((who) => who.id === session.teacherId) ?? null;
      const taking = teacher !== null && joined(teacher.id);
      return {
        classId: one.id,
        className: one.name,
        grade: one.grade,
        subject: session.subject,
        teacher,
        space: teacher === null ? 'vacant' : spaceStanding(when.trial, when.date, taking),
        standing: taking ? standing(one.id, session.subject) : null,
      };
    });
  });
}

/** Whether a row's class is behind its plan: its latest signed week runs long. */
export function courseBehind(course: DashboardCourse): boolean {
  return course.standing?.runsLong === true;
}

/** The rows of one grade and one teacher, each of all when null, and only those behind when asked, in order. */
export function shownCourses(
  courses: readonly DashboardCourse[],
  filter: { readonly grade: string | null; readonly teacherId: string | null; readonly behindOnly: boolean },
): DashboardCourse[] {
  return courses.filter(
    (course) =>
      (filter.grade === null || course.grade === filter.grade) &&
      (filter.teacherId === null || course.teacher?.id === filter.teacherId) &&
      (!filter.behindOnly || courseBehind(course)),
  );
}

/** The grades the school teaches, in its order of classes. */
export function schoolGrades(school: DemoSchool): string[] {
  return [...new Set(school.classes.map((one) => one.grade))];
}

/** Each teacher's weekly sessions from the timetable, in the school's order of its staff, with the cover given. */
export function teacherLoads(school: DemoSchool, cover: (teacherId: string) => number): TeacherLoad[] {
  return school.teachers.map((teacher) => ({
    teacher,
    sessions: school.week.filter((session) => session.teacherId === teacher.id).length,
    cover: cover(teacher.id),
  }));
}
