// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A version's changes in plain words (#578, R-7.4-15, answer 606), and teaching
// hours as whole hours and minutes (#579): a session that moves says its class
// and subject, with the day and time it leaves and the one it takes; a room
// change, a new session and a removed one say the same, each with its day and
// time, and a session for a group names it. The changes are listed by class for
// the director, and each affected teacher's line says from which day their
// changes apply, or on which day only. A standing version may start on four
// Sundays from the next one, never before the standing version it is drafted
// from; a version for one day takes one of the school days of the coming two
// weeks.

import {
  addDays,
  compareDays,
  weekday,
  type Day,
  type PartChange,
  type PartSession,
  type Weekday,
} from '@minhajna/core';
import type { TFunction } from 'i18next';
import { isolate } from '../week/grid-labels';
import { clock } from './grid-text';
import { partFrom } from './send-session';

const when = (t: TFunction, one: PartSession) => `${t(`week.days.${one.day}`)} ${clock(one.start)}`;
const lesson = (one: PartSession) =>
  [one.class, one.group, one.subject]
    .filter((name) => name !== '')
    .map(isolate)
    .join(' · ');
const roomOf = (t: TFunction, one: PartSession) => (one.room === '' ? t('ttVersion.noRoom') : isolate(one.room));

/** Teaching hours in words, as whole hours and minutes, each with its plural. */
export function hoursText(t: TFunction, hours: number): string {
  const minutes = Math.round(hours * 60);
  const [whole, rest] = [Math.floor(minutes / 60), minutes % 60];
  if (rest === 0) return t('count.hours', { count: whole });
  if (whole === 0) return t('count.minutes', { count: rest });
  return t('demo.timetable.hoursAnd', {
    hours: t('count.hours', { count: whole }),
    minutes: t('count.minutes', { count: rest }),
  });
}

/** One change in plain words. */
export function changeText(t: TFunction, change: PartChange): string {
  const session = change.after ?? change.before;
  const what = lesson(session);
  switch (change.kind) {
    case 'moved':
      return t('ttVersion.moved', { what, before: when(t, change.before), after: when(t, change.after) });
    case 'room':
      return t('ttVersion.room', {
        what,
        when: when(t, change.after),
        before: roomOf(t, change.before),
        after: roomOf(t, change.after),
      });
    case 'added':
      return t('ttVersion.added', { what, when: when(t, change.after) });
    case 'removed':
      return t('ttVersion.removed', { what, when: when(t, change.before) });
  }
}

/** Every change of a version, by class as the timetable names it, then in the order the changes come. */
export function changesByClass(t: TFunction, changes: readonly PartChange[]): string[] {
  const of = (change: PartChange) => (change.after ?? change.before).class;
  return [...changes]
    .map((change, at) => ({ change, at }))
    .sort((a, b) => (of(a.change) < of(b.change) ? -1 : of(a.change) > of(b.change) ? 1 : a.at - b.at))
    .map(({ change }) => changeText(t, change));
}

/** A teacher's changes as their line says them, from the version's first day. */
export const teacherLine = (t: TFunction, day: string, changes: readonly PartChange[], once = false) =>
  t(once ? 'ttVersion.onceLine' : 'ttVersion.teacherLine', {
    day,
    changes: changes.map((one) => changeText(t, one)).join(t('ttVersion.and')),
  });

/**
 * The days a standing version may start on: four Sundays from the next one,
 * or from the first on or after `notBefore`, the standing version's first day,
 * so a version never starts before one it is drafted from.
 */
export function startDays(date: Day, notBefore: Day | null = null): Day[] {
  let first = partFrom(date);
  while (notBefore !== null && compareDays(first, notBefore) < 0) first = addDays(first, 7);
  return [0, 7, 14, 21].map((days) => addDays(first, days));
}

/** The days a version for one day may take: the school days of the coming two weeks, from tomorrow. */
export const oneDays = (date: Day, workingDays: readonly Weekday[]): Day[] =>
  Array.from({ length: 14 }, (_, at) => addDays(date, at + 1)).filter((one) => workingDays.includes(weekday(one)));
