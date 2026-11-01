// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The inspector's spot-check sheet (#594, I-Grant, §7.2, R-7.2-06, answer 622).
// The first time it is opened for a grant, three days are drawn at random, each
// as likely as another (statement-spot.ts), among the days with a signed
// session held in the weeks the grant opens, each course's week at its version
// in force, or every such day when there are fewer; they are kept, with the
// inspector's notes, in the world's store on the inspector's phone, so they are
// not known before the visit and stay the same after it. Each day's rows are
// its held sessions, by day, then start, then class, subject and group, and the
// inspector's note on what the pupils' exercise books show for a row is kept
// under that row's key. A sheet is kept under its grant, the latest counting; a
// sheet that does not read, or names more days, longer notes or notes on more
// rows than it may, is left out, as is one that keeps two notes for a row or a
// note under a key that is not a row's. A kept sheet with fewer than three
// days, as when no week's archive read at first, is topped up from the days
// read later, the days and notes kept staying. Nothing here leaves the
// phone.

import type { Day } from './day.ts';
import { compareDays, isDay } from './day.ts';
import type { SpotSheet } from './device-events.ts';
import { sessionDay, weeksInForce } from './course-delivery.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import { ID } from './school-key-shape.ts';
import { drawSpotDays, SPOT_DAYS } from './statement-spot.ts';
import type { RandomBytes } from './id.ts';
import { DAY_MINUTES, NAME_MOST, record } from './timetable-record.ts';
import type { WeekRecord } from './week-record.ts';

export type { SpotSheet } from './device-events.ts';

/** The most characters a note may hold. */
export const SPOT_NOTE_MOST = 2000;
/** The most rows a sheet keeps a note for: three days of a full timetable's sessions. */
export const SPOT_BOOKS_MOST = 256;

/** One held session of a drawn day, as the sheet shows it. */
export interface SpotRow {
  readonly key: string;
  readonly day: Day;
  readonly course: string;
  readonly class: string;
  readonly subject: string;
  readonly group: string;
  readonly start: number;
  readonly end: number;
}

const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** The kept days, topped up to three with days drawn among the candidates not kept, in order. */
export function topUpSpotDays(kept: readonly Day[], candidates: readonly Day[], random: RandomBytes): Day[] {
  const left = candidates.filter((one) => !kept.includes(one));
  return [...kept, ...drawSpotDays(left, random, Math.max(0, SPOT_DAYS - kept.length))].sort(compareDays);
}

const ROW = /^(\d{4}-\d{2}-\d{2})\n([0-9a-z-]+)\n(\d{1,4})\n([^\n]*)$/u;

/** A row's day, course, start and group from its key, or null when the key is not a row's. */
export function spotRowOf(key: string): Pick<SpotRow, 'day' | 'course' | 'start' | 'group'> | null {
  const found = ROW.exec(key);
  if (found === null) return null;
  const [, day = '', course = '', start = '', group = ''] = found;
  if (!isDay(day) || !ID.test(course) || Number(start) >= DAY_MINUTES || group.length > NAME_MOST) return null;
  return { day, course, start: Number(start), group };
}

/** Each day with a held session in the signed weeks, each course's week at its version in force, in order. */
export function heldDays(weeks: readonly WeekRecord[]): Day[] {
  const days = weeksInForce(weeks).flatMap((week) =>
    week.sessions.filter((one) => one.state === 'held').map((one) => sessionDay(week.week, one)),
  );
  return [...new Set(days)].sort(compareDays);
}

/** The held sessions of the drawn days, each course's week at its version in force. */
export function spotRows(weeks: readonly WeekRecord[], days: readonly Day[]): SpotRow[] {
  const drawn = new Set(days);
  return weeksInForce(weeks)
    .flatMap((week) =>
      week.sessions
        .filter((one) => one.state === 'held' && drawn.has(sessionDay(week.week, one)))
        .map((one) => {
          const day = sessionDay(week.week, one);
          const { course } = week;
          const { group, start, end } = one;
          const key = `${day}\n${course}\n${start}\n${group}`;
          return { key, day, course, class: week.class, subject: week.subject, group, start, end };
        }),
    )
    .sort(
      (a, b) =>
        compareDays(a.day, b.day) ||
        a.start - b.start ||
        byText(a.class, b.class) ||
        byText(a.subject, b.subject) ||
        byText(a.group, b.group),
    );
}

const note = (value: unknown): value is string => typeof value === 'string' && value.length <= SPOT_NOTE_MOST;

/** A sheet as the store may keep it, or null when it does not read. */
export function readSpotSheet(value: unknown): SpotSheet | null {
  if (!record(value)) return null;
  const { grant, days, notes, books, ...rest } = value;
  if (Object.keys(rest).length > 0 || typeof grant !== 'string' || !ID.test(grant) || !note(notes)) return null;
  if (!Array.isArray(days) || days.length > SPOT_DAYS || !Array.isArray(books) || books.length > SPOT_BOOKS_MOST)
    return null;
  const read = days.every((one) => typeof one === 'string' && isDay(one)) && new Set(days).size === days.length;
  const rows =
    books.every(
      (one) =>
        record(one) &&
        Object.keys(one).length === 2 &&
        typeof one['row'] === 'string' &&
        spotRowOf(one['row']) !== null &&
        note(one['note']),
    ) && new Set(books.map((one: { row: string }) => one.row)).size === books.length;
  if (!read || !rows) return null;
  return {
    grant,
    days: [...days],
    notes,
    books: (books as { row: string; note: string }[]).map(({ row, note }) => ({ row, note })),
  };
}

/** The sheet kept for a grant in the world's store, the latest counting, or null before any. */
export function keptSpotSheet(entries: readonly Entry[], grant: string): SpotSheet | null {
  let kept: SpotSheet | null = null;
  for (const entry of entries) {
    const event = eventOf(entry);
    const read = event?.kind === 'inspector.sheet' ? readSpotSheet(event.sheet) : null;
    if (read?.grant === grant) kept = read;
  }
  return kept;
}
