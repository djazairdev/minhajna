// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sessions that take a class's list, each with its item (#230, answer
// 376): the timetabled sessions of the list's type still awaiting
// confirmation, from a day on, and for the support list the support
// sessions the teacher scheduled and has not logged (#228, answer 362), in
// order, take the items no session finished, one each.

import type { CatchUpSession } from './catch-up-sessions.ts';
import type { Context } from './context.ts';
import { addDays, compareDays, minDay, type Day } from './day.ts';
import { compareSlots, type Slot } from './records.ts';
import { sessionsBetween, type Session } from './sessions.ts';
import {
  listOfType,
  nextSupportItem,
  supportEnded,
  supportQueueRows,
  type ListKind,
  type SupportItem,
} from './support-queue.ts';
import { current } from './versions.ts';

/** How far ahead the timetabled sessions are looked for, in days. */
const LOOK_AHEAD = 55;

/** A session that takes the list, timetabled or scheduled, with the item it would take. */
export interface ListPair {
  readonly day: Day;
  readonly slot: Slot;
  readonly session?: Session;
  readonly catchUp?: CatchUpSession;
  readonly item: SupportItem | null;
}

/** A scheduled support session not yet logged, with the item it would take. */
export interface ScheduledSupport {
  readonly catchUp: CatchUpSession;
  readonly item: SupportItem | null;
}

/** The class's timetabled sessions of the list's type from `from` to `to` still awaiting confirmation. */
function awaiting(context: Context, courseId: string, kind: ListKind, from: Day, to: Day): Session[] {
  return sessionsBetween(context, from, to, new Set([courseId])).filter(
    (session) =>
      session.calendar === null &&
      listOfType(session.sessionType) === kind &&
      current(context.state.sessions.get(session.key)) === null,
  );
}

/**
 * The sessions that take the class's list, in order, each paired with the
 * next item left: every scheduled support session not yet logged, and the
 * timetabled ones from `from` on, through the last scheduled one and at
 * least `count` of them when the next eight weeks hold that many.
 */
export function listPairs(context: Context, courseId: string, kind: ListKind, from: Day, count = 3): ListPair[] {
  const { state, ref } = context;
  const scheduled = [...state.catchUps.values()].filter(
    (one) => kind === 'support' && one.kind === 'support' && one.courseId === courseId && !supportEnded(state, one.id),
  );
  const through = scheduled.reduce((last, one) => (compareDays(one.day, last) > 0 ? one.day : last), from);
  const ahead = addDays(from, LOOK_AHEAD);
  const sessions: Session[] = [];
  let start = from;
  const wanted = () => compareDays(start, through) <= 0 || (sessions.length < count && compareDays(start, ahead) <= 0);
  while (compareDays(start, ref.year.to) <= 0 && wanted()) {
    const to = minDay(addDays(start, 13), ref.year.to);
    sessions.push(...awaiting(context, courseId, kind, start, to));
    start = addDays(to, 1);
  }
  const left = supportQueueRows(state, courseId, kind).flatMap((row) => (row.finished ? [] : [row.item]));
  return [
    ...scheduled.map((catchUp) => ({ day: catchUp.day, slot: catchUp.slot, catchUp })),
    ...sessions.map((session) => ({ day: session.day, slot: session.slot, session })),
  ]
    .sort((a, b) => compareDays(a.day, b.day) || compareSlots(a.slot, b.slot))
    .map((one, index) => ({ ...one, item: left[index] ?? null }));
}

/** The class's scheduled support sessions not yet logged, in order, each paired with its item. */
export function scheduledSupport(context: Context, courseId: string, from: Day): ScheduledSupport[] {
  return listPairs(context, courseId, 'support', from, 0).flatMap(({ catchUp, item }) =>
    catchUp === undefined ? [] : [{ catchUp, item }],
  );
}

/** The item a support session takes: a scheduled one's paired item, or else the first item left. */
export function supportItemFor(context: Context, courseId: string, from: Day, scheduled?: string): SupportItem | null {
  const paired = scheduledSupport(context, courseId, from).find((one) => one.catchUp.id === scheduled);
  return paired === undefined ? nextSupportItem(context.state, courseId) : paired.item;
}

/** The item of its list a «معالجة» or «دعم» session awaiting confirmation takes; null for any other. */
export function pairedItem(context: Context, session: Session): SupportItem | null {
  const kind = listOfType(session.sessionType);
  if (kind === null) return null;
  const pairs = listPairs(context, session.courseId, kind, session.day, 1);
  return pairs.find((pair) => pair.session?.key === session.key)?.item ?? null;
}
