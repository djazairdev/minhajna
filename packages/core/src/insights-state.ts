// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where the opt-in insights stand for a teacher in a demo world (#624, §1.6,
// §8.4, choice D6, answer 695). They run only in a teachers' world, in teacher
// mode before the national system, where they are off until the teacher turns
// them on. A national world never runs them: until its totals exist, the
// classes of every school space this device kept a joining key for are stopped
// from the world's date that key's certificate was given, since a class leaves
// the observatory as soon as its school's space opens (R-8.4-05); once the
// world's date reaches the first day totals are formed, the first announced day
// after the first term's end in the bundled calendar or the one the world
// published, whichever comes first, the insights are retired and the curriculum
// report replaces them (R-1.6-10, R-4.9-04). Real mode has no insights in
// 0.7.0, so nothing here reads the teacher's own records.

import { compareDays, type Day } from './day.ts';
import type { SchoolJoined } from './device-events.ts';
import type { CalendarEntry, SchoolYear } from './reference.ts';
import { readJoinCode } from './school-join.ts';
import { announcedDaysOf } from './world-calendar.ts';
import type { WorldKind } from './world-keys.ts';

/** A school's space this device joined, for an assignment, from the world's date its certificate was given. */
export interface SpaceJoin {
  readonly school: string;
  readonly assignment: string;
  readonly since: Day;
}

/** The insights' state: offered in a teachers' world, stopped for a school's classes, or retired. */
export type InsightsState =
  | { readonly kind: 'teacher' }
  | { readonly kind: 'school'; readonly joins: readonly SpaceJoin[] }
  | { readonly kind: 'retired'; readonly since: Day };

/** The first day totals above the school are formed: the first announced day after the first term's end, or null. */
export function totalsFrom(year: SchoolYear, entries: readonly CalendarEntry[]): Day | null {
  const first = year.terms[0];
  if (first === undefined) return null;
  return announcedDaysOf(year, entries, first.to)[0] ?? null;
}

/** The spaces joined, one for each school and assignment, at the earliest day, in the order they were joined. */
function spaceJoins(joins: readonly SchoolJoined[]): SpaceJoin[] {
  const found = new Map<string, SpaceJoin>();
  for (const join of joins) {
    const code = readJoinCode(join.code);
    if (code === null) continue;
    const key = JSON.stringify([code.school, code.assignment]);
    const since = join.certificate.issued;
    const kept = found.get(key);
    if (kept === undefined || compareDays(since, kept.since) < 0) {
      found.set(key, { school: code.school, assignment: code.assignment, since });
    }
  }
  return [...found.values()].sort((a, b) => compareDays(a.since, b.since));
}

/** The earliest first totals day of any of a world's calendars, such as the bundled one and the one it published. */
export function firstTotalsDay(
  calendars: readonly { readonly year: SchoolYear; readonly entries: readonly CalendarEntry[] }[],
): Day | null {
  const days = calendars.flatMap(({ year, entries }) => totalsFrom(year, entries) ?? []);
  return days.sort(compareDays)[0] ?? null;
}

/** The insights' state for a world of a kind on its date, from the joins its store keeps and its calendars. */
export function insightsState(
  kind: WorldKind,
  date: Day,
  joins: readonly SchoolJoined[],
  calendars: readonly { readonly year: SchoolYear; readonly entries: readonly CalendarEntry[] }[],
): InsightsState {
  if (kind === 'teachers') return { kind: 'teacher' };
  const since = firstTotalsDay(calendars);
  if (since !== null && compareDays(since, date) <= 0) return { kind: 'retired', since };
  return { kind: 'school', joins: spaceJoins(joins) };
}
