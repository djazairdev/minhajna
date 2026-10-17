// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind Settings-times (#29): which school and level the times
// are for, the teacher's shift, and a time as the teacher types it.

import { CLOCK, clockMinutes, type School, type Shift, type State } from '@minhajna/core';

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

/** A time as typed, such as «8:15», «08.15» or «8h15», written HH:MM; null when it is not a time of day. */
export function readClock(text: string): string | null {
  const match = /^\s*(\d{1,2})\s*[:.hH]\s*(\d{2})\s*$/.exec(text);
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
