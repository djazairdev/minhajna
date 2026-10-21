// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CalendarMutation } from './calendar-edit.ts';
import { isWeekReset } from './calendar-edit.ts';
import { makeContext, type Context } from './context.ts';
import { compareDays, maxDay, minDay, startOfWeek, type Day } from './day.ts';
import { termCheck, type TermCheck } from './pacing.ts';
import { addedSessions, compareSessions, sessionsBetween, type Session } from './sessions.ts';
import { updateChanges, type CalendarUpdate } from './calendar-update.ts';
import { current } from './state.ts';
import { slotKey } from './records.ts';

/** A change to an unrecorded session; recorded versions are not changed by the preview. */
export interface CalendarSessionChange {
  readonly before: Session | null;
  readonly after: Session | null;
}
/** Figures from the engine, never an inferred teacher score. */
export interface CalendarCourseChange {
  readonly courseId: string;
  readonly before: TermCheck;
  readonly after: TermCheck;
}
/** Facts before a save or cancellation, computed without writing any history. */
export interface CalendarImpact {
  readonly asOf: Day;
  readonly changes: readonly CalendarSessionChange[];
  readonly recorded: number;
  readonly courses: readonly CalendarCourseChange[];
}

function rows(context: Context, from: Day, to: Day, physical: boolean): Map<string, Session> {
  return new Map(
    [
      ...sessionsBetween(context, from, to),
      ...addedSessions(context, from, to, ['support', 'revision']).map((one) => one.session),
    ].map((session) => [
      physical || session.rotation !== undefined
        ? `${session.courseId}/${session.day}/${slotKey(session.slot)}`
        : session.key,
      session,
    ]),
  );
}

function differs(before: Session | undefined, after: Session | undefined): boolean {
  return (
    before?.calendar !== after?.calendar ||
    before?.sessionType !== after?.sessionType ||
    before?.added !== after?.added ||
    before?.groupId !== after?.groupId
  );
}

/** Applies only to an in-memory copy; source records and sessions are never rewritten. */
export function calendarImpact(context: Context, event: CalendarMutation, today: Day): CalendarImpact {
  const id = event.kind === 'calendar.set' ? event.entry.id : event.id;
  const old =
    context.state.calendar.find((entry) => entry.id === id) ?? context.ref.calendar.find((entry) => entry.id === id);
  const entry = event.kind === 'calendar.set' ? event.entry : old;
  if (entry === undefined) throw new RangeError('No calendar entry to preview');
  const base = context.ref.calendar.find((one) => one.id === id);
  const reordersWeeks = isWeekReset(entry) || entry.confirmedFrom !== undefined || old?.confirmedFrom !== undefined;
  const first = minDay(old === undefined ? entry.from : minDay(old.from, entry.from), base?.from ?? entry.from);
  const from = reordersWeeks
    ? maxDay(context.ref.year.from, startOfWeek(first, context.ref.country.weekStartsOn))
    : first;
  const to = reordersWeeks
    ? context.ref.year.to
    : maxDay(old === undefined ? entry.to : maxDay(old.to, entry.to), base?.to ?? entry.to);
  const calendar = context.state.calendar.filter((one) => one.id !== id);
  const next = makeContext(context.ref, {
    ...context.state,
    calendar: event.kind === 'calendar.set' ? [...calendar, event.entry] : calendar,
  });
  const physical = entry.rotation !== undefined || old?.rotation !== undefined;
  return impactBetween(context, next, from, to, physical, today);
}

/**
 * What applying a signed calendar update would change, before it is applied:
 * over the days its entries cover, before and after, or from the week of the
 * first to the end of the year when one resets the A/B weeks; with `fromToday`,
 * only the days from `today` on.
 */
export function updateImpact(context: Context, update: CalendarUpdate, today: Day, fromToday = false): CalendarImpact {
  const entries = updateChanges(context, update).flatMap((one) => [one.entry, ...(one.before ? [one.before] : [])]);
  const none = { asOf: today, changes: [], recorded: 0, courses: [] };
  if (entries.length === 0) return none;
  const next = makeContext(context.ref, {
    ...context.state,
    calendarUpdates: [...context.state.calendarUpdates, { update, key: '', file: '' }],
  });
  const first = entries.map((one) => one.from).reduce(minDay);
  const last = entries.map((one) => one.to).reduce(maxDay);
  const weeks = entries.some(isWeekReset);
  const start = weeks ? maxDay(context.ref.year.from, startOfWeek(first, context.ref.country.weekStartsOn)) : first;
  const from = fromToday ? maxDay(start, today) : start;
  const to = weeks ? context.ref.year.to : last;
  return compareDays(from, to) > 0 ? none : impactBetween(context, next, from, to, false, today);
}

function impactBetween(
  context: Context,
  next: Context,
  from: Day,
  to: Day,
  physical: boolean,
  today: Day,
): CalendarImpact {
  const before = rows(context, from, to, physical);
  const after = rows(next, from, to, physical);
  const keys = new Set([...before.keys(), ...after.keys()]);
  const isRecorded = (key: string) =>
    [before.get(key), after.get(key)].some(
      (session) => session !== undefined && current(context.state.sessions.get(session.key)) !== null,
    );
  const recorded = [...keys].filter(isRecorded).length;
  const changes = [...keys]
    .filter((key) => !isRecorded(key) && differs(before.get(key), after.get(key)))
    .map((key) => ({ before: before.get(key) ?? null, after: after.get(key) ?? null }))
    .sort((a, b) => compareSessions((a.after ?? a.before)!, (b.after ?? b.before)!));
  const asOf = maxDay(today, from);
  const courses = [...new Set([...before.values(), ...after.values()].map((session) => session.courseId))].flatMap(
    (courseId) => {
      const a = termCheck(context, courseId, asOf);
      const b = termCheck(next, courseId, asOf);
      return a === null || b === null ? [] : [{ courseId, before: a, after: b }];
    },
  );
  return { asOf, changes, recorded, courses };
}
