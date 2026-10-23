// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What «ملاحظات وصفية» says (#240, P-Obs, answer 464): the class's subjects
// observed in the term, by name, for the chips; each observation's name; the
// counts, «مكتسب 15 · في طور الاكتساب 6 · غير مكتسب 3 · لم تُسجَّل 2»; and the
// hub's line, how many pupils on the term's list have one.

import {
  courseGrade,
  courseObserved,
  isJoint,
  observationCounts,
  observationsFor,
  type AssessmentData,
  type Context,
  type Course,
  type CountryProfile,
  type Day,
  type Observation,
  type ObservationCounts,
} from '@minhajna/core';
import { subjectName } from '../extra/extra-rules';
import { yearShort } from '../setup/names';
import type { useText } from '../text/i18n';
import { justifyPupils } from './justify-rules';

type Translate = ReturnType<typeof useText>;

export const OBSERVATION_TEXTS: Readonly<Record<Observation, string>> = {
  acquired: 'marks.observations.acquired',
  'in-progress': 'marks.observations.inProgress',
  'not-acquired': 'marks.observations.notAcquired',
};

/** An observation's name, «مكتسب». */
export function observationName(t: Translate, value: Observation): string {
  return t(OBSERVATION_TEXTS[value] as 'marks.observations.acquired');
}

/** The class's courses observed in the term, by subject name, with the grade in a joint class. */
export function observedCourses(
  t: Translate,
  context: Context,
  data: AssessmentData,
  profile: CountryProfile,
  courseId: string,
  term: number,
): { readonly courseId: string; readonly name: string }[] {
  const { state } = context;
  const room = state.classes.get(state.courses.get(courseId)?.classId ?? '');
  if (room === undefined) return [];
  const named = (course: Course) =>
    isJoint(room)
      ? `${subjectName(profile, course.subject)} · ${yearShort(t, courseGrade(course, room))}`
      : subjectName(profile, course.subject);
  return [...state.courses.values()]
    .filter((course) => course.classId === room.id && courseObserved(state, data, course.id, term))
    .map((course) => ({ courseId: course.id, name: named(course) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** The pupils on the term's list and how many have each observation. */
export function observationSheet(context: Context, courseId: string, term: number, today: Day) {
  const listed = justifyPupils(context, courseId, term, undefined, today);
  const observations = observationsFor(context.state, courseId, term);
  return { listed, observations, counts: observationCounts(listed, observations) };
}

/** The counts as a line. */
export function countsLine(t: Translate, counts: ObservationCounts): string {
  return t('marks.observations.counts', { ...counts });
}
