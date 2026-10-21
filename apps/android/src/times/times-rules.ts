// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind Settings-times (#29): which school and level the times
// are for, the teacher's shift, and a time as the teacher types it. Ramadan
// is the calendar's, with the first day the teacher confirmed on the
// sighting and the lengths announced with it (answers 318, 319).

import {
  bellTimes,
  CLOCK,
  clockMinutes,
  effectiveCalendar,
  ramadanOn,
  type BellData,
  type BellTime,
  type CalendarEntry,
  type Day,
  type School,
  type Shift,
  type Slot,
  type State,
} from '@minhajna/core';

/** The schools that have classes, in the order they were added, or every school when none has. */
export function timesSchools(state: State): School[] {
  const schools = [...state.schools.values()];
  const taught = schools.filter((school) =>
    [...state.classes.values()].some((schoolClass) => schoolClass.schoolId === school.id),
  );
  return taught.length > 0 ? taught : schools;
}

/** A school's first level, which its times follow. */
export function levelOf(school: School): string | undefined {
  return school.levels[0];
}

/** The shift of the latest week drawn. */
export function shiftOf(state: State): Shift {
  return state.timetables.at(-1)?.version.options?.doubleShift ? 'double' : 'single';
}

/** A time as typed, such as «8:15», «08.15», «8h15» or «٨:١٥», written HH:MM; null when it is not a time of day. */
export function readClock(text: string): string | null {
  const western = text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) & 0xf));
  const match = /^\s*(\d{1,2})\s*[:.hH،٫]\s*(\d{2})\s*$/.exec(western);
  if (match === null) return null;
  const [, hours = '', minutes = ''] = match;
  const clock = `${hours.padStart(2, '0')}:${minutes}`;
  return CLOCK.test(clock) ? clock : null;
}

/** Both ends as HH:MM, the end after the start; null otherwise. */
export function readSpan(from: string, to: string): { readonly from: string; readonly to: string } | null {
  const start = readClock(from);
  const end = readClock(to);
  if (start === null || end === null || clockMinutes(end) <= clockMinutes(start)) return null;
  return { from: start, to: end };
}

/** A session's bell time at its school on its day, Ramadan's when it falls then; null when no template or own time gives one. */
export function sessionTime(
  data: { readonly bells: BellData; readonly calendar: readonly CalendarEntry[]; readonly state: State },
  school: School | undefined,
  slot: Slot,
  day: Day,
): BellTime | null {
  if (school === undefined) return null;
  const ramadan = ramadanOn(calendarEntries(data), day);
  const hours = ramadan === null ? 'usual' : 'ramadan';
  return bellTimes(data.bells, school, levelOf(school) ?? '', shiftOf(data.state), hours, [slot], ramadan)[0] ?? null;
}

interface Kept {
  readonly calendar: readonly CalendarEntry[];
  readonly updatedIds: readonly string[] | undefined;
  readonly entries: readonly CalendarEntry[];
}

const seen = new WeakMap<State, Kept>();

/** The calendar's entries with the teacher's own, a confirmed lunar date in place of the expected one; kept per state. */
export function calendarEntries(data: {
  readonly calendar: readonly CalendarEntry[];
  readonly state: State;
  readonly updatedIds?: readonly string[];
}): readonly CalendarEntry[] {
  const kept = seen.get(data.state);
  if (kept !== undefined && kept.calendar === data.calendar && kept.updatedIds === data.updatedIds) return kept.entries;
  const entries = effectiveCalendar(data.calendar, data.state.calendar, data.updatedIds ?? []);
  seen.set(data.state, { calendar: data.calendar, updatedIds: data.updatedIds, entries });
  return entries;
}
