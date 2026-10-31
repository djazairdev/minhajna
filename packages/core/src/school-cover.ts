// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A director's cover for a teacher's session on one day (#586, Cover, §7.7,
// R-7.7, answer 614), kept in the director's world store under its school, day
// and session: the arrangement, supervision first as the default, and for
// supervision, guided study or a colleague the staff list ID of whoever takes
// it, once chosen, with no reason, no clock time and no name; a later cover for
// the same session and day replaces the earlier one, and one without an
// arrangement unmarks it. Read back are the sessions marked on a day, how many
// covers each person gave between two days, and, of the people free for a
// session in the staff list's order, the one who gave the fewest, the first of
// them on a tie.

import { compareDays, isDay, type Day } from './day.ts';
import type { CoverArrangement, SchoolCover } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { ID, SCHOOL } from './school-key-shape.ts';
import { record } from './timetable-record.ts';

export type { CoverArrangement, SchoolCover } from './device-events.ts';

/** The arrangements, supervision first as the default (R-7.7-04). */
export const COVER_ARRANGEMENTS: readonly CoverArrangement[] = [
  'supervision',
  'study',
  'merge',
  'swap',
  'colleague',
  'release',
];

/** The arrangements in which someone takes the session. */
export const TAKEN_ARRANGEMENTS: readonly CoverArrangement[] = ['supervision', 'study', 'colleague'];

/** A teacher's ID in a demo school's staff list: lowercase letters and digits in words joined by hyphens. */
const PERSON = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** A cover as the store may keep it, or null when it does not read. */
export function readSchoolCover(value: unknown): SchoolCover | null {
  if (!record(value)) return null;
  const { school, day, session, arrangement, by, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  if (typeof day !== 'string' || !isDay(day) || typeof session !== 'string' || !ID.test(session)) return null;
  const known = arrangement === null || COVER_ARRANGEMENTS.includes(arrangement as CoverArrangement);
  const taken = arrangement !== null && TAKEN_ARRANGEMENTS.includes(arrangement as CoverArrangement);
  const person = by === null || (taken && typeof by === 'string' && by.length <= 64 && PERSON.test(by));
  if (!known || !person) return null;
  return { school, day, session, arrangement: arrangement as CoverArrangement | null, by };
}

/** Each session's latest cover on each day for a school, the last recorded last, the unmarked ones included. */
function latest(entries: readonly Entry[], school: string): Map<string, SchoolCover> {
  const found = new Map<string, SchoolCover>();
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'school.cover' ? readSchoolCover(event.cover) : null;
    if (read === null || read.school !== school) continue;
    const key = `${read.day}\n${read.session}`;
    found.delete(key);
    found.set(key, read);
  }
  return found;
}

/** The sessions marked for cover on a day, by session ID, each with its latest arrangement. */
export function coverOn(entries: readonly Entry[], school: string, day: Day): ReadonlyMap<string, SchoolCover> {
  const marked = [...latest(entries, school).values()].filter((one) => one.day === day && one.arrangement !== null);
  return new Map(marked.map((one) => [one.session, one]));
}

/** How many covers each person gave from one day to another, both included, by staff list ID. */
export function coverLog(entries: readonly Entry[], school: string, from: Day, to: Day): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const one of latest(entries, school).values()) {
    const within = compareDays(from, one.day) <= 0 && compareDays(one.day, to) <= 0;
    if (one.arrangement === null || one.by === null || !within) continue;
    counts.set(one.by, (counts.get(one.by) ?? 0) + 1);
  }
  return counts;
}

/** Of the people who could take a session, in the staff list's order, the one who gave the fewest covers, or null. */
export function coverSuggestion(people: readonly string[], log: ReadonlyMap<string, number>): string | null {
  let best: string | null = null;
  for (const one of people) if (best === null || (log.get(one) ?? 0) < (log.get(best) ?? 0)) best = one;
  return best;
}
