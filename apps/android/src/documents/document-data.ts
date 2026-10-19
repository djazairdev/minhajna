// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a document is made from (#212): the record book and the reference
// data the screens read, the day it is made for, and the interface's
// language and direction, which the printed pages follow.

import { formatDayWithMonth, weekday, type Day, type SchoolClass } from '@minhajna/core';
import type { AppData } from '../storage/AppData';
import type { useText } from '../text/i18n';

export type Translate = ReturnType<typeof useText>;

export type DocumentData = Pick<AppData, 'state' | 'profile' | 'year' | 'calendar' | 'packs' | 'bells'> & {
  readonly day: Day;
  /** Today, which counts stop at; the end of the period when not given. */
  readonly today?: Day;
  readonly lang: 'ar' | 'fr' | 'en';
  readonly dir: 'rtl' | 'ltr';
};

/** The school year as printed, such as «2026-2027». */
export function yearLabel(data: DocumentData): string {
  return `${data.year.from.slice(0, 4)}-${data.year.to.slice(0, 4)}`;
}

/** The school year isolated, so it reads «2026-2027» after Arabic words too, not «2027-2026». */
export function yearShown(data: DocumentData): string {
  return `\u2068${yearLabel(data)}\u2069`;
}

/** The teacher's schools, as printed in a head. */
export function schoolNames(data: DocumentData): string {
  return [...data.state.schools.values()].map((school) => school.name).join(' · ');
}

/** The classes the teacher teaches, those with a course, by name as the Classes tab lists them. */
export function taughtClasses(data: DocumentData): SchoolClass[] {
  const taught = new Set([...data.state.courses.values()].map((course) => course.classId));
  return [...data.state.classes.values()]
    .filter((schoolClass) => taught.has(schoolClass.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

/** The month of `day` as printed, such as «أكتوبر 2026». */
export function monthLabel(data: DocumentData, day: Day): string {
  const name = data.profile.months?.[Number(day.slice(5, 7)) - 1]?.[data.lang] ?? day.slice(5, 7);
  return `${name} ${day.slice(0, 4)}`;
}

/** A day as a page's head prints it, such as «الأحد 18 أكتوبر 2026». */
export function dayTitle(data: DocumentData, t: Translate, day: Day): string {
  return `${t(`week.days.${weekday(day)}`)} ${formatDayWithMonth(day, data.lang, data.profile)}`;
}
