// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// When notifications may arrive (#234, PRD §3.9, answers 403 and 405).
// Quiet hours run from 20:00 to 07:00 every day, and over the weekend from
// the last school day at 20:00 to the first one at 07:00: Thursday to Sunday
// where the week starts on Sunday. A teacher who works on Saturdays shortens
// the weekend's to Thursday 20:00 to Saturday 07:00. The weekly digest comes
// as the weekend's quiet hours end, for the week before it, the year's last
// included. The daily preview, if turned on, comes at 19:00 the evening
// before each day with a session to teach; on a quiet evening it moves to
// the end of the quiet hours, 07:00 on the day itself. Nothing is worked out
// when a notification arrives: the app plans them ahead each time it is
// used, and nothing else runs in the background (R-6.8-03).

import type { Context } from './context.ts';
import { addDays, compareDays, maxDay, minDay, weekday, type Day } from './day.ts';
import { sessionsBetween, type Session } from './sessions.ts';

/** Quiet hours' daily end and start, and the preview's time, in minutes from midnight. */
export const QUIET_END = 7 * 60;
export const QUIET_START = 20 * 60;
export const PREVIEW_AT = 19 * 60;

/** How far ahead notifications are planned, in days. */
export const PLAN_DAYS = 14;

/** A local time: a day and the minutes since its midnight. */
export interface WallTime {
  readonly day: Day;
  readonly minutes: number;
}

export interface NotifyChoices {
  readonly digest: boolean;
  readonly preview: boolean;
  /** «العمل يوم السبت»: the weekend's quiet hours end on Saturday morning. */
  readonly saturday: boolean;
}

export type Planned =
  | { readonly kind: 'digest'; readonly at: WallTime }
  /** The preview of `day`'s sessions the calendar leaves, in order: the evening before, or that morning. */
  | { readonly kind: 'preview'; readonly at: WallTime; readonly day: Day; readonly sessions: readonly Session[] };

/** Whether `day` is a weekend day all of whose hours are quiet: the two days before the week starts, but Saturday. */
function restDay(context: Context, day: Day, saturday: boolean): boolean {
  const back = (weekday(day) - context.ref.country.weekStartsOn + 7) % 7;
  return back >= 5 && !(saturday && weekday(day) === 6);
}

/** Whether `day` is the first day after the weekend, when the digest comes. */
export function isDigestDay(context: Context, day: Day, saturday: boolean): boolean {
  return restDay(context, addDays(day, -1), saturday) && !restDay(context, day, saturday);
}

/** The days the digest covers on `today`, within the year: the week before a digest day, or the week so far. */
export function digestDays(context: Context, today: Day, saturday = false): { from: Day; to: Day } | null {
  const { ref } = context;
  let start = today;
  for (let back = 0; back < 7 && !isDigestDay(context, start, saturday); back += 1) start = addDays(start, -1);
  if (compareDays(start, today) === 0) start = addDays(start, -7);
  const from = maxDay(start, ref.year.from);
  const to = minDay(addDays(today, -1), ref.year.to);
  return compareDays(from, to) > 0 ? null : { from, to };
}

/** Whether no notification may arrive at `at`. */
export function isQuiet(context: Context, at: WallTime, saturday: boolean): boolean {
  return restDay(context, at.day, saturday) || at.minutes < QUIET_END || at.minutes >= QUIET_START;
}

/** `at`, or the end of the quiet hours it falls in. */
export function afterQuiet(context: Context, at: WallTime, saturday: boolean): WallTime {
  if (!isQuiet(context, at, saturday)) return at;
  let day = at.minutes < QUIET_END ? at.day : addDays(at.day, 1);
  while (restDay(context, day, saturday)) day = addDays(day, 1);
  return { day, minutes: QUIET_END };
}

/** Whether `a` comes before `b`. */
function before(a: WallTime, b: WallTime): boolean {
  const days = compareDays(a.day, b.day);
  return days < 0 || (days === 0 && a.minutes < b.minutes);
}

/** The notifications to plan from `now`, for the next `PLAN_DAYS` days, in time order. */
export function notifyPlan(context: Context, now: WallTime, choices: NotifyChoices): Planned[] {
  const { ref } = context;
  const last = addDays(now.day, PLAN_DAYS);
  const planned: Planned[] = [];
  const teach = new Map<Day, Session[]>();
  const until = minDay(last, ref.year.to);
  if (choices.preview && compareDays(now.day, until) <= 0) {
    for (const one of sessionsBetween(context, now.day, until)) {
      if (one.calendar === null) teach.set(one.day, [...(teach.get(one.day) ?? []), one]);
    }
  }
  for (let day = now.day; compareDays(day, last) <= 0; day = addDays(day, 1)) {
    const start = { day, minutes: QUIET_END };
    const digest = isDigestDay(context, day, choices.saturday) && digestDays(context, day, choices.saturday) !== null;
    if (choices.digest && digest && before(now, start)) planned.push({ kind: 'digest', at: start });
    const sessions = teach.get(day);
    const at = afterQuiet(context, { day: addDays(day, -1), minutes: PREVIEW_AT }, choices.saturday);
    if (sessions !== undefined && compareDays(at.day, day) <= 0 && before(now, at)) {
      planned.push({ kind: 'preview', at, day, sessions });
    }
  }
  return planned.sort((a, b) => (before(a.at, b.at) ? -1 : before(b.at, a.at) ? 1 : 0));
}
