// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What capture during the session reads (#239, answers 441, 449 and 450):
// today's sessions of a course capture can be on, leaving out the days the
// calendar closes or keeps the teacher away and the sessions recorded as not
// held; the one it opens on, the first not yet recorded, else the last; the
// pupils it shows, the session's group's enrolled that day, of the course's
// level only in a joint class; and the homework counts a piece of
// homework's captures propose, from the first session of its course on its
// due day, held by its group or the whole class, that has any, counting only
// the pupils on the homework's list (answer 453); that session is also where
// a pupil's homework evidence is read (answer 452).

import { homeworkProposal } from './captures.ts';
import { refOf } from './choices.ts';
import type { Context } from './context.ts';
import type { Day } from './day.ts';
import { coursePupils, type HomeworkItem } from './homework.ts';
import { wholeGroup, type SessionRef } from './records.ts';
import { sessionsBetween } from './sessions.ts';
import { current } from './versions.ts';

/** Today's sessions of a course capture can be on, in the day's order. */
export function captureSessions(context: Context, courseId: string, day: Day): SessionRef[] {
  return sessionsBetween(context, day, day, new Set([courseId]))
    .filter(
      (session) =>
        session.courseId === courseId &&
        session.calendar === null &&
        current(context.state.sessions.get(session.key))?.outcome !== 'not-held',
    )
    .map(refOf);
}

/** The session capture opens on `day`; null when the course has none that day. */
export function captureSession(context: Context, courseId: string, day: Day): SessionRef | null {
  const sessions = captureSessions(context, courseId, day);
  const open = sessions.find((session) => current(context.state.sessions.get(session.key)) === null);
  return open ?? sessions.at(-1) ?? null;
}

/** The pupils a session's captures are for, in list order. */
export function captureList(context: Context, session: SessionRef): string[] {
  const course = context.state.courses.get(session.courseId);
  return course === undefined ? [] : coursePupils(context, course, session.groupId, session.day);
}

/** The session a piece of homework's taps are read on, with its list; null when none was captured. */
export function homeworkSession(
  context: Context,
  item: Pick<HomeworkItem, 'session' | 'due'>,
): { readonly session: SessionRef; readonly listed: readonly string[] } | null {
  const { courseId, groupId } = item.session;
  const course = context.state.courses.get(courseId);
  const room = course && context.state.classes.get(course.classId);
  if (course === undefined || room === undefined) return null;
  const listed = coursePupils(context, course, groupId, item.due);
  const groups = new Set([groupId, wholeGroup(room).id]);
  for (const session of sessionsBetween(context, item.due, item.due, new Set([courseId]))) {
    if (session.courseId !== courseId || !groups.has(session.groupId)) continue;
    const proposal = homeworkProposal(context.state, session.key, listed);
    if (proposal.notDone + proposal.reliedOn > 0) return { session: refOf(session), listed };
  }
  return null;
}

/** The counts a piece of homework's captures propose; null when none was captured. */
export function homeworkCaptured(
  context: Context,
  item: Pick<HomeworkItem, 'session' | 'due'>,
): { readonly notDone: number; readonly reliedOn: number } | null {
  const found = homeworkSession(context, item);
  return found === null ? null : homeworkProposal(context.state, found.session.key, found.listed);
}
