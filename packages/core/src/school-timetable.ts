// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The versions of a school's timetable a director's device published in a demo
// world (#578, answer 606), as its store keeps them: each with its number, its
// first day, whether it is for one day, and its sessions as read or entered,
// their names cleaned as a part's are and only those that read. A version that
// does not read is left out, and of two with one number the first is kept. The
// next version takes one more than the highest kept; the standing version,
// which a new one is drafted from, is the highest not for one day.

import { isDay } from './day.ts';
import type { TimetablePublished } from './device-events.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { SCHOOL } from './school-key-shape.ts';
import { clean, DAY_MINUTES, named, record, whole } from './timetable-record.ts';
import type { ImportedSession } from './timetable-import.ts';

export type { TimetablePublished } from './device-events.ts';

const MOST = 999_999_999;
const MOST_SESSIONS = 2000;

function isSession(value: unknown): value is TimetablePublished['sessions'][number] {
  if (!record(value)) return false;
  const { class: of, group, subject, teacher, room, day, start, end, week, ...rest } = value;
  if (Object.keys(rest).length > 0 || !named(of) || !named(group, true) || !named(subject)) return false;
  if (!named(teacher) || !named(room, true) || !whole(day, 0, 6)) return false;
  const timed = whole(start, 0, DAY_MINUTES) && whole(end, 0, DAY_MINUTES) && start < end;
  return timed && ['both', 'A', 'B'].includes(week as string);
}

/**
 * A timetable's sessions as a version keeps them: without the rows they were
 * read from, their names without hidden characters, as a part's are, and only
 * those that read, at most 2000.
 */
export function publishedSessions(sessions: readonly ImportedSession[]): TimetablePublished['sessions'] {
  const kept = sessions.map((one) => {
    const { day, start, end, week } = one;
    const [of, group, subject, teacher, room] = [one.class, one.group, one.subject, one.teacher, one.room].map(clean);
    return { class: of, group, subject, teacher, room, day, start, end, week };
  });
  return kept.filter(isSession).slice(0, MOST_SESSIONS);
}

/** A published version as the store may keep it, or null when it does not read. */
export function readTimetablePublished(value: unknown): TimetablePublished | null {
  if (!record(value)) return null;
  const { school, version, from, once, sessions, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof school !== 'string' || !SCHOOL.test(school)) return null;
  if (!whole(version, 1, MOST) || typeof from !== 'string' || !isDay(from) || typeof once !== 'boolean') return null;
  if (!Array.isArray(sessions) || sessions.length > MOST_SESSIONS || !sessions.every(isSession)) return null;
  return { school, version, from, once, sessions };
}

/** The versions of a school's timetable this store keeps, by number, the first of each that reads. */
export function keptVersions(entries: readonly Entry[], school: string): TimetablePublished[] {
  const found = new Map<number, TimetablePublished>();
  for (const entry of entries) {
    const event = eventOf(entry);
    if (event?.kind !== 'school.timetable') continue;
    const read = readTimetablePublished(event.published);
    if (read !== null && read.school === school && !found.has(read.version)) found.set(read.version, read);
  }
  return [...found.values()].sort((a, b) => a.version - b.version);
}

/** The number the next version takes: one more than the highest kept. */
export const nextVersion = (versions: readonly TimetablePublished[]): number => (versions.at(-1)?.version ?? 0) + 1;

/** The standing version a new one is drafted from: the highest not for one day, or null before the first. */
export const standingVersion = (versions: readonly TimetablePublished[]): TimetablePublished | null =>
  [...versions].reverse().find((one) => !one.once) ?? null;
