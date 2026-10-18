// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sessions outside the timetable (PRD §3.3, R-3.3-16 to 18): support,
// catch-up, review or supervised study, for one of the teacher's classes.
// With no timetable slot, the teacher types the date and the times, as on
// paper; the app never records when they tapped. They do not move the plan,
// and they fill the texts book's page for supervised or additional lessons
// (§3.8, Decision 835). They are not the make-up sessions of the catch-up
// ladder, which count as plan sessions (§4.7).

import { CLOCK, clockMinutes } from './bells.ts';
import type { Context } from './context.ts';
import { compareDays, isWithin, type Day } from './day.ts';
import { EXTRA_KINDS, compareExtras, extraNoteKey, type ExtraKind, type ExtraSession } from './extra-records.ts';
import type { RecordEvent } from './events.ts';
import type { Course } from './records.ts';
import { current, type State } from './state.ts';

/** The longest topic, in characters. */
export const EXTRA_TOPIC_MAX = 200;

/**
 * The events that log a session outside the timetable, or correct one
 * logged before under the same ID: the session, then its topic as a private
 * note when one is typed or one is cleared. The day is never after `today`
 * and is within the school year; the end is after the start. The error
 * messages name no class or pupil.
 */
export function logExtra(context: Context, extra: ExtraSession, today: Day, topic = ''): RecordEvent[] {
  const { ref, state } = context;
  if (!state.courses.has(extra.courseId)) throw new RangeError('No such course');
  if (!(EXTRA_KINDS as readonly string[]).includes(extra.kind)) throw new RangeError('Unknown kind of session');
  if (compareDays(extra.day, today) > 0) throw new RangeError('A session is logged once it has taken place');
  if (!isWithin(extra.day, ref.year.from, ref.year.to)) throw new RangeError('The day is outside the school year');
  if (!CLOCK.test(extra.from) || !CLOCK.test(extra.to)) throw new RangeError('A time is HH:MM');
  if (clockMinutes(extra.to) <= clockMinutes(extra.from)) throw new RangeError('The session ends after it starts');
  const typed = topic.trim();
  if (typed.length > EXTRA_TOPIC_MAX) throw new RangeError('The topic is too long');
  const { id, courseId, kind, day, from, to } = extra;
  const sessionKey = extraNoteKey(id);
  const note: RecordEvent[] =
    typed !== ''
      ? [{ kind: 'session.noted', note: { sessionKey, note: typed } }]
      : state.notes.get(sessionKey)?.note !== undefined
        ? [{ kind: 'session.noted', note: { sessionKey } }]
        : [];
  return [{ kind: 'extra.logged', extra: { id, courseId, kind, day, from, to } }, ...note];
}

/** A session's topic, from its private note. */
export function extraTopic(state: State, id: string): string | undefined {
  return state.notes.get(extraNoteKey(id))?.note;
}

/** The events that remove a session logged by mistake, and clear its topic when it has one; both stay in the history. */
export function extraRemoval(id: string, noted: boolean): RecordEvent[] {
  return [
    { kind: 'extra.removed', id },
    ...(noted ? [{ kind: 'session.noted', note: { sessionKey: extraNoteKey(id) } } as const] : []),
  ];
}

/** The events that remove a logged session and its topic. */
export function removeExtra(state: State, id: string): RecordEvent[] {
  if (current(state.extras.get(id)) === null) throw new RangeError('No such session');
  return extraRemoval(id, extraTopic(state, id) !== undefined);
}

/** The sessions logged outside the timetable and not removed, in order of day and time. */
export function extraSessions(state: State): ExtraSession[] {
  return [...state.extras.values()]
    .flatMap((versions) => {
      const extra = current(versions);
      return extra === null ? [] : [extra];
    })
    .sort(compareExtras);
}

/** One row of the texts book's page for supervised or additional lessons (R-3.8-26). */
export interface SupervisedRow {
  /** In order, from 1, among the teacher's own rows. */
  readonly number: number;
  readonly course: Course;
  readonly kind: ExtraKind;
  readonly day: Day;
  readonly from: string;
  readonly to: string;
}

/**
 * A class's rows on the page for the school year `year`, in order, from its
 * courses' sessions logged outside the timetable. Nothing comes from the
 * timetable. With none, the page prints blank (R-3.8-29).
 */
export function supervisedRows(state: State, classId: string, year: string): SupervisedRow[] {
  return extraSessions(state)
    .flatMap((extra) => {
      const course = state.courses.get(extra.courseId);
      return course === undefined || course.classId !== classId || course.year !== year ? [] : [{ course, ...extra }];
    })
    .map(({ course, kind, day, from, to }, index) => ({ number: index + 1, course, kind, day, from, to }));
}
