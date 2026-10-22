// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Each class's dated sessions come from the timetable version in force, the
// calendar and the A/B weeks (PRD §4.6). A session is identified by its date
// and its slot, never by a clock time (PRD §3.3).
//
// The past never moves: a later timetable applies only from the day it was
// recorded (state.ts), and a recorded session keeps its place even if a
// later timetable no longer has its slot (PRD §2.3, rule 4; §4.6).
//
// A joint class's slot is one session for each of its levels, each on its
// own course and with the calendar of its own grade (joint.ts).
//
// A day that adds sessions takes the timetable of the weekday it follows,
// even on a Saturday or in a holiday (PRD §4.5, §7.7). Its make-up sessions
// are plan sessions like any other, and take the place of a usual session
// a holiday, or any calendar mark they are free of, took on that day. Its
// support and revision sessions are not plan sessions: only the texts book's
// page for additional lessons lists them, and Today shows the day's mark.
// The sessions a day takes are kept by course, slot, group and A or B week,
// so redrawing the week keeps them.
//
// A catch-up session the teacher adds is a plan session too, on the day and
// slot chosen, and takes a session lost on that day in the same way (#228).
//
// A test on the teacher's schedule takes its session, which becomes a test
// session and proposes no lesson, unless the calendar takes it first (#221).
// Once recorded, the session is what was recorded: a test only if so.

import { appliesTo } from './calendar.ts';
import type { Context } from './context.ts';
import { compareDays, eachDay, isWithin, maxDay, minDay, weekday, type Day } from './day.ts';
import { courseGrade, entryCourses, forGrade } from './joint.ts';
import { ancestors } from './lineage.ts';
import type { AddedKind } from './reference.ts';
import type { Rotation, Slot, TimetableVersion } from './records.ts';
import { catchUpSessions } from './catch-up-sessions.ts';
import { compareSessions, markOf, sessionKey, takeKey, takesPlace } from './session-keys.ts';
import { rotatingSessions } from './rotation-sessions.ts';
import { current, type RecordedTimetable } from './state.ts';
import { TEST_SESSION_TYPE } from './test-schedule.ts';

export { compareSessions, sessionKey, takeKey } from './session-keys.ts';

/** Why a session cannot be taught as usual. */
export type CalendarMark =
  /** A holiday inside a teaching week. The session is lost to the calendar. */
  | 'holiday'
  /** A closure or suspension. The session is lost to the calendar. */
  | 'closure'
  /** The exam takes the session's place. */
  | 'exam'
  /**
   * The teacher's own calendar, such as a training day or a seminar. The
   * class is still there, so its roll call stays. Private (PRD §4.5).
   */
  | 'teacher'
  | 'rotation';

export interface Session {
  readonly key: string;
  readonly courseId: string;
  readonly classId: string;
  readonly groupId: string;
  readonly rotation?: Rotation;
  readonly day: Day;
  readonly slot: Slot;
  /** From the timetable, or from the record once the session is recorded. */
  readonly sessionType: string;
  readonly activity?: string;
  readonly calendar: CalendarMark | null;
  /** The calendar entry behind the mark. */
  readonly calendarEntry: string | null;
  /** False for a recorded session that the timetable no longer has. */
  readonly scheduled: boolean;
  /** For a session a make-up day adds: that day's calendar entry. */
  readonly added?: string;
  /** For a catch-up session the teacher added: its ID (#228). */
  readonly catchUp?: string;
  /** For a session a test on the teacher's schedule takes: the test's ID (#221). */
  readonly test?: string;
  /** For a session a test takes: the session type the timetable gave it. */
  readonly took?: string;
}

/** A session a day that adds sessions gives, and what it is for. */
export interface AddedSession {
  readonly session: Session;
  readonly kind: AddedKind;
}

/** The timetable version in force on `day`, from versions in the order they apply. */
export function versionOn(timetables: readonly RecordedTimetable[], day: Day): TimetableVersion | null {
  let found: TimetableVersion | null = null;
  for (const timetable of timetables) if (compareDays(timetable.from, day) <= 0) found = timetable.version;
  return found;
}

