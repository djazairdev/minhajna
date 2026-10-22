// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Context } from './context.ts';
import { addDays, weekday, type Day } from './day.ts';
import { slotKey, type RollCall, type SessionRef } from './records.ts';
import { rotationOn } from './rotating-groups.ts';
import { compareSessions, type Session } from './sessions.ts';
import { current } from './state.ts';

/** The day whose turn a session takes: for a make-up day's, the weekday it follows in its week. */
function turnOf(context: Context, session: Session): Day {
  const school = context.state.schools.get(context.state.classes.get(session.classId)?.schoolId ?? '');
  const follows =
    session.added === undefined || school === undefined
      ? undefined
      : context.calendar.entriesFor(school).find((entry) => entry.id === session.added)?.follows;
  if (follows === undefined) return session.day;
  const start = context.ref.country.weekStartsOn;
  const at = (one: number) => (one - start + 7) % 7;
  return addDays(session.day, at(follows) - at(weekday(session.day)));
}

function place(session: SessionRef): string {
  return `${session.courseId}/${session.day}/${slotKey(session.slot)}`;
}

/** Resolve groups before proposals and roll call; recorded physical slots keep their saved group and rule. */
export function rotatingSessions(context: Context, sessions: ReadonlyMap<string, Session>): Map<string, Session> {
  const records = new Map<string, SessionRef[]>();
  for (const versions of context.state.sessions.values()) {
    const record = current(versions);
    if (record === null) continue;
    const key = place(record.session);
    records.set(key, [...(records.get(key) ?? []), record.session]);
  }
  const rolls = new Map<string, RollCall>();
  for (const versions of context.state.rollCalls.values()) {
    const roll = current(versions);
    if (roll === null) continue;
    const key = roll.unit.startsWith('session:')
      ? roll.unit.slice(8).split('/').slice(0, -1).join('/')
      : `${roll.classId}/${roll.day}/${roll.half}`;
    rolls.set(key, roll);
  }
  const found = new Map<string, Session>();
  for (const session of sessions.values()) {
    const schoolClass = context.state.classes.get(session.classId);
    const active = schoolClass && rotationOn(context, schoolClass, session.day, turnOf(context, session));
    const saved = records.get(place(session));
    const roll = rolls.get(place(session)) ?? rolls.get(`${session.classId}/${session.day}/${session.slot.half}`);
    const locked = saved?.find((one) => one.rotation !== undefined) ?? saved?.[0];
    const rotates = active != null || locked?.rotation !== undefined || roll?.rotation !== undefined;
    if (!rotates) {
      found.set(session.key, session);
      continue;
    }
    const groupId = locked?.groupId ?? roll?.groupId ?? active!.groupId;
    const rotation =
      locked !== undefined
        ? locked.rotation
        : roll !== undefined
          ? roll.rotation
          : { entryId: active!.entry.id, groups: active!.entry.rotation!.groups };
    const whole = schoolClass?.groups.find((one) => one.kind === 'whole')?.id;
    const off = locked === undefined && roll === undefined && session.groupId !== whole && session.groupId !== groupId;
    if (off) {
      found.set(session.key, {
        ...session,
        calendar: session.calendar ?? 'rotation',
        calendarEntry: session.calendarEntry ?? active!.entry.id,
      });
      continue;
    }
    const base = { ...session };
    delete base.rotation;
    const key = `${place(session)}/${groupId}`;
    found.set(key, { ...base, key, groupId, ...(rotation !== undefined && { rotation }) });
  }
  return found;
}

/** The groups that take a session's item in turn, when it is one of them; see `halfTurns`. */
export type Turns = (session: Session) => readonly string[] | undefined;

/**
 * The half-groups a session's course is timetabled for in the main plan, when its group is one of two or more of
 * them: they take each main-plan item in turn, so a pair counts once for the class, on the day the second half has
 * it (#231, R-4.7-15, answer 387). TD keeps counting each half's session, as the September check does.
 */
export function halfTurns(context: Context): Turns {
  const known = new Map<string, readonly string[]>();
  return (session) => {
    let halves = known.get(session.courseId);
    if (halves === undefined) {
      const { state } = context;
      const course = state.courses.get(session.courseId);
      const groups = state.classes.get(course?.classId ?? '')?.groups ?? [];
      const ids = new Set(groups.filter((group) => group.kind === 'half').map((group) => group.id));
      const used = state.timetables
        .flatMap((one) => one.version.entries)
        .filter(
          (entry) =>
            entry.courseId === session.courseId &&
            ids.has(entry.groupId) &&
            context.ref.country.sessionTypes.find((type) => type.code === entry.sessionType)?.queue === 'main',
        )
        .map((entry) => entry.groupId);
      halves = [...new Set(used)].sort();
      known.set(session.courseId, halves);
    }
    return halves.length > 1 && halves.includes(session.groupId) ? halves : undefined;
  };
}

/**
 * Effective whole-class opportunities for one course and one queue; repeats are calendar cost. A rotation's groups,
 * and with `turns` a class's half-groups, count once for each round in which every group has had a session. A
 * whole-class session ends a rotation's round, but not the halves', which take the item in alternate weeks, whatever
 * the activity each half has.
 */
export function rotationCredits(sessions: readonly Session[], turns?: Turns): number {
  return sessionCredits(sessions, turns).reduce((sum, credit) => sum + credit, 0);
}

/** Each session's part of `rotationCredits`, in the order given: 1 when it ends a round or stands alone. */
export function sessionCredits(sessions: readonly Session[], turns?: Turns): number[] {
  const credits = sessions.map(() => 0);
  const cohorts = new Map<string, Map<string, number>>();
  const order = sessions.map((_, index) => index).sort((a, b) => compareSessions(sessions[a]!, sessions[b]!));
  for (const index of order) {
    const session = sessions[index]!;
    const scope = `${session.courseId}/${session.activity ?? ''}/`;
    const halves = session.rotation === undefined ? turns?.(session) : undefined;
    const groups = session.rotation?.groups ?? halves;
    if (groups === undefined) {
      credits[index] = 1;
      for (const key of cohorts.keys()) if (key.startsWith(scope)) cohorts.delete(key);
      continue;
    }
    const key = `${halves === undefined ? scope : `halves:${session.courseId}/`}${[...groups].sort().join('/')}`;
    const cohort = cohorts.get(key) ?? new Map<string, number>();
    cohort.set(session.groupId, (cohort.get(session.groupId) ?? 0) + 1);
    if (groups.every((id) => (cohort.get(id) ?? 0) > 0)) {
      credits[index] = 1;
      for (const id of groups) cohort.set(id, cohort.get(id)! - 1);
    }
    cohorts.set(key, cohort);
  }
  return credits;
}
