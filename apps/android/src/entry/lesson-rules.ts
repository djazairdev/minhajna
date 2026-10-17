// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The rules behind «درس آخر لهذه الحصة» (#34, Entry-lesson): each queue of
// the plan around the class's position, the last items taught with their
// day, then the proposed one and those after it with the day the plan
// would reach them; a search over the whole queue; and the choice another
// lesson makes. The proposed item stays first in its queue (PRD §2.3, §4.7).

import {
  addDays,
  compareDays,
  compareSessions,
  compareSlots,
  current,
  findSessionType,
  queueItems,
  sessionsBetween,
  type Choice,
  type Context,
  type CountryProfile,
  type Day,
  type PackItem,
  type PlanPack,
  type Proposal,
  type Session,
  type State,
} from '@minhajna/core';

/** The lesson the session takes: the proposed one, another plan item, or content from outside the plan. */
export type Lesson =
  | { readonly kind: 'proposed' }
  | { readonly kind: 'item'; readonly item: PackItem; readonly taught: boolean }
  | { readonly kind: 'unplanned' };

export interface LessonRow {
  readonly item: PackItem;
  readonly status: 'taught' | 'proposed' | 'open';
  /** The day it was last taught, or the day the plan would reach it. */
  readonly day: Day | null;
}

export interface LessonGroup {
  readonly queue: 'main' | 'td';
  readonly taught: readonly LessonRow[];
  readonly ahead: readonly LessonRow[];
}

/** The choice a lesson makes, or none for the proposed one. */
export function choiceOf(lesson: Lesson): Choice | undefined {
  if (lesson.kind === 'proposed') return undefined;
  if (lesson.kind === 'unplanned') return { outcome: 'changed' };
  return lesson.taught ? { outcome: 'retaught', item: lesson.item.id } : { outcome: 'changed', item: lesson.item.id };
}

/** The last day each item of this course and group was covered, before the session. */
function taughtDays(state: State, session: Session): Map<string, Day> {
  const days = new Map<string, Day>();
  for (const versions of state.sessions.values()) {
    const record = current(versions);
    if (record === null || record.session.courseId !== session.courseId) continue;
    if (
      record.session.groupId !== session.groupId ||
      (compareDays(record.session.day, session.day) || compareSlots(record.session.slot, session.slot)) >= 0
    )
      continue;
    for (const cover of record.coverage) {
      const known = days.get(cover.item);
      if (known === undefined || compareDays(known, record.session.day) < 0) days.set(cover.item, record.session.day);
    }
  }
  return days;
}

/** The days of the next sessions in this queue, from this one when it is in the queue. */
function queueDays(context: Context, profile: CountryProfile, session: Session, queue: string): Day[] {
  return sessionsBetween(context, session.day, addDays(session.day, 56), new Set([session.courseId]))
    .filter(
      (other) =>
        other.groupId === session.groupId &&
        other.calendar === null &&
        compareSessions(other, session) >= 0 &&
        findSessionType(profile, other.sessionType).queue === queue,
    )
    .map((other) => other.day);
}

/** Each queue around the class's position: three items taught before it, five from it; or every match of `query`. */
export function lessonGroups(
  context: Context,
  profile: CountryProfile,
  pack: PlanPack,
  session: Session,
  proposal: Proposal,
  query: string,
): LessonGroup[] {
  const days = taughtDays(context.state, session);
  const needle = query.trim().toLocaleLowerCase();
  const queues = proposal.queue === 'td' ? (['td', 'main'] as const) : (['main', 'td'] as const);
  return queues.flatMap((queue) => {
    const items = queueItems(pack, queue);
    const at =
      queue === proposal.queue
        ? items.findIndex((item) => item.id === proposal.item.id)
        : items.findIndex((item) => !days.has(item.id));
    const position = at === -1 ? items.length : at;
    const ahead = queueDays(context, profile, session, queue);
    const row = (item: PackItem, index: number): LessonRow =>
      index < position
        ? { item, status: 'taught', day: days.get(item.id) ?? null }
        : {
            item,
            status: queue === proposal.queue && index === position ? 'proposed' : 'open',
            day: ahead[index - position] ?? null,
          };
    const rows = items.map(row);
    const shown =
      needle === ''
        ? rows.filter((_, index) => index >= position - 3 && index < position + 5)
        : rows.filter(({ item }) => item.title.toLocaleLowerCase().includes(needle));
    if (shown.length === 0) return [];
    return [
      {
        queue,
        taught: shown.filter((one) => one.status === 'taught'),
        ahead: shown.filter((one) => one.status !== 'taught'),
      },
    ];
  });
}
