// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A TD session's list on Today (#231, L-Today, answer 387): the next items
// of the pack's TD queue the group takes, each once, from this session on,
// with the session that starts it, and whether one of the class's tests in
// the subject comes before that session and after the row above; and where
// the main plan stands for the group, which TD never moves.

import type { Context } from './context.ts';
import { addDays, compareDays } from './day.ts';
import { walkCourse, type CourseWalk } from './engine.ts';
import type { PackItem } from './pack.ts';
import type { Proposal } from './progress.ts';
import { compareSlots, wholeGroup } from './records.ts';
import { compareSessions } from './session-keys.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import type { ScheduledTest } from './test-schedule.ts';

/** How far ahead the group's sessions are looked for, in days. */
const LOOK_AHEAD = 55;

export interface TdRow {
  readonly item: PackItem;
  /** The session that starts the item, and its proposal. */
  readonly session: Session;
  readonly proposal: Proposal;
  /** True when a test of the class in the subject comes after the row above and before this row's session. */
  readonly afterTest: boolean;
}

export interface TdList {
  readonly rows: readonly TdRow[];
  /** The group's next main-plan proposal, from this session on; null when none comes near. */
  readonly main: Proposal | null;
}

/** The list for a TD session awaiting confirmation; null for a session of any other queue. */
export function tdList(context: Context, session: Session, count = 3): TdList | null {
  return tdLists(context, [session], count).get(session.key) ?? null;
}

/** The lists of TD sessions awaiting confirmation, by session key, walking each course once a day. */
export function tdLists(context: Context, sessions: readonly Session[], count = 3): Map<string, TdList> {
  const walks = new Map<string, CourseWalk>();
  const lists = new Map<string, TdList>();
  for (const session of sessions) {
    const type = context.ref.country.sessionTypes.find((one) => one.code === session.sessionType);
    if (type?.queue !== 'td') continue;
    const at = `${session.courseId}/${session.day}`;
    const walked = walks.get(at) ?? walkCourse(context, session.courseId, addDays(session.day, LOOK_AHEAD));
    walks.set(at, walked);
    lists.set(session.key, listOf(context, session, count, walked));
  }
  return lists;
}

function listOf(context: Context, session: Session, count: number, walked: CourseWalk): TdList {
  const whole = wholeGroup(walked.setup.schoolClass).id;
  const ahead = sessionsBetween(context, session.day, addDays(session.day, LOOK_AHEAD), new Set([session.courseId]))
    .filter((one) => compareSessions(one, session) >= 0 && (one.groupId === session.groupId || one.groupId === whole))
    .sort(compareSessions);
  const tests = [...context.state.tests.values()].filter(
    (test) => test.courseId === session.courseId && (test.groupId === whole || test.groupId === session.groupId),
  );
  const rows: TdRow[] = [];
  for (const one of ahead) {
    const proposal = walked.proposals.get(one.key);
    if (proposal?.queue !== 'td' || rows.some((row) => row.item.id === proposal.item.id)) continue;
    const before = rows.at(-1)?.session;
    const afterTest = before !== undefined && tests.some((test) => isBetween(test, before, one));
    rows.push({ item: proposal.item, session: one, proposal, afterTest });
    if (rows.length === count) break;
  }
  const main = ahead.map((one) => walked.proposals.get(one.key)).find((one) => one?.queue === 'main') ?? null;
  return { rows, main };
}

/** Whether a test's day and slot fall after `from` and before `to`. */
function isBetween(test: ScheduledTest, from: Session, to: Session): boolean {
  const at = (other: Session) => compareDays(test.day, other.day) || compareSlots(test.slot, other.slot);
  return at(from) > 0 && at(to) < 0;
}
