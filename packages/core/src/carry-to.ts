// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where what is left of a session's item goes on (PRD §4.7): the next
// session of the same class, group and subject in the same queue, never a
// TD, remediation or exam session in between, nor one the calendar takes.

import type { Context } from './context.ts';
import { addDays } from './day.ts';
import { queueOf } from './pacing.ts';
import { compareSessions, sessionsBetween, type Session } from './sessions.ts';

/** Where what is left of a session's item goes on. */
export interface CarryTo {
  /** The next session of the same class, group and subject in the same queue. */
  readonly next: Session | null;
  /** The first session of another kind before it, such as a test, which the item passes over. */
  readonly passed: Session | null;
}

/**
 * Where what is left of this session's item goes on (PRD §4.7): the next
 * session of the same class, group and subject in the same queue, never a
 * TD, remediation or exam session in between, nor one the calendar takes.
 * Looks eight weeks ahead.
 */
export function carryTo(context: Context, session: Session): CarryTo {
  const queue = queueOf(context, session);
  const later = sessionsBetween(context, session.day, addDays(session.day, 56), new Set([session.courseId])).filter(
    (other) => other.groupId === session.groupId && other.calendar === null && compareSessions(other, session) > 0,
  );
  const at = later.findIndex((other) => queueOf(context, other) === queue);
  return { next: later[at] ?? null, passed: at > 0 ? (later[0] ?? null) : null };
}
