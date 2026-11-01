// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of the director's dashboard (#569, answer 591), shared by its row
// on the phone and its table on the PC: a person's name in the interface's
// letters; a class's pace, running long or on pace for the year, its place in
// the plan and how far it reached, in whole percent, from its signed weeks
// (answer 627); and, for a class whose figures are not in the school's space,
// why: a vacant post, not joined during the trial term end with its timetable
// only, its days named, to join after it, or joined with no signed week yet.

import { classWeek, type CourseStanding, type DashboardCourse, type DemoSchool } from '@minhajna/core';
import type { TFunction } from 'i18next';
import { currentLanguage } from '../text/i18n';

/** A made-up person's name in Arabic letters for an Arabic interface, and in Latin letters otherwise. */
export function personName(person: { readonly name: string; readonly latinName: string }): string {
  return currentLanguage() === 'ar' ? person.name : person.latinName;
}

/** Whether a class runs long at its pace, or is on pace for the year. */
export function paceText(t: TFunction, standing: CourseStanding): string {
  return t(standing.runsLong ? 'demo.dashboard.runsLong' : 'demo.dashboard.onPace');
}

/** The furthest item of the plan, in its order, that a class's signed weeks worked on. */
export function positionText(t: TFunction, standing: CourseStanding): string {
  return standing.position?.title ?? t('demo.dashboard.noPosition');
}

/** How far a class has reached, in whole percent of its plan. */
export const reachedText = (standing: CourseStanding) => String(Math.floor(standing.reached / 10));

/** Why a row has no figures, or null when it has them. */
export function waitingText(t: TFunction, school: DemoSchool, course: DashboardCourse): string | null {
  if (course.space === 'vacant') return t('demo.dashboard.vacant');
  if (course.space === 'to-join') return t('demo.dashboard.toJoin');
  if (course.space === 'not-joined') {
    const week = classWeek(school, course.classId).filter((one) => one.subject === course.subject);
    const days = [...new Set(week.map((one) => one.weekday))].map((day) => t(`week.days.${day}`));
    return t('demo.dashboard.notJoined', { days: days.join(t('demo.dashboard.listSeparator')), count: week.length });
  }
  return course.standing === null ? t('demo.dashboard.noFigures') : null;
}
