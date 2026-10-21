// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { canonicalJson } from './canonical.ts';
import type { CalendarMutation } from './calendar-edit.ts';
import type { Context } from './context.ts';
import { addDays, daysBetween, isDay, type Day } from './day.ts';
import type { CalendarEntry } from './reference.ts';
import { receivedSuperseded } from './calendar-received-match.ts';

/** Only explicitly marked, expected lunar holidays, and Ramadan when marked so, offer sighting confirmation. */
export function isLunarHoliday(entry: CalendarEntry): boolean {
  return (
    entry.lunar === true &&
    entry.layer === 'national' &&
    entry.confidence === 'expected' &&
    ((entry.effect === 'no-school' && entry.times === undefined) ||
      (entry.effect === 'marker' && entry.times === 'ramadan')) &&
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

/**
 * Ramadan ends on the eve of Eid al-Fitr as the calendar has it, expected or
 * confirmed (answer 330): the first national lunar holiday 27 to 32 days
 * after Ramadan's first day.
 */
function endingOnEid(entries: readonly CalendarEntry[]): CalendarEntry[] {
  return entries.map((entry) => {
    if (entry.times !== 'ramadan') return entry;
    const eid = entries
      .filter((one) => one.lunar === true && one.effect === 'no-school' && one.layer === 'national')
      .map((one) => daysBetween(entry.from, one.from))
      .filter((days) => days >= 27 && days <= 32)
      .sort((a, b) => a - b)[0];
    return eid === undefined ? entry : { ...entry, to: addDays(entry.from, eid - 1) };
  });
}

/** Reference bytes stay intact; only an exact, valid local lunar confirmation replaces their effect. */
export function effectiveCalendar(
  reference: readonly CalendarEntry[],
  own: readonly CalendarEntry[],
  updatedIds: readonly string[] = [],
): CalendarEntry[] {
  const confirmations = own.filter(
    (entry) => entry.confirmedFrom !== undefined && reference.some((base) => validLunarConfirmation(entry, base)),
  );
  const replaced = new Set(confirmations.map((entry) => entry.id));
  return endingOnEid([
    ...reference.filter((entry) => !replaced.has(entry.id)),
    ...own.filter((entry) => entry.confirmedFrom === undefined && !receivedSuperseded(entry, reference, updatedIds)),
    ...confirmations,
  ]);
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
