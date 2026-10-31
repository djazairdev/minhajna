// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sessions of a teacher's part of the timetable (#577, answer 605): the
// timetable's teachers under the first spelling of their names; each session
// with an ID worked out from the school's space and its class, group, subject,
// day, times and week, compared as the timetable compares names, so an
// unchanged session keeps its ID across versions, a moved one gets a new one,
// and a room change or a reassignment keeps it; and a teacher's sessions in one
// order every device writes the same way, by day, start, class, group, week and
// ID, their names without format marks or other hidden characters.

import { toHex } from './id.ts';
import { ascii, ID } from './school-key-shape.ts';
import { asciiJson } from './sealed-stream.ts';
import { clean, DAY_MINUTES, named, record, whole } from './timetable-record.ts';
import { timetableNameKey, type ImportedSession, type TimetableWeek } from './timetable-import.ts';
import type { Weekday } from './day.ts';
import type { WorldMac } from './world-keys.ts';

/** A session of a teacher's part, with its stable ID. */
export interface PartSession {
  readonly id: string;
  readonly class: string;
  /** Empty for the whole class. */
  readonly group: string;
  readonly subject: string;
  readonly day: Weekday;
  /** Minutes from midnight. */
  readonly start: number;
  readonly end: number;
  /** Empty when the timetable gives none. */
  readonly room: string;
  readonly week: TimetableWeek;
}

/** Whether a value is a part's session, its fields only, each of its shape. */
export function isPartSession(value: unknown): value is PartSession {
  if (!record(value)) return false;
  const { id, class: of, group, subject, day, start, end, room, week, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof id !== 'string' || !ID.test(id)) return false;
  if (!named(of) || !named(group, true) || !named(subject) || !named(room, true) || !whole(day, 0, 6)) return false;
  return (
    whole(start, 0, DAY_MINUTES) &&
    whole(end, 0, DAY_MINUTES) &&
    start < end &&
    ['both', 'A', 'B'].includes(week as string)
  );
}

/** A session's ID in a school: worked out from the school's space and what makes it the same session. */
export async function sessionId(school: string, session: ImportedSession, mac: WorldMac): Promise<string> {
  const { day, start, end, week } = session;
  const parts = [session.class, session.group, session.subject].map(timetableNameKey);
  const made = await mac(
    ascii(school),
    ascii(asciiJson(['minhajna/timetable/session', ...parts, day, start, end, week])),
  );
  return toHex(made.subarray(0, 16));
}

/** The timetable's teachers, each under the first spelling of their name, with their sessions in the order read. */
export function teachersOf(sessions: readonly ImportedSession[]): ReadonlyMap<string, readonly ImportedSession[]> {
  const found = new Map<string, { name: string; sessions: ImportedSession[] }>();
  for (const one of sessions) {
    const at = timetableNameKey(one.teacher);
    const kept = found.get(at) ?? { name: clean(one.teacher), sessions: [] };
    kept.sessions.push(one);
    found.set(at, kept);
  }
  return new Map([...found.values()].map(({ name, sessions: theirs }) => [name, theirs]));
}

/**
 * A teacher's sessions as their part carries them, with their IDs and their names without hidden characters, by day,
 * then start, class, group and week as the timetable compares names, then ID. Sessions that differ only in their room
 * are one session, the first kept.
 */
export async function partSessions(
  school: string,
  sessions: readonly ImportedSession[],
  mac: WorldMac,
): Promise<PartSession[]> {
  const made: PartSession[] = [];
  for (const one of sessions) {
    const { group, subject, day, start, end, room, week } = one;
    const names = { class: clean(one.class), group: clean(group), subject: clean(subject), room: clean(room) };
    made.push({ id: await sessionId(school, { ...one, ...names }, mac), ...names, day, start, end, week });
  }
  const seen = new Set<string>();
  return made.filter((one) => !seen.has(one.id) && Boolean(seen.add(one.id))).sort(bySession);
}

/** The order a part's sessions take: by day, start, class and group as the timetable compares names, week, then ID. */
export function bySession(a: PartSession, b: PartSession): number {
  const order = (one: string, other: string) => (one < other ? -1 : one > other ? 1 : 0);
  const by = (one: PartSession) => [one.class, one.group].map(timetableNameKey).concat(one.week, one.id);
  return a.day - b.day || a.start - b.start || by(a).reduce((was, one, at) => was || order(one, by(b)[at]!), 0);
}
