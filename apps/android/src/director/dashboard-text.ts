// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The words of the director's dashboard (#569, answer 591), shared by its row
// on the phone and its table on the PC: a person's name in the interface's
// letters; a delay in weeks for a week pack and in sessions otherwise, in the
// words the class's own plan uses; and, for a class whose figures are not in
// the school's space, why: a vacant post, not joined during the trial term end
// with its timetable only, its days named, to join after it, or joined with no
// signed week yet.

import { classWeek, type DashboardCourse, type DemoSchool, type ProgressStatement } from '@minhajna/core';
import type { TFunction } from 'i18next';
import { currentLanguage } from '../text/i18n';

/** A made-up person's name in Arabic letters for an Arabic interface, and in Latin letters otherwise. */
export function personName(person: { readonly name: string; readonly latinName: string }): string {
  return currentLanguage() === 'ar' ? person.name : person.latinName;
}

/** No delay, or the delay after every buffer, in weeks for a week pack and in sessions otherwise. */
export function delayText(t: TFunction, statement: ProgressStatement): string {
  const { sessions, weeks } = statement.delay;
  if (sessions === 0) return t('demo.dashboard.noDelay');
  if (weeks !== null && weeks > 0) return t('classPlan.weeksBehind', { weeks: t('count.weeks', { count: weeks }) });
  return t('classes.behind', { sessions: t('count.sessions', { count: sessions }) });
}

/** Where a class's place in the plan stands. */
export function positionText(t: TFunction, statement: ProgressStatement): string {
  return statement.lastResource?.title ?? statement.lastUnit?.title ?? t('demo.dashboard.noPosition');
}

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