/**
 * The sessions that days adding sessions give from `from` to `to`, of the
 * kinds asked for, in order: on each such day, the timetable entries of the
 * weekday it follows that the teacher chose, or else those of that weekday
 * for the day's A or B week. A closure, an exam or the teacher's own
 * calendar on that day still marks them.
 */
export function addedSessions(
  context: Context,
  from: Day,
  to: Day,
  kinds: readonly AddedKind[],
  courseIds?: ReadonlySet<string>,
): AddedSession[] {
  const { ref, state, calendar } = context;
  const found: AddedSession[] = [];
  const first = maxDay(from, ref.year.from);
  const last = minDay(to, ref.year.to);
  if (compareDays(first, last) > 0) return found;
  for (const school of state.schools.values()) {
    for (const added of calendar.entriesFor(school)) {
      const { adds, follows } = added;
      if (added.effect !== 'adds-sessions' || adds === undefined || follows === undefined) continue;
      if (!kinds.includes(adds) || compareDays(added.to, first) < 0 || compareDays(added.from, last) > 0) continue;
      for (const day of eachDay(maxDay(added.from, first), minDay(added.to, last))) {
        const version = versionOn(state.timetables, day);
        const parity = calendar.parityOn(day, school);
        for (const entry of version?.entries ?? []) {
          if (entry.weekday !== follows) continue;
          const takes = added.takes;
          if (
            takes !== undefined ? !takes.includes(takeKey(entry)) : entry.weeks !== 'every' && entry.weeks !== parity
          ) {
            continue;
          }
          const course = state.courses.get(entry.courseId);
          const schoolClass = course && state.classes.get(course.classId);
          if (course === undefined || schoolClass === undefined || schoolClass.schoolId !== school.id) continue;
          for (const level of entryCourses(state, course)) {
            if (courseIds !== undefined && !courseIds.has(level.id)) continue;
            const forLevel = forGrade(schoolClass, courseGrade(level, schoolClass));
            if (!appliesTo(added, school, forLevel)) continue;
            const info = calendar.info(day, school, forLevel, entry.slot.half);
            const blocking = info.closure ?? info.exam ?? info.teacher;
            const key = sessionKey(level.id, day, entry.slot, entry.groupId);
            found.push({
              kind: adds,
              session: {
                key,
                courseId: level.id,
                classId: schoolClass.id,
                groupId: entry.groupId,
                day,
                slot: entry.slot,
                sessionType: entry.sessionType,
                ...(entry.activity !== undefined && { activity: entry.activity }),
                calendar: markOf(info),
                calendarEntry: blocking?.id ?? null,
                scheduled: true,
                added: added.id,
              },
            });
          }
        }
      }
    }
  }
  const grouped = rotatingSessions(context, new Map(found.map((one) => [one.session.key, one.session])));
  return [...grouped.values()]
    .map((session) => ({
      session,
      kind: found.find((one) => one.session.added === session.added)!.kind,
    }))
    .sort((a, b) => compareSessions(a.session, b.session));
}

/**
 * The teacher's sessions from `from` to `to`, in order, with the make-up
 * sessions days adding sessions give. With `courseIds`, only those courses'
 * sessions, and the recorded sessions of the courses they continue before
 * they took over (#231). An archived class has none from its archive day.
 */
