// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Bell times (#29, PRD §4.5, §4.6). A timetable entry names a slot, and its
// time comes from here: the level's template for the teacher's shift, or the
// time the teacher set to match the school's bell. On Ramadan's days, taken
// from the calendar, each session keeps its start time and its place and is
// shortened to the level's Ramadan length, unless the school's own Ramadan
// time is set. The timetable never changes, and a shortened session still
// counts as one (PRD §4.5).

import { compareDays, isWithin, type Day } from './day.ts';
import type { Confidence, CalendarEntry } from './reference.ts';
import type { School, SchoolBells, Slot, SlotTime } from './records.ts';

/** HH:MM, from 00:00 to 23:59. */
export const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A double shift has its own template where the level has one; otherwise each half-day keeps its times. */
export const SHIFTS = ['single', 'double'] as const;

export type Shift = (typeof SHIFTS)[number];

/** A slot's times, without the slot. */
export interface ClockSpan {
  readonly from: string;
  readonly to: string;
}

/** The usual times of one level and shift: slot 1 first in each half-day. */
export interface BellTemplate {
  readonly level: string;
  readonly shift: Shift;
  readonly morning: readonly ClockSpan[];
  readonly afternoon: readonly ClockSpan[];
  /** Where the times come from, or that no official text gives them. */
  readonly source: string;
}

/** How long a level's session lasts in Ramadan. */
export interface RamadanLength {
  readonly level: string;
  readonly minutes: number;
  readonly source: string;
  readonly confidence: Confidence;
}

/** One release of a country's bell times, received as reference data (PRD §4.8). */
export interface BellData {
  readonly country: string;
  readonly release: string;
  readonly templates: readonly BellTemplate[];
  readonly ramadan: readonly RamadanLength[];
}

/** The usual times, or Ramadan's. */
export type Hours = 'usual' | 'ramadan';

/** A slot's time, and where it comes from: the template, the school as the teacher set it, or the Ramadan rule. */
export interface BellTime extends ClockSpan {
  readonly slot: Slot;
  readonly by: 'template' | 'school' | 'ramadan-rule';
}

export function clockMinutes(clock: string): number {
  return Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3, 5));
}

export function clockOf(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

const isRamadan = (entry: CalendarEntry) => entry.times === 'ramadan';

/** The Ramadan entry covering a day, if any. */
export function ramadanOn(entries: readonly CalendarEntry[], day: Day): CalendarEntry | null {
  return entries.find((entry) => isRamadan(entry) && isWithin(day, entry.from, entry.to)) ?? null;
}

/** The Ramadan entry covering a day, or the next one to come. */
export function nextRamadan(entries: readonly CalendarEntry[], day: Day): CalendarEntry | null {
  const coming = entries
    .filter((entry) => isRamadan(entry) && compareDays(entry.to, day) >= 0)
    .sort((a, b) => compareDays(a.from, b.from));
  return coming[0] ?? null;
}

/** Which times apply on a day. */
export function hoursOn(entries: readonly CalendarEntry[], day: Day): Hours {
  return ramadanOn(entries, day) === null ? 'usual' : 'ramadan';
}

/** The level's template for the shift, or its single-shift one. */
export function templateFor(data: BellData, level: string, shift: Shift): BellTemplate | null {
  const ofLevel = data.templates.filter((template) => template.level === level);
  return (
    ofLevel.find((template) => template.shift === shift) ??
    ofLevel.find((template) => template.shift === 'single') ??
    null
  );
}

/**
 * A level's Ramadan session length: the one announced with the Ramadan entry,
 * with the hours' own confidence and the source of the entry that announced
 * them, never a sighting's, or the bell data's.
 */
export function ramadanLength(data: BellData, level: string, entry: CalendarEntry | null = null): RamadanLength | null {
  const announced = entry?.hours?.lengths.find((length) => length.level === level);
  if (entry?.hours !== undefined && announced !== undefined) {
    const source =
      entry.confirmedFrom === undefined ? entry.source : (JSON.parse(entry.confirmedFrom) as CalendarEntry).source;
    return { level, minutes: announced.minutes, source, confidence: entry.hours.confidence };
  }
  return data.ramadan.find((length) => length.level === level) ?? null;
}

const timeAt = (times: readonly SlotTime[] | undefined, slot: Slot) =>
  times?.find((time) => time.half === slot.half && time.index === slot.index);

/** A slot's usual time: the school's, as the teacher set it, or the template's. Null when neither has one. */
function usualTime(template: BellTemplate | null, school: School, slot: Slot): BellTime | null {
  const own = timeAt(school.bells?.usual, slot);
  if (own !== undefined) return { slot, from: own.from, to: own.to, by: 'school' };
  const span = template?.[slot.half][slot.index - 1];
  return span === undefined ? null : { slot, from: span.from, to: span.to, by: 'template' };
}

/**
 * Each slot's time at a school, for the level and shift, in the usual hours or Ramadan's, with the lengths announced
 * with `ramadan` when it has them. Null for a slot with no time, such as one past the template's end. In Ramadan, a
 * level with no Ramadan length yet keeps its usual times (answer 320).
 */
export function bellTimes(
  data: BellData,
  school: School,
  level: string,
  shift: Shift,
  hours: Hours,
  slots: readonly Slot[],
  ramadan: CalendarEntry | null = null,
): (BellTime | null)[] {
  const template = templateFor(data, level, shift);
  const length = ramadanLength(data, level, ramadan);
  return slots.map((slot) => {
    if (hours === 'usual') return usualTime(template, school, slot);
    const own = timeAt(school.bells?.ramadan, slot);
    if (own !== undefined) return { slot, from: own.from, to: own.to, by: 'school' };
    const usual = usualTime(template, school, slot);
    if (usual === null || length === null) return usual;
    const end = Math.min(clockMinutes(usual.from) + length.minutes, clockMinutes(usual.to));
    return { slot, from: usual.from, to: clockOf(end), by: 'ramadan-rule' };
  });
}

/** The school with one slot's own time set, or cleared with `null`, so the template's applies again. */
export function withSlotTime(school: School, hours: Hours, slot: Slot, span: ClockSpan | null): School {
  const others = (school.bells?.[hours] ?? []).filter((time) => time.half !== slot.half || time.index !== slot.index);
  const times = span === null ? others : [...others, { half: slot.half, index: slot.index, ...span }];
  const bells: { -readonly [Key in keyof SchoolBells]: SchoolBells[Key] } = { ...school.bells };
  if (times.length === 0) delete bells[hours];
  else bells[hours] = times;
  const next: { -readonly [Key in keyof School]: School[Key] } = { ...school };
  if (Object.keys(bells).length === 0) delete next.bells;
  else next.bells = bells;
  return next;
}
