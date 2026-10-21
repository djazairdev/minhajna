// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's support queue (#228, R-4.7-08, PRD §4.7, answers 359 and 360):
// the teacher's own list of support items, in order, kept whole for each
// course. Each support or «تدارك» session logged for the class takes the
// first item it has not finished; the session keeps the item it took and
// whether it finished it, so editing the list never rewrites the past. The
// queue never moves the main plan nor counts in its buffers or delay.

import { isOneLine } from './calendar-notice-read.ts';
import type { RecordEvent } from './events.ts';
import { compareExtras, type ExtraKind, type ExtraSession } from './extra-records.ts';
import type { State } from './state-type.ts';
import { current } from './versions.ts';

/** The kinds of session outside the timetable that take the support queue. */
export const SUPPORT_KINDS: readonly ExtraKind[] = ['support', 'catch-up'];

/** The longest item title, in characters. */
export const SUPPORT_TITLE_MAX = 120;

export interface SupportItem {
  readonly id: string;
  readonly title: string;
}

export interface SupportQueue {
  readonly courseId: string;
  readonly items: readonly SupportItem[];
}

/** An item of the queue with the logged sessions that took it, in order, and whether one finished it. */
export interface SupportRow {
  readonly item: SupportItem;
  readonly sessions: readonly ExtraSession[];
  readonly finished: boolean;
}

/** Whether a kind of session takes the support queue. */
export function takesQueue(kind: ExtraKind): boolean {
  return SUPPORT_KINDS.includes(kind);
}

/**
 * The event that saves a class's queue as given, titles trimmed; refused for
 * an unknown course, a title that is empty, long or not one plain line, or
 * an ID twice.
 */
export function saveSupportQueue(state: State, queue: SupportQueue): RecordEvent {
  if (!state.courses.has(queue.courseId)) throw new RangeError('No such course');
  const items = queue.items.map((item) => ({ id: item.id, title: item.title.trim() }));
  if (items.some((item) => item.title === '')) throw new RangeError('An item has a title');
  if (items.some((item) => item.title.length > SUPPORT_TITLE_MAX)) throw new RangeError('The title is too long');
  if (!items.every((item) => isOneLine(item.title, SUPPORT_TITLE_MAX)))
    throw new RangeError('A title is one plain line');
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new RangeError('An item is listed twice');
  return { kind: 'support.set', queue: { courseId: queue.courseId, items } };
}

/** The class's sessions outside the timetable that took an item, in order, without the one `except` names. */
function takers(state: State, courseId: string, except?: string): ExtraSession[] {
  return [...state.extras.values()]
    .flatMap((versions) => {
      const extra = current(versions);
      return extra !== null && extra.courseId === courseId && extra.item !== undefined && extra.id !== except
        ? [extra]
        : [];
    })
    .sort(compareExtras);
}

/** The class's queue, each item with the sessions that took it. */
export function supportQueueRows(state: State, courseId: string): SupportRow[] {
  const taken = takers(state, courseId);
  return (state.supportQueues.get(courseId)?.items ?? []).map((item) => {
    const sessions = taken.filter((extra) => extra.item === item.id);
    return { item, sessions, finished: sessions.some((extra) => extra.finished === true) };
  });
}

/**
 * The first item no session finished, leaving out the session `except`
 * names, such as one being corrected; null when none.
 */
export function nextSupportItem(state: State, courseId: string, except?: string): SupportItem | null {
  const finished = new Set(
    takers(state, courseId, except).flatMap((extra) => (extra.finished === true ? [extra.item] : [])),
  );
  return state.supportQueues.get(courseId)?.items.find((item) => !finished.has(item.id)) ?? null;
}
