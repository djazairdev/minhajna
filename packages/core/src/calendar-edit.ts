// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Local calendar changes (#222, PRD §4.5) append events, never alter a
// reference release or promote the teacher's private layer to a shared one.
// A cancellation withdraws an entry, not its history; it is not an erasure.

import { addSessionsDay, SOURCE_MAX } from './added-days.ts';
import type { Context } from './context.ts';
import { isDay } from './day.ts';
import type { RecordEvent } from './events.ts';
import type { CalendarEntry } from './reference.ts';
import { validLunarConfirmation } from './calendar-lunar.ts';
import { checkRotation } from './rotating-groups.ts';

/** Existing history events only; no file or database format is added. */
export type CalendarMutation = Extract<RecordEvent, { kind: 'calendar.set' | 'calendar.removed' }>;

/** Supported local entries, including exact lunar confirmations and school A/B resets. */
export function editableCalendarEntry(context: Context, id: string): CalendarEntry | null {
  const entry = context.state.calendar.find((one) => one.id === id);
  if (entry?.received !== undefined) return null;
  const base = context.ref.calendar.find((one) => one.id === id);
  if (base !== undefined) return entry !== undefined && validLunarConfirmation(entry, base) ? entry : null;
  if (entry === undefined || entry.layer === 'national' || entry.times !== undefined || entry.term !== undefined)
    return null;
  if (entry.confidence !== 'announced' && entry.confidence !== 'expected') return null;
  if (entry.effect === 'adds-sessions') return entry.takes === undefined ? null : entry;
  if (entry.effect === 'week-a' || entry.effect === 'week-b') return entry.layer === 'school' ? entry : null;
  if (entry.effect === 'rotating-groups') return entry.layer === 'school' ? entry : null;
  return entry.effect === 'closure' || entry.effect === 'marker' ? entry : null;
}

function line(value: string, max: number): boolean {
  return typeof value === 'string' && value.trim() !== '' && value.length <= max && !/[\r\n]/.test(value);
}

function checkScope(context: Context, entry: CalendarEntry): void {
  if (entry.layer === 'school') {
    if (!context.state.schools.has(entry.schoolId ?? '') || entry.zone !== undefined)
      throw new RangeError('Invalid school scope');
  } else if (entry.layer === 'zone') {
    const own = [...context.state.schools.values()].some((school) => school.zone === entry.zone);
    if (!entry.zone || !own || entry.schoolId !== undefined) throw new RangeError('Invalid zone scope');
  } else if (entry.layer !== 'teacher' || entry.zone !== undefined || entry.schoolId !== undefined) {
    throw new RangeError('Only local school, zone and teacher entries can be edited');
  }
  const levels = context.ref.country.levels;
  if (entry.levels?.some((code) => !levels.some((level) => level.code === code))) throw new RangeError('Unknown level');
  const grades = levels
    .filter((level) => entry.levels === undefined || entry.levels.includes(level.code))
    .flatMap((level) => level.grades);
  if (entry.grades?.some((code) => !grades.some((grade) => grade.code === code))) throw new RangeError('Unknown grade');
}

