// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the Class page says of one class and subject (#279, Class): its
// pupils for the year of a joint class, the last session in its texts book
// with its page, its guided work against the plan, this month's absences,
// lateness and attendance, what homework is due today, and its supervised
// or extra lessons. Each line states facts the record holds; the page adds
// no record of its own. Absences are counted in half-days (answer 253),
// from the month's first day to today, and only for the pupils the page
// lists, the year's in a joint class.

import {
  DEFAULT_COUNTING,
  compareDays,
  countRollCalls,
  groupPupils,
  homeworkRecord,
  levelGroups,
  maxDay,
  monthOf,
  parseDay,
  wholeGroup,
  type Context,
  type Day,
  type RollCallCounts,
  type TermCheck,
} from '@minhajna/core';
import { bookViewPages } from '../book/book-pages';
import type { DocumentData, Translate } from '../documents/document-data';
import { lessonRows } from '../documents/supervised-pages';
import { listNumbers } from '../roll/roll-rules';
import { dayName } from '../today/DayMark';
import { isolate } from '../week/grid-labels';
import type { ClassRow } from './class-rules';

/** A pupil as the page lists them: their list number, name and this month's marks, if any. */
export interface PupilLine {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly badge: string | null;
}

/** The group the course is taught to: the year's in a joint class, or the whole class. */
export function courseGroup(row: Pick<ClassRow, 'schoolClass' | 'grade'>): string {
  const year = levelGroups(row.schoolClass).find((group) => group.grade === row.grade);
  return year?.id ?? wholeGroup(row.schoolClass).id;
}

/**
 * The class's roll calls from the first day of `day`'s month to `day`, or
 * null when none of them was taken, whatever the rule for those not taken.
 */
export function monthSoFar(context: Context, classId: string, day: Day): RollCallCounts | null {
  const { year } = context.ref;
  const first = maxDay(parseDay(`${monthOf(day)}-01`), year.from);
  const last = compareDays(day, year.to) <= 0 ? day : year.to;
  if (compareDays(first, last) > 0) return null;
  const rules = context.state.counting ?? DEFAULT_COUNTING;
  const counts = countRollCalls(context, classId, first, last, rules);
  const taken = counts.units - (rules.untaken === 'present' ? counts.untaken : 0);
  return taken === 0 ? null : counts;
}

/** The pupils on `day`, in the class list's order, each with the month's absences and lateness so far. */
export function pupilLines(
  t: Translate,
  context: Context,
  row: ClassRow,
  day: Day,
  month: RollCallCounts | null,
): PupilLine[] {
  const numbers = listNumbers(context, row.schoolClass.id);
  const counts = new Map((month?.pupils ?? []).map((count) => [count.pupilId, count]));
  return groupPupils(context, row.schoolClass.id, courseGroup(row), day).map((pupil) => {
    const count = counts.get(pupil.id);
    const parts = [
      count !== undefined && count.absent > 0 ? t('classPage.absences', { count: count.absent }) : null,
      count !== undefined && count.late.length > 0 ? t('classPage.lates', { count: count.late.length }) : null,
    ].filter((part): part is string => part !== null);
    return {
      id: pupil.id,
      number: numbers.get(pupil.id) ?? 0,
      name: pupil.name,
      badge: parts.length === 0 ? null : parts.join(' · '),
    };
  });
}

/** The month's roll calls so far for the pupils listed: their half-days missed, late arrivals and attendance rate. */
export function rollLine(
  t: Translate,
  data: DocumentData,
  day: Day,
  counts: RollCallCounts | null,
  listed: readonly { readonly id: string }[],
): string {
  const month = data.profile.months?.[Number(day.slice(5, 7)) - 1]?.[data.lang] ?? monthOf(day);
  const ids = new Set(listed.map((pupil) => pupil.id));
  const pupils = (counts?.pupils ?? []).filter((count) => ids.has(count.pupilId));
  const possible = pupils.reduce((sum, count) => sum + count.possible, 0);
  if (possible === 0) return t('classPage.rollNone', { month });
  const absent = pupils.reduce((sum, count) => sum + count.absent, 0);
  const late = pupils.reduce((sum, count) => sum + count.late.length, 0);
  const rate = Math.round(((possible - absent) / possible) * 1000) / 10;
  return t('classPage.rollLine', {
    month,
    absent: t('classPage.absences', { count: absent }),
    late: t('classPage.lates', { count: late }),
    rate: `\u2066${rate}%\u2069`,
  });
}

/** The texts book's last confirmed session, with its page, or that none is confirmed yet. */
export function bookLine(t: Translate, data: DocumentData, context: Context, row: ClassRow, day: Day): string {
  const pages = bookViewPages(data, context, row.course, t, data.dir, day);
  for (const page of [...pages].reverse()) {
    const last = page.rows.filter((one) => !one.awaiting).at(-1);
    if (last === undefined) continue;
    const when = dayName(t, last.day, data.lang, data.profile);
    return page.number === null
      ? t('classPage.bookLast', { day: when })
      : t('classPage.bookPage', { day: when, page: String(page.number).padStart(2, '0') });
  }
  return t('classPage.bookNone');
}

/** The guided work against what is left before the exams, or null when the plan has none. */
export function tdLine(t: Translate, check: TermCheck | null): string | null {
  if (check === null || check.td.items === 0) return null;
  const spare = check.td.gives - check.td.items;
  if (spare > 0) return t('classPage.tdSpare', { spare: t('classes.spare', { count: spare }) });
  if (spare === 0) return t('classPage.tdEven');
  return t('classPage.tdShort', { sessions: t('count.sessions', { count: -spare }) });
}

/** The homework due today from the course, whichever group it was set to, or that none is. */
export function homeworkLine(t: Translate, context: Context, courseId: string, day: Day): string {
  const due = homeworkRecord(context, courseId).filter((item) => compareDays(item.due, day) === 0);
  if (due.length === 0) return t('classPage.homeworkNone');
  return t('homework.dueToday', { text: due.map((item) => isolate(item.text)).join(' · ') });
}

/** The class's supervised or extra lessons, on page 08 of its texts book. */
export function supervisedLine(t: Translate, data: DocumentData, context: Context, row: ClassRow): string {
  const count = lessonRows(data, context, row.schoolClass).length;
  return `${t('documents.supervised.page')} · ${count === 0 ? t('classPage.none') : t('count.sessions', { count })}`;
}
