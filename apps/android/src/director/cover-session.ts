// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the director's cover page reads and keeps in a demo world (#586,
// D-Cover, §7.7, R-7.7-03 to R-7.7-06, answer 614). Reading holds the school
// key, whose space names the school, and takes the world's day's sessions from
// the version the director published that is in force on it, the latest for
// that one day or else the latest standing one from that day on, each by its
// session ID in the space, as proposals name them; a cover kept for a session
// no longer there is left out. A class's last session of the day, of a week
// that meets it, is the only one whose pupils may be let go. The free
// colleagues of a session are the staff list's teachers, in its order, with no
// session of that version at that time, other than its own teacher, none whose
// session is marked for cover that day, and none already taking another session
// at that time; the suggestion is the one who gave the fewest covers this term,
// the first on a tie, and the director chooses; someone a cover names who is no
// longer free at its time, as when their own session is marked later or they
// take two sessions at once, is to choose again. The term is the one holding
// the world's date, and its log counts every teacher of the staff list in its
// order, between terms none. Keeping records the cover in the director's world
// store for the world's date (school-cover.ts), never on the server: an
// arrangement, with who takes it only when someone does, or none to unmark.

import {
  compareDays,
  coverLog,
  coverOn,
  coverSuggestion,
  keptVersions,
  sessionId,
  TAKEN_ARRANGEMENTS,
  timetableNameKey,
  weekday,
  type CoverArrangement,
  type Day,
  type DemoSchool,
  type ImportedSession,
  type SchoolCover,
  type SchoolYear,
  type Term,
  type TimetablePublished,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { termOn } from '../week/school-mine-session';
import { holdSchool } from './issue-session';

type CoverWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;
type Staff = Pick<DemoSchool, 'teachers'>;

/** A teacher of the staff list with the covers they gave this term. */
export interface CoverPerson {
  readonly id: string;
  readonly name: string;
  readonly count: number;
}

/** A session of the world's day in the version in force, with its cover if marked. */
export interface CoverSession {
  readonly id: string;
  readonly session: Omit<ImportedSession, 'row'>;
  /** Whether it is the class's last session of the day, the only one whose pupils may be let go. */
  readonly last: boolean;
  /** The staff list's teachers free at its time, other than its own teacher, in the staff list's order. */
  readonly free: readonly CoverPerson[];
  /** The free teacher who gave the fewest covers this term, or null when none is free. */
  readonly suggested: string | null;
  readonly cover: SchoolCover | null;
  /** Who the cover names when they are no longer free at its time, to choose again, or null. */
  readonly taken: CoverPerson | null;
}

/** The cover page's reading: the version in force, the day's sessions, the term and its log. */
export interface CoverDay {
  readonly space: string;
  readonly version: TimetablePublished | null;
  readonly sessions: readonly CoverSession[];
  readonly term: Term | null;
  /** Every teacher of the staff list with the covers they gave this term, in the staff list's order. */
  readonly log: readonly CoverPerson[];
}

type Session = Omit<ImportedSession, 'row'>;

const weeks = (a: Session, b: Session) => a.week === 'both' || b.week === 'both' || a.week === b.week;
const meet = (a: Session, b: Session) => a.day === b.day && a.start < b.end && b.start < a.end && weeks(a, b);

/** The version in force on a day: the latest for that one day, or else the latest standing one from that day on. */
export function versionOn(versions: readonly TimetablePublished[], day: Day): TimetablePublished | null {
  const latest = [...versions].reverse();
  return (
    latest.find((one) => one.once && one.from === day) ??
    latest.find((one) => !one.once && compareDays(one.from, day) <= 0) ??
    null
  );
}

/** Reads the cover page for the world's date, holding the school key, which names the school's space. */
export async function readCover(
  world: CoverWorld,
  school: Staff,
  year: SchoolYear,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<CoverDay> {
  const space = (await holdSchool(world, kit, send, false)).held.school;
  const version = versionOn(keptVersions(world.book.entries, space), world.date);
  const all = version?.sessions ?? [];
  const today = all.filter((one) => one.day === weekday(world.date));
  const ids = await kitStep(() => Promise.all(today.map((one) => sessionId(space, { ...one, row: 0 }, kit.mac))));
  const term = termOn(year, world.date);
  const counts = term === null ? new Map<string, number>() : coverLog(world.book.entries, space, term.from, term.to);
  const log = school.teachers.map((one) => ({ id: one.id, name: one.name, count: counts.get(one.id) ?? 0 }));
  const names = (one: Staff['teachers'][number]) =>
    new Set([one.name, one.latinName].map(timetableNameKey).filter((name) => name !== ''));
  const teaching = (person: Staff['teachers'][number], one: Session) =>
    names(person).has(timetableNameKey(one.teacher));
  const marked = coverOn(world.book.entries, space, world.date);
  const cover = (one: Session, at: number) => marked.get(ids[at]) ?? null;
  const away = new Set(
    school.teachers.filter((person) => today.some((one, at) => teaching(person, one) && cover(one, at) !== null)),
  );
  const busy = (person: Staff['teachers'][number], one: Session) =>
    away.has(person) ||
    all.some((other) => teaching(person, other) && meet(one, other)) ||
    today.some((other, at) => cover(other, at)?.by === person.id && meet(one, other) && other !== one);
  const sessions = today.map((one, at): CoverSession => {
    const free = school.teachers
      .filter((person) => !teaching(person, one) && !busy(person, one))
      .map((person) => log.find((each) => each.id === person.id)!);
    const sameClass = (other: Session) => timetableNameKey(other.class) === timetableNameKey(one.class);
    const by = cover(one, at)?.by ?? null;
    return {
      id: ids[at],
      session: one,
      last: !today.some((other) => sameClass(other) && weeks(one, other) && other.start >= one.end),
      free,
      suggested: coverSuggestion(
        free.map((person) => person.id),
        counts,
      ),
      cover: cover(one, at),
      taken:
        by === null || free.some((person) => person.id === by) ? null : (log.find((each) => each.id === by) ?? null),
    };
  });
  return { space, version, sessions, term, log };
}

/** Records a session's cover on the world's date: an arrangement, with who takes it when someone does, or none. */
export async function markCover(
  world: CoverWorld,
  space: string,
  session: string,
  arrangement: CoverArrangement | null,
  by: string | null = null,
): Promise<void> {
  const taken = arrangement !== null && TAKEN_ARRANGEMENTS.includes(arrangement);
  const cover: SchoolCover = { school: space, day: world.date, session, arrangement, by: taken ? by : null };
  await world.book.record(world.date, { kind: 'school.cover', cover });
}