/** Validate a local entry without widening its layer, scope or meaning. */
export function setCalendarEntry(context: Context, entry: CalendarEntry): CalendarMutation {
  if (entry.received !== undefined) throw new RangeError('Received notices keep their original content');
  if (entry.confirmedFrom !== undefined) {
    const base = context.ref.calendar.find((one) => one.id === entry.id);
    const old = context.state.calendar.find((one) => one.id === entry.id);
    if (
      base === undefined ||
      !validLunarConfirmation(entry, base) ||
      entry.from < context.ref.year.from ||
      entry.to > context.ref.year.to ||
      (old !== undefined && old.confirmedFrom === undefined)
    )
      throw new RangeError('Invalid lunar confirmation');
    return { kind: 'calendar.set', entry };
  }
  if (!line(entry.id, 200) || context.ref.calendar.some((one) => one.id === entry.id))
    throw new RangeError('Reference entries are read-only');
  const old = context.state.calendar.find((one) => one.id === entry.id);
  if (old !== undefined) {
    if (editableCalendarEntry(context, old.id) === null) throw new RangeError('This entry is read-only');
    if (old.layer !== entry.layer || old.schoolId !== entry.schoolId || old.zone !== entry.zone)
      throw new RangeError('An edit keeps its layer and scope');
    if (old.effect === 'adds-sessions' && entry.effect !== old.effect)
      throw new RangeError('An added day keeps its kind of entry');
    if (isWeekReset(old) !== isWeekReset(entry)) throw new RangeError('An edit keeps its kind of entry');
    if (
      (old.effect === 'rotating-groups') !== (entry.effect === 'rotating-groups') ||
      old.rotation?.classId !== entry.rotation?.classId
    )
      throw new RangeError('An edit keeps its class and kind');
  }
  checkScope(context, entry);
  if (
    !isDay(entry.from) ||
    !isDay(entry.to) ||
    entry.from > entry.to ||
    entry.from < context.ref.year.from ||
    entry.to > context.ref.year.to
  )
    throw new RangeError('The dates must be in the school year');
  if (!line(entry.source, SOURCE_MAX) || !Object.values(entry.name).some((name) => line(name, 160)))
    throw new RangeError('A name and source are required');
  if (Object.values(entry.name).some((name) => !line(name, 160))) throw new RangeError('Invalid entry name');
  if (entry.confidence !== 'announced' && entry.confidence !== 'expected')
    throw new RangeError('Invalid local confidence');
  if (entry.times !== undefined || entry.term !== undefined) throw new RangeError('Reference rules are read-only');
  if (entry.lunar !== undefined || (entry.half !== undefined && entry.half !== 'morning' && entry.half !== 'afternoon'))
    throw new RangeError('Invalid local period');
  if (entry.effect === 'rotating-groups') {
    checkRotation(context, entry);
    return { kind: 'calendar.set', entry: { ...entry, source: entry.source.trim() } };
  }
  if (entry.rotation !== undefined) throw new RangeError('Unexpected rotation rule');
  if (isWeekReset(entry)) {
    if (
      entry.layer !== 'school' ||
      entry.from !== entry.to ||
      entry.half !== undefined ||
      entry.levels !== undefined ||
      entry.grades !== undefined ||
      entry.adds !== undefined ||
      entry.follows !== undefined ||
      entry.takes !== undefined ||
      entry.replaces !== undefined
    )
      throw new RangeError('An A/B reset covers one school week');
    if (context.calendar.weekOf(entry.from, context.state.schools.get(entry.schoolId!)!) === null)
      throw new RangeError('A holiday week has no letter');
    return { kind: 'calendar.set', entry: { ...entry, source: entry.source.trim() } };
  }
  if (entry.effect === 'adds-sessions') {
    if (
      entry.layer !== 'school' ||
      entry.from !== entry.to ||
      entry.adds === undefined ||
      entry.follows === undefined ||
      entry.takes === undefined ||
      entry.half !== undefined
    )
      throw new RangeError('An added day needs its sessions');
    const event = addSessionsDay(context, {
      id: entry.id,
      schoolId: entry.schoolId!,
      day: entry.from,
      adds: entry.adds,
      follows: entry.follows,
      takes: entry.takes,
      ...(entry.replaces !== undefined && { replaces: entry.replaces }),
      name: entry.name,
      source: entry.source,
      confidence: entry.confidence,
    });
    if (event.kind !== 'calendar.set') throw new RangeError('Invalid added day');
    return { kind: 'calendar.set', entry: { ...entry, ...event.entry } };
  }
  if (
    !['closure', 'marker'].includes(entry.effect) ||
    entry.adds !== undefined ||
    entry.follows !== undefined ||
    entry.takes !== undefined ||
    entry.replaces !== undefined
  )
    throw new RangeError('Unsupported local entry');
  if (entry.layer === 'zone' && entry.effect !== 'closure') throw new RangeError('Only a closure covers a zone');
  return { kind: 'calendar.set', entry: { ...entry, name: { ...entry.name }, source: entry.source.trim() } };
}

/** Cancels a local entry under its actual layer; every earlier version stays in history. */
export function cancelCalendarEntry(context: Context, id: string): CalendarMutation {
  const entry = cancellableCalendarEntry(context, id);
  if (entry === null) throw new RangeError('No editable local entry');
  return { kind: 'calendar.removed', id, layer: entry.layer };
}

/** A stale lunar confirmation can be withdrawn, even after its reference changes. */
export function cancellableCalendarEntry(context: Context, id: string): CalendarEntry | null {
  const entry = context.state.calendar.find((one) => one.id === id);
  if (entry?.received !== undefined && (entry.layer === 'school' || entry.layer === 'zone')) return entry;
  return entry?.confirmedFrom !== undefined && entry.layer === 'national' ? entry : editableCalendarEntry(context, id);
}

/** A/B resets affect all the school's alternating slots, never the teacher's private layer. */
export function isWeekReset(entry: CalendarEntry): boolean {
  return entry.effect === 'week-a' || entry.effect === 'week-b';
}
