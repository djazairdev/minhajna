// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The Today screen lists the day's sessions in order, each with its proposed
// lesson and what carried over (PRD §3.3). A session awaiting confirmation is
// only that: it is never read as an absence (charter point 3).

import type { Context } from './context.ts';
import { addDays, compareDays, weekday, type Day } from './day.ts';
import { confirmCourse, walkCourse, type Confirmation } from './engine.ts';
import type { Proposal } from './progress.ts';
import type { CalendarEntry } from './reference.ts';
import { compareSlots, type Course, type Reason, type SessionRecord, type TeacherBlock } from './records.ts';
import { sessionsBetween, versionOn, type Session } from './sessions.ts';
import type { RecordEvent } from './events.ts';
import { current } from './state.ts';

export type SessionStatus =
  /** Awaiting the teacher's confirmation. */
  | 'awaiting'
  | 'recorded'
  /** A holiday, a closure, an exam or the teacher's own calendar took its place. */
  | 'calendar';

export interface TodaySession {
  readonly session: Session;
  readonly course: Course;
  readonly status: SessionStatus;
  /** For a session awaiting confirmation. */
  readonly proposal: Proposal | null;
  readonly record: SessionRecord | null;
  /** The course pins a pack release that is not installed, so nothing is proposed. */
  readonly packMissing: boolean;
}

export interface TodayView {
  readonly day: Day;
  readonly sessions: readonly TodaySession[];
  /** Holidays, closures, exam weeks, seminars and councils, for the day's marks. */
  readonly marks: readonly CalendarEntry[];
  readonly blocks: readonly TeacherBlock[];
  /** Earlier sessions still awaiting confirmation: a fact, never a judgement (PRD §3.1, rule 8). */
  readonly awaitingEarlier: number;
}

function isAwaiting(context: Context, session: Session): boolean {
  return session.calendar === null && current(context.state.sessions.get(session.key)) === null;
}

/** The ordinary sessions from `from` to `to` still awaiting confirmation, in order. */
export function awaitingBetween(context: Context, from: Day, to: Day): Session[] {
  return sessionsBetween(context, from, to).filter((session) => isAwaiting(context, session));
}

export function todayView(context: Context, day: Day): TodayView {
  const { ref, state, calendar } = context;
  const sessions = sessionsBetween(context, day, day);
  const walks = new Map(
    [...new Set(sessions.map((session) => session.courseId))].map((id) => [id, walkCourse(context, id, day)]),
  );

  const items: TodaySession[] = [];
  for (const session of sessions) {
    const walk = walks.get(session.courseId);
    if (walk === undefined) continue;
    const record = current(state.sessions.get(session.key));
    const status: SessionStatus = record !== null ? 'recorded' : session.calendar !== null ? 'calendar' : 'awaiting';
    items.push({
      session,
      course: walk.setup.course,
      status,
      proposal: status === 'awaiting' ? (walk.proposals.get(session.key) ?? null) : null,
      record,
      packMissing: walk.setup.packMissing,
    });
  }

  const marks = new Map<string, CalendarEntry>();
  for (const school of state.schools.values()) {
    for (const entry of calendar.info(day, school).entries) marks.set(entry.id, entry);
  }

  const before = addDays(day, -1);
  return {
    day,
    sessions: items,
    marks: [...marks.values()],
    blocks: (versionOn(state.timetables, day)?.blocks ?? []).filter((block) => block.weekday === weekday(day)),
    awaitingEarlier:
      compareDays(before, ref.year.from) < 0 ? 0 : awaitingBetween(context, ref.year.from, before).length,
  };
}

export interface SessionConfirmation extends Omit<Confirmation, 'sessionKey'> {
  readonly session: Session;
  /** Private: it stays on the teacher's devices (PRD §3.3). */
  readonly privateReason?: Reason;
  /** Private: it stays on the teacher's devices (PRD §3.3). */
  readonly privateNote?: string;
  /** A reason in the teacher's own words, for a first confirmation or a correction. Private too. */
  readonly reason?: string;
}

/**
 * The events that record these sessions. To confirm a whole day or week,
 * pass every session awaiting confirmation, with a choice only for the
 * exceptions: the others are done as planned (PRD §3.3).
 *
 * The session record never carries free text about why: a reason in the
 * teacher's own words goes into the session's private note, with the
 * private reason and note, and never leaves the teacher's devices (PRD §5.4).
 */
export function confirmSessions(context: Context, confirmations: readonly SessionConfirmation[]): RecordEvent[] {
  const byCourse = new Map<string, SessionConfirmation[]>();
  for (const confirmation of confirmations) {
    const list = byCourse.get(confirmation.session.courseId) ?? [];
    list.push(confirmation);
    byCourse.set(confirmation.session.courseId, list);
  }

  const recorded: { record: SessionRecord; confirmation: SessionConfirmation }[] = [];
  for (const [courseId, list] of byCourse) {
    const upTo = list.map((c) => c.session.day).reduce((a, b) => (compareDays(a, b) >= 0 ? a : b));
    const records = confirmCourse(
      context,
      courseId,
      list.map(({ session, choice, details }) => ({
        sessionKey: session.key,
        ...(choice !== undefined && { choice }),
        ...(details !== undefined && { details }),
      })),
      upTo,
    );
    for (const record of records) {
      const confirmation = list.find((c) => c.session.key === record.session.key);
      if (confirmation !== undefined) recorded.push({ record, confirmation });
    }
  }

  recorded.sort(
    (a, b) =>
      compareDays(a.record.session.day, b.record.session.day) ||
      compareSlots(a.record.session.slot, b.record.session.slot),
  );

  const events: RecordEvent[] = [];
  for (const { record, confirmation } of recorded) {
    const { reason, privateReason, privateNote } = confirmation;
    events.push({ kind: 'session.recorded', record });
    if (privateReason !== undefined || privateNote !== undefined || reason !== undefined) {
      // The new note keeps what the session's earlier note said and was not given again.
      const earlier = context.state.notes.get(record.session.key);
      events.push({
        kind: 'session.noted',
        note: {
          ...earlier,
          sessionKey: record.session.key,
          ...(privateReason !== undefined && { reason: privateReason }),
          ...(privateNote !== undefined && { note: privateNote }),
          ...(reason !== undefined && { reasonText: reason }),
        },
      });
    }
  }
  return events;
}
