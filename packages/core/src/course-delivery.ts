// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a teacher's signed weeks deliver, course by course (#584, School-mine,
// School-mine-report, §7.5, §7.6, R-7.5-08, R-7.6-01, R-7.6-02, answer 612), as
// the director reads them: from each course's week at the version in force
// (week-record.ts), the highest, the lower text winning a tie, with a session
// in the span, a week the span starts or ends in too, the sessions of the
// span's days alone, each on its day, the week's first day moved on to the
// session's weekday; how many were planned, held as planned, awaiting
// confirmation, and not held, for the calendar when a calendar entry takes the
// session, closing the school that day or that half-day, with that entry, and
// for another cause otherwise, never with a reason; each session not held, in
// the order of its day and start; the number of those signed weeks and the last
// one's first day; and the class and subject as the latest week names them.
// Awaiting is never an absence, and is counted here only for the screen that
// shows it. Courses come in the school's order of their class, which the app
// knows from the timetable, then by class, subject and course in one Arabic
// collation on every device, numbers in names read as numbers; nothing is
// totalled across courses and nothing ranks them.

import { addDays, compareDays, weekday, type Day } from './day.ts';
import type { CalendarEntry } from './reference.ts';
import { weekRecordText, type WeekRecord, type WeekSession } from './week-record.ts';

/** A session not held, on its day, with the calendar entry that took it, or null for another cause. */
export interface LostSession {
  readonly day: Day;
  readonly session: WeekSession;
  readonly entry: CalendarEntry | null;
}

/** A course's delivery over a span, from its signed weeks. */
export interface CourseDelivery {
  readonly course: string;
  /** The class and subject as the latest week names them. */
  readonly class: string;
  readonly subject: string;
  /** How many signed weeks have a session in the span. */
  readonly weeks: number;
  /** The first day of the latest of them. */
  readonly lastWeek: Day;
  readonly planned: number;
  readonly held: number;
  readonly awaiting: number;
  /** Not held, taken by a calendar entry. */
  readonly calendar: number;
  /** Not held for any other cause. */
  readonly other: number;
  readonly lost: readonly LostSession[];
}

/** How the calendar and the school's order are read. */
export interface DeliveryReading {
  /** The calendar entry that takes a session on its day, closing the school or that half-day, or null. */
  readonly takenBy: (day: Day, session: WeekSession) => CalendarEntry | null;
  /** A class's place in the school's order, lower first; classes it does not place follow, by name. */
  readonly classOrder?: (name: string) => number | undefined;
}

/** The day a session of a week falls on, within the six days after the week's first day. */
export const sessionDay = (week: Day, one: Pick<WeekSession, 'day'>): Day =>
  addDays(week, (one.day - weekday(week) + 7) % 7);

const within = (day: Day, from: Day, to: Day) => compareDays(day, from) >= 0 && compareDays(day, to) <= 0;
/** One order of names on every device, whatever its language: Arabic collation, numbers read as numbers. */
const byName = new Intl.Collator('ar', { numeric: true }).compare;

/** Each course and week once: the highest version, the lower text winning a tie as on the channel. */
function inForce(weeks: readonly WeekRecord[]): WeekRecord[] {
  const found = new Map<string, WeekRecord>();
  for (const week of weeks) {
    const key = `${week.course}\n${week.week}`;
    const before = found.get(key);
    const higher = before === undefined || before.version < week.version;
    if (higher || (before.version === week.version && weekRecordText(week) < weekRecordText(before))) {
      found.set(key, week);
    }
  }
  return [...found.values()];
}

/**
 * Each course's delivery from its signed weeks, each course and week once at
 * its version in force, with a session in the span from `from` to `to`,
 * counting the sessions of the span's days alone; a course is placed by its
 * class in the school's order, then by class, subject and course.
 */
export function courseDeliveries(
  weeks: readonly WeekRecord[],
  from: Day,
  to: Day,
  reading: DeliveryReading,
): CourseDelivery[] {
  const found = new Map<string, WeekRecord[]>();
  for (const week of inForce(weeks)) {
    const inSpan = week.sessions.some((one) => within(sessionDay(week.week, one), from, to));
    if (inSpan) found.set(week.course, [...(found.get(week.course) ?? []), week]);
  }
  const place = (name: string) => reading.classOrder?.(name) ?? Number.POSITIVE_INFINITY;
  return [...found.values()]
    .map((list) => {
      const sorted = [...list].sort((a, b) => compareDays(a.week, b.week));
      const latest = sorted.at(-1)!;
      const sessions = sorted.flatMap((week) =>
        week.sessions.map((session) => ({ day: sessionDay(week.week, session), session })),
      );
      const counted = sessions.filter((one) => within(one.day, from, to));
      const lost = counted
        .filter((one) => one.session.state === 'not-held')
        .map((one) => ({ ...one, entry: reading.takenBy(one.day, one.session) }))
        .sort((a, b) => compareDays(a.day, b.day) || a.session.start - b.session.start);
      const count = (state: WeekSession['state']) => counted.filter((one) => one.session.state === state).length;
      return {
        course: latest.course,
        class: latest.class,
        subject: latest.subject,
        weeks: sorted.length,
        lastWeek: latest.week,
        planned: counted.length,
        held: count('held'),
        awaiting: count('awaiting'),
        calendar: lost.filter((one) => one.entry !== null).length,
        other: lost.filter((one) => one.entry === null).length,
        lost,
      };
    })
    .sort(
      (a, b) =>
        place(a.class) - place(b.class) ||
        byName(a.class, b.class) ||
        byName(a.subject, b.subject) ||
        byName(a.course, b.course),
    );
}
