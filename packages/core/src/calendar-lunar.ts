// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson } from './canonical.ts';
import type { CalendarMutation } from './calendar-edit.ts';
import type { Context } from './context.ts';
import { addDays, daysBetween, isDay, type Day } from './day.ts';
import type { CalendarEntry } from './reference.ts';
import { replacesReceived } from './calendar-received-match.ts';

/** Only explicitly marked, expected lunar holidays offer sighting confirmation. */
export function isLunarHoliday(entry: CalendarEntry): boolean {
  return (
    entry.lunar === true &&
    entry.layer === 'national' &&
    entry.effect === 'no-school' &&
    entry.confidence === 'expected' &&
    entry.times === undefined &&
    entry.term === undefined &&
    entry.half === undefined
  );
}

/** The exact reference must still match; a new release never inherits a stale confirmation. */
export function validLunarConfirmation(entry: CalendarEntry, reference: CalendarEntry): boolean {
  if (
    !isLunarHoliday(reference) ||
    entry.confirmedFrom !== canonicalJson(reference) ||
    entry.id !== reference.id ||
    entry.confidence !== 'announced' ||
    !isDay(entry.from) ||
    !isDay(entry.to)
  )
    return false;
  const shift = daysBetween(reference.from, entry.from);
  if (
    Math.abs(shift) > 1 ||
    entry.to !== addDays(reference.to, shift) ||
    entry.source.trim() === '' ||
    entry.source.length > 200 ||
    /[\r\n]/.test(entry.source)
  )
    return false;
  return (
    canonicalJson({
      ...entry,
      from: reference.from,
      to: reference.to,
      source: reference.source,
      confidence: reference.confidence,
      confirmedFrom: undefined,
    }) === canonicalJson(reference)
  );
}

/** Reference bytes stay intact; only an exact, valid local lunar confirmation replaces their effect. */
export function effectiveCalendar(reference: readonly CalendarEntry[], own: readonly CalendarEntry[]): CalendarEntry[] {
  const confirmations = own.filter(
    (entry) => entry.confirmedFrom !== undefined && reference.some((base) => validLunarConfirmation(entry, base)),
  );
  const replaced = new Set(confirmations.map((entry) => entry.id));
  return [
    ...reference.filter((entry) => !replaced.has(entry.id)),
    ...own.filter(
      (entry) => entry.confirmedFrom === undefined && !reference.some((base) => replacesReceived(base, entry)),
    ),
    ...confirmations,
  ];
}

/** Records what the teacher says was announced, with a source, never an issuer-verification claim. */
export function confirmLunarHoliday(context: Context, id: string, from: Day, source: string): CalendarMutation {
  const base = context.ref.calendar.find((entry) => entry.id === id);
  if (base === undefined || !isLunarHoliday(base) || !isDay(from)) throw new RangeError('No expected lunar holiday');
  const old = context.state.calendar.find((entry) => entry.id === id);
  if (old !== undefined && old.confirmedFrom === undefined) throw new RangeError('A local ID already exists');
  const entry: CalendarEntry = {
    ...base,
    from,
    to: addDays(base.to, daysBetween(base.from, from)),
    source: source.trim(),
    confidence: 'announced',
    confirmedFrom: canonicalJson(base),
  };
  if (!validLunarConfirmation(entry, base) || entry.from < context.ref.year.from || entry.to > context.ref.year.to)
    throw new RangeError('Invalid lunar confirmation');
  return { kind: 'calendar.set', entry };
}
