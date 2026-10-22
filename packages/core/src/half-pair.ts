// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Half-groups taking a main-plan item in turn (#231, L-Today, R-4.7-15, answer
// 387): for a half-group's session, each half's turn at the item it proposes,
// the session's own first: the day and week letter of the half's session that
// takes the item, or of the whole class's session after this one that takes it
// before the half's turn comes, or that the half has on record the stages this
// session is proposed to cover. The item is done for the class only once every
// half has had it.

import type { Parity } from './calendar.ts';
import type { Context } from './context.ts';
import { addDays, type Day } from './day.ts';
import { walkCourse, type CourseWalk } from './engine.ts';
import { findPackItem } from './plan-layer.ts';
import { wholeGroup } from './records.ts';
import { halfTurns } from './rotation-sessions.ts';
import { compareSessions } from './session-keys.ts';
import { sessionsBetween, type Session } from './sessions.ts';

/** How far before and after the session the other half's session is looked for. */
const LOOK_AROUND = 55;

export interface HalfTurn {
  readonly groupId: string;
  /** True when the half has on record the stages of the item this session is proposed to cover. */
  readonly done: boolean;
  /** The day of the session awaiting confirmation that takes the item for the half; null when done or none near. */
  readonly day: Day | null;
  /** True when that session is the whole class's. */
  readonly withClass: boolean;
  /** The week letter of that day, when the course's timetable has A and B weeks. */
  readonly letter: Parity | null;
}

/** Each half's turn at `itemId`, the session's own half first; null unless the session is one of two halves or more. */
export function halfPair(context: Context, session: Session, itemId: string): readonly HalfTurn[] | null {
  return halfPairs(context, [{ session, itemId }]).get(session.key) ?? null;
}

/** The turns of each session that has a pair, by session key, walking each course once a day. */
export function halfPairs(
  context: Context,
  wanted: readonly { readonly session: Session; readonly itemId: string }[],
): Map<string, readonly HalfTurn[]> {
  const turns = halfTurns(context);
  const walks = new Map<string, Walked>();
  const pairs = new Map<string, readonly HalfTurn[]>();
  for (const { session, itemId } of wanted) {
    const groups = turns(session);
    if (groups === undefined) continue;
    const at = `${session.courseId}/${session.day}`;
    const walked = walks.get(at) ?? walk(context, session);
    walks.set(at, walked);
    const pair = pairOf(context, session, itemId, groups, walked);
    if (pair !== null) pairs.set(session.key, pair);
  }
  return pairs;
}

type Walked = { readonly walk: CourseWalk; readonly near: readonly Session[]; readonly lettered: boolean };

/** The course's proposals and records through the look-around, its sessions near the day, and its A and B weeks. */
function walk(context: Context, session: Session): Walked {
  const { courseId, day } = session;
  return {
    walk: walkCourse(context, courseId, addDays(day, LOOK_AROUND)),
    near: sessionsBetween(context, addDays(day, -LOOK_AROUND), addDays(day, LOOK_AROUND), new Set([courseId])),
    lettered: context.state.timetables.some((one) =>
      one.version.entries.some((entry) => entry.courseId === courseId && entry.weeks !== 'every'),
    ),
  };
}

function pairOf(
  context: Context,
  session: Session,
  itemId: string,
  groups: readonly string[],
  { walk: walked, near, lettered }: Walked,
): readonly HalfTurn[] | null {
  const { pack, schoolClass } = walked.setup;
  const item = findPackItem(pack, itemId);
  if (pack === null || item === undefined) return null;
  const school = context.state.schools.get(schoolClass.schoolId);
  const letter = (day: Day) => (school === undefined || !lettered ? null : context.calendar.parityOn(day, school));
  const whole = wholeGroup(schoolClass).id;
  const proposal = walked.proposals.get(session.key);
  const stages = proposal?.item.id === itemId ? range(proposal.from, Math.max(proposal.to, proposal.from + 1)) : null;
  const had = (groupId: string) => {
    if (stages === null) return walked.progress.isFinished(pack, item, groupId);
    const covered = new Set(walked.progress.coveredStages(itemId, groupId));
    return stages.every((stage) => covered.has(stage));
  };
  const turn = (groupId: string): HalfTurn => {
    const own = groupId === session.groupId;
    if (!own && had(groupId)) {
      return { groupId, done: true, day: null, withClass: false, letter: null };
    }
    const next = own
      ? session
      : near.find(
          (one) =>
            (one.groupId === groupId || (one.groupId === whole && compareSessions(one, session) > 0)) &&
            walked.proposals.get(one.key)?.item.id === itemId,
        );
    return {
      groupId,
      done: false,
      day: next?.day ?? null,
      withClass: next !== undefined && next.groupId === whole,
      letter: next === undefined ? null : letter(next.day),
    };
  };
  return [session.groupId, ...groups.filter((id) => id !== session.groupId)].map(turn);
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from }, (_, index) => from + index);
}