export function sessionsBetween(context: Context, from: Day, to: Day, wanted?: ReadonlySet<string>): Session[] {
  const { ref, state, calendar } = context;
  const until = new Map<string, Day>();
  for (const id of wanted ?? []) for (const one of ancestors(state, id)) until.set(one.courseId, one.until);
  const courseIds = wanted === undefined ? undefined : new Set([...wanted, ...until.keys()]);
  let sessions = new Map<string, Session>();
  const first = maxDay(from, ref.year.from);
  const last = minDay(to, ref.year.to);

  for (const day of compareDays(first, last) <= 0 ? eachDay(first, last) : []) {
    const version = versionOn(state.timetables, day);
    if (version === null) continue;
    for (const entry of version.entries) {
      if (entry.weekday !== weekday(day)) continue;
      const course = state.courses.get(entry.courseId);
      const schoolClass = course && state.classes.get(course.classId);
      const school = schoolClass && state.schools.get(schoolClass.schoolId);
      if (course === undefined || schoolClass === undefined || school === undefined) continue;
      const week = calendar.weekOf(day, school);
      if (week === null) continue;
      if (entry.weeks !== 'every' && entry.weeks !== week.parity) continue;
      for (const level of entryCourses(state, course)) {
        if (courseIds !== undefined && !courseIds.has(level.id)) continue;
        const info = calendar.info(
          day,
          school,
          forGrade(schoolClass, courseGrade(level, schoolClass)),
          entry.slot.half,
        );
        const blocking = !info.schoolDay
          ? (info.entries.find((e) => e.effect === 'no-school' && e.layer !== 'teacher') ?? null)
          : (info.closure ?? info.exam ?? info.teacher);
        const mark: CalendarMark | null = !info.schoolDay ? 'holiday' : markOf(info);
        const key = sessionKey(level.id, day, entry.slot, entry.groupId);
        sessions.set(key, {
          key,
          courseId: level.id,
          classId: schoolClass.id,
          groupId: entry.groupId,
          day,
          slot: entry.slot,
          sessionType: entry.sessionType,
          ...(entry.activity !== undefined && { activity: entry.activity }),
          calendar: mark,
          calendarEntry: blocking?.id ?? null,
          scheduled: true,
        });
      }
    }
  }

  for (const { session } of addedSessions(context, first, last, ['make-up'], courseIds)) {
    if (takesPlace(sessions.get(session.key), session)) sessions.set(session.key, session);
  }

  sessions = rotatingSessions(context, sessions);
  for (const session of catchUpSessions(context, first, last, courseIds)) {
    if (takesPlace(sessions.get(session.key), session)) sessions.set(session.key, session);
  }
  for (const test of state.tests.values()) {
    const key = sessionKey(test.courseId, test.day, test.slot, test.groupId);
    const session = sessions.get(key);
    if (session === undefined || session.calendar !== null) continue;
    sessions.set(key, { ...session, sessionType: TEST_SESSION_TYPE, test: test.id, took: session.sessionType });
  }

  for (const [key, versions] of state.sessions) {
    const record = current(versions);
    if (record === null || !isWithin(record.session.day, from, to)) continue;
    if (courseIds !== undefined && !courseIds.has(record.session.courseId)) continue;
    const course = state.courses.get(record.session.courseId);
    if (course === undefined) continue;
    const matched: Session = sessions.get(key) ?? {
      key,
      courseId: course.id,
      classId: course.classId,
      groupId: record.session.groupId,
      day: record.session.day,
      slot: record.session.slot,
      ...(record.session.rotation !== undefined && { rotation: record.session.rotation }),
      calendar: null,
      calendarEntry: null,
      scheduled: false,
      sessionType: record.sessionType,
    };
    const { test, took, ...scheduled } = matched;
    sessions.set(key, {
      ...scheduled,
      sessionType: record.sessionType,
      ...(record.outcome !== 'not-held' && { calendar: null, calendarEntry: null }),
      ...(test !== undefined &&
        record.sessionType === TEST_SESSION_TYPE && { test, ...(took !== undefined && { took }) }),
    });
  }

  return [...sessions.values()]
    .filter((session) => {
      const archived = state.classes.get(session.classId)?.archivedFrom;
      if (archived !== undefined && compareDays(session.day, archived) >= 0) return false;
      const ends = wanted?.has(session.courseId) === false ? until.get(session.courseId) : undefined;
      return (
        ends === undefined || (compareDays(session.day, ends) < 0 && current(state.sessions.get(session.key)) !== null)
      );
    })
    .sort(compareSessions);
}
