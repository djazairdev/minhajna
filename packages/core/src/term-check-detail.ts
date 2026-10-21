// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The September check line by line, for the sheet printed for an inspector
// (#225, R-4.11-06, answers 296 to 299): how `termCheck`'s sessions add up.
// For the main plan and for TD, the sessions the timetable gives from the
// print day until the exams, then each calendar entry or test that takes
// some, by its first day, and each day that adds some, so the sheet's lines
// add up to the check's own figures. Counted as `termCheck` counts: only
// sessions not yet recorded, a rotation's pair of half-group sessions as
// one, and a session a test takes by the type the timetable gave it. The
// other half-group's sessions in a rotation are not the class's, so they
// are neither given nor taken. A day's added sessions go in before what
// takes sessions comes off, so a test on a make-up day is listed too. An
// entry stays listed when, with half-groups pairing up, it comes to none.

import type { Context } from './context.ts';
import { addDays, compareDays, type Day } from './day.ts';
import { entryCourses } from './joint.ts';
import { termCheck, type TermCheck } from './pacing.ts';
import { findSessionType, QUEUES, type Queue } from './reference.ts';
import { rotationCredits } from './rotation-sessions.ts';
import { sessionsBetween, versionOn, type CalendarMark, type Session } from './sessions.ts';
import { current } from './state.ts';

/** A calendar entry or a test that takes sessions, or a day that adds some. */
export interface CheckChange {
  readonly kind: 'calendar' | 'test' | 'added';
  /** The calendar entry's, the test's or the added day's ID; null for a calendar mark with no entry behind it. */
  readonly id: string | null;
  /** For the calendar: how it takes the sessions. */
  readonly mark?: CalendarMark;
  /** The first day it takes or adds a session on. */
  readonly day: Day;
  readonly sessions: number;
}

export interface QueueDetail {
  /** Sessions the timetable gives, before the calendar and the tests. */
  readonly scheduled: number;
  /** What the calendar and the tests take, by their first day. */
  readonly taken: readonly CheckChange[];
  /** What days adding sessions give, by their first day. */
  readonly added: readonly CheckChange[];
  /** What is left: `scheduled`, less what is taken, plus what is added. */
  readonly left: number;
}

export interface TermCheckDetail {
  readonly check: TermCheck;
  /** The day the sessions are counted from. */
  readonly from: Day;
  /** Sessions a week in the timetable in force on `from`; a slot of A or B weeks counts half. */
  readonly weekly: { readonly all: number; readonly main: number };
  /** Every session the timetable gives the course, before the calendar and the tests, whatever its queue. */
  readonly scheduled: number;
  readonly main: QueueDetail;
  readonly td: QueueDetail;
}

type Taker = Pick<CheckChange, 'kind' | 'id' | 'mark'>;

/** What takes a session, or null when it is still there. */
function takenBy(session: Session): Taker | null {
  if (session.test !== undefined) return { kind: 'test', id: session.test };
  if (session.calendar === null) return null;
  return { kind: 'calendar', id: session.calendarEntry, mark: session.calendar };
}

/** One key for each taker, a mark never mistaken for an entry's ID. */
const takerKey = (taker: Taker | null): string => JSON.stringify([taker?.kind, taker?.id, taker?.mark]);

/** Sessions grouped by what they belong to, in the order of their first day. */
function grouped(sessions: readonly Session[], key: (session: Session) => string): Session[][] {
  const groups = new Map<string, Session[]>();
  for (const session of sessions) groups.set(key(session), [...(groups.get(key(session)) ?? []), session]);
  return [...groups.values()];
}

/** The September check of a course from `from`, line by line; null when `termCheck` gives none. */
export function termCheckDetail(
  context: Context,
  courseId: string,
  from: Day,
  termNumber?: number,
): TermCheckDetail | null {
  const check = termCheck(context, courseId, from, termNumber);
  if (check === null) return null;
  const { state, ref } = context;
  const queueOf = (code: string): Queue => findSessionType(ref.country, code).queue;
  const all =
    compareDays(from, check.before) >= 0
      ? []
      : sessionsBetween(context, ref.year.from, addDays(check.before, -1), new Set([courseId]));
  const isRecorded = (session: Session) => current(state.sessions.get(session.key)) !== null;
  const open = all.filter((session) => compareDays(session.day, from) >= 0 && !isRecorded(session));

  const detail = (queue: Queue): QueueDetail => {
    const recorded = all.filter((session) => isRecorded(session) && queueOf(session.sessionType) === queue);
    const count = (list: readonly Session[]) => rotationCredits([...recorded, ...list]) - rotationCredits(recorded);
    const mine = open.filter(
      (session) => session.calendar !== 'rotation' && queueOf(session.took ?? session.sessionType) === queue,
    );
    let kept = mine.filter((session) => session.added === undefined);
    const scheduled = count(kept);
    const added: CheckChange[] = [];
    for (const group of grouped(
      mine.filter((session) => session.added !== undefined),
      (session) => session.added!,
    )) {
      const more = [...kept, ...group];
      added.push({ kind: 'added', id: group[0]!.added!, day: group[0]!.day, sessions: count(more) - count(kept) });
      kept = more;
    }
    const taken: CheckChange[] = [];
    for (const group of grouped(
      kept.filter((session) => takenBy(session) !== null),
      (session) => takerKey(takenBy(session)),
    )) {
      const rest = kept.filter((session) => !group.includes(session));
      taken.push({ ...takenBy(group[0]!)!, day: group[0]!.day, sessions: count(kept) - count(rest) });
      kept = rest;
    }
    return { scheduled, taken, added, left: count(kept) };
  };

  const version = versionOn(state.timetables, from);
  const entries = (version?.entries ?? []).filter((entry) => {
    const course = state.courses.get(entry.courseId);
    return course !== undefined && entryCourses(state, course).some((level) => level.id === courseId);
  });
  const weekly = (queue?: Queue) =>
    entries
      .filter((entry) => queue === undefined || queueOf(entry.sessionType) === queue)
      .reduce((sum, entry) => sum + (entry.weeks === 'every' ? 1 : 0.5), 0);

  const main = detail('main');
  const td = detail('td');
  const others = QUEUES.filter((queue) => queue !== 'main' && queue !== 'td').map((queue) => detail(queue).scheduled);
  return {
    check,
    from,
    weekly: { all: weekly(), main: weekly('main') },
    scheduled: others.reduce((sum, one) => sum + one, main.scheduled + td.scheduled),
    main,
    td,
  };
}
