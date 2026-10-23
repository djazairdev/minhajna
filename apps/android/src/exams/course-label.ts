// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A course's short name on chips and cards (#221): the class's name, with
// the year in a joint class and the subject when the class's courses have
// several or the screen asks for it, such as «4م1 · الرياضيات»; and a
// term's name, as the class plan writes it.

import { courseGrade, isJoint, type CountryProfile, type State } from '@minhajna/core';
import { subjectName } from '../extra/extra-rules';
import { yearShort } from '../setup/names';
import type { useText } from '../text/i18n';

type Translate = ReturnType<typeof useText>;

/** The course's short name, with its subject always when `withSubject`; its ID when its class is unknown. */
export function courseLabel(
  t: Translate,
  state: State,
  profile: CountryProfile,
  courseId: string,
  withSubject = false,
): string {
  const course = state.courses.get(courseId);
  const room = course && state.classes.get(course.classId);
  if (course === undefined || room === undefined) return courseId;
  const grade = isJoint(room) ? yearShort(t, courseGrade(course, room)) : null;
  const subjects = new Set(
    [...state.courses.values()].filter((other) => other.classId === room.id).map((other) => other.subject),
  );
  return [room.name, grade, withSubject || subjects.size > 1 ? subjectName(profile, course.subject) : null]
    .filter(Boolean)
    .join(' · ');
}

/** A term's name: «الأول» for 1. */
export function termName(t: Translate, term: number | undefined): string {
  return term !== undefined && term >= 1 && term <= 3 ? t(`classPlan.term${term as 1 | 2 | 3}`) : String(term ?? '');
}
