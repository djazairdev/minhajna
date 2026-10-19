// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Who keeps which primary journal (#216, R-3.8-09, R-3.8-11): a subject the
// country profile marks as a specialist's at a level, such as French,
// English or Tamazight in primary school, goes in the specialist's own
// journal; the class teacher's journal and its front pages hold the rest.
// A teacher of both keeps each session in one journal only.

import type { Course, SchoolClass } from '@minhajna/core';
import type { DocumentData } from './document-data';
import { bookCourses } from './texts-book-pages';

/** Whether a specialist teaches the course's subject at its class's level, and so keeps their own journal for it. */
export function bySpecialist(data: DocumentData, course: Course, schoolClass: SchoolClass): boolean {
  const subject = data.profile.subjects.find((one) => one.code === course.subject);
  return subject?.specialist?.includes(schoolClass.level) ?? false;
}

/** The primary classes the teacher teaches as their class teacher this school year, in the Classes tab's order. */
export function classTeacherClasses(data: DocumentData): SchoolClass[] {
  const seen = new Map<string, SchoolClass>();
  for (const { course, schoolClass } of bookCourses(data))
    if (schoolClass.level === 'primary' && !bySpecialist(data, course, schoolClass))
      seen.set(schoolClass.id, schoolClass);
  return [...seen.values()];
}

/** Whether the teacher teaches a primary class as its class teacher this school year, so the primary journal applies. */
export function teachesPrimary(data: DocumentData): boolean {
  return classTeacherClasses(data).length > 0;
}

/** The courses the teacher keeps a specialist's journal for this school year, by class, then by subject. */
export function specialistCourses(data: DocumentData): ReturnType<typeof bookCourses> {
  return bookCourses(data).filter(({ course, schoolClass }) => bySpecialist(data, course, schoolClass));
}

/** Whether the teacher teaches a specialist's subject this school year, so the specialist's journal applies. */
export function teachesSpecialist(data: DocumentData): boolean {
  return specialistCourses(data).length > 0;
}
