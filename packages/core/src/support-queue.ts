// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class's support queue (#228, R-4.7-08, PRD §4.7, answers 359 and 360):
// the teacher's own list of support items, in order, kept whole for each
// course. Each support or «تدارك» session logged for the class takes the
// first item it has not finished; the session keeps the item it took and
// whether it finished it, so editing the list never rewrites the past. The
// queue never moves the main plan nor counts in its buffers or delay.
//
// Each course also has a remediation list, kept apart (#230, R-4.7-07,
// answer 376). A timetabled «دعم» session takes the support list and a
// timetabled «معالجة» session the remediation list; the session's record
// keeps the item and whether it finished it.

import { inherited, lineageIds } from './lineage.ts';
import { isOneLine } from './calendar-notice-read.ts';
import { compareDays, type Day } from './day.ts';
import type { RecordEvent } from './events.ts';
import { compareExtras, type ExtraKind } from './extra-records.ts';
import type { Details } from './choices.ts';
import { compareSlots, type SessionRecord } from './records.ts';
import type { State } from './state-type.ts';
import { current } from './versions.ts';

/** The kinds of session outside the timetable that take the support queue. */
export const SUPPORT_KINDS: readonly ExtraKind[] = ['support', 'catch-up'];

/** A course's two lists: support, the list of #228, and remediation. */
export const LIST_KINDS = ['support', 'remediation'] as const;

export type ListKind = (typeof LIST_KINDS)[number];

/** The longest item title, in characters. */
export const SUPPORT_TITLE_MAX = 120;

export interface SupportItem {
  readonly id: string;
  readonly title: string;
}

export interface SupportQueue {
  readonly courseId: string;
  /** Set for the remediation list; the support list has none. */
  readonly kind?: 'remediation';
  readonly items: readonly SupportItem[];
}

/** A session that took an item: logged outside the timetable, or a timetabled one recorded. */
export interface ListTaker {
  readonly id: string;
  readonly day: Day;
  readonly item: string;
  readonly finished: boolean;
}

/** An item of a list with the sessions that took it, in order, and whether one finished it. */
export interface SupportRow {
  readonly item: SupportItem;
  readonly sessions: readonly ListTaker[];
  readonly finished: boolean;
}

/** The key a course's list has in the state. */
export function listKey(courseId: string, kind: ListKind = 'support'): string {
  return kind === 'remediation' ? `${courseId}/remediation` : courseId;
}

/** The kind of a queue. */
export function kindOf(queue: Pick<SupportQueue, 'kind'>): ListKind {
  return queue.kind ?? 'support';
}

/** The list a timetabled session of this type takes, if any. */
export function listOfType(sessionType: string): ListKind | null {
  return (LIST_KINDS as readonly string[]).includes(sessionType) ? (sessionType as ListKind) : null;
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
  const remediation = queue.kind === 'remediation';
  return { kind: 'support.set', queue: { courseId: queue.courseId, ...(remediation && { kind: queue.kind }), items } };
}

/**
 * The sessions that took an item of the class's list, in order, without the
 * one `except` names: for support, those logged outside the timetable, then
 * on each day the timetabled ones recorded.
 */
function takers(state: State, courseId: string, kind: ListKind, except?: string): ListTaker[] {
  const courses = new Set(lineageIds(state, courseId));
  const extras =
    kind !== 'support'
      ? []
      : [...state.extras.values()]
          .flatMap((versions) => {
            const extra = current(versions);
            return extra !== null && courses.has(extra.courseId) && extra.item !== undefined && extra.id !== except
              ? [extra]
              : [];
          })
          .sort(compareExtras)
          .map((extra) => ({
            id: extra.id,
            day: extra.day,
            item: extra.item ?? '',
            finished: extra.finished === true,
          }));
  const held = [...state.sessions.values()]
    .flatMap((versions): SessionRecord[] => {
      const record = current(versions);
      return record !== null &&
        courses.has(record.session.courseId) &&
        record.listItem !== undefined &&
        listOfType(record.sessionType) === kind &&
        record.session.key !== except
        ? [record]
        : [];
    })
    .sort((a, b) => compareDays(a.session.day, b.session.day) || compareSlots(a.session.slot, b.session.slot))
    .map((record) => ({
      id: record.session.key,
      day: record.session.day,
      item: record.listItem?.id ?? '',
      finished: record.listItem?.finished === true,
    }));
  return [...extras, ...held].sort((a, b) => compareDays(a.day, b.day));
}

/**
 * A correction's details with the item the session took kept, unless they
 * name one or the session moves to a type that takes another list or none.
 */
export function keptListItem(details: Details, recorded: SessionRecord | null, sessionType: string): Details {
  const before = recorded?.listItem;
  if (details.listItem !== undefined || recorded === null || before === undefined) return details;
  const kind = listOfType(sessionType);
  return { ...details, listItem: kind !== null && kind === listOfType(recorded.sessionType) ? before : null };
}

/**
 * Refuses a list item on a session whose type takes no list, or an item its
 * list does not hold, unless the session already had it from the same list,
 * as a correction may.
 */
export function checkListItem(state: State, record: SessionRecord, before: SessionRecord | null): void {
  const taken = record.listItem;
  if (taken === undefined) return;
  const kind = listOfType(record.sessionType);
  if (kind === null) throw new RangeError('Only a support or remediation session takes a list item');
  const kept = before !== null && taken.id === before.listItem?.id && listOfType(before.sessionType) === kind;
  const listed = supportListOf(state, record.session.courseId, kind)?.items.some((one) => one.id === taken.id);
  if (listed !== true && !kept) throw new RangeError('No such list item');
}

/** The class's list, or that of the class whose history it took (#231). */
export function supportListOf(state: State, courseId: string, kind: ListKind): SupportQueue | undefined {
  return inherited(state, courseId, (id) => state.supportQueues.get(listKey(id, kind)));
}

/** The class's list, each item with the sessions that took it. */
export function supportQueueRows(state: State, courseId: string, kind: ListKind = 'support'): SupportRow[] {
  const taken = takers(state, courseId, kind);
  return (supportListOf(state, courseId, kind)?.items ?? []).map((item) => {
    const sessions = taken.filter((one) => one.item === item.id);
    return { item, sessions, finished: sessions.some((one) => one.finished) };
  });
}

/**
 * The first item no session finished, leaving out the session `except`
 * names, such as one being corrected; null when none.
 */
export function nextSupportItem(
  state: State,
  courseId: string,
  except?: string,
  kind: ListKind = 'support',
): SupportItem | null {
  const finished = new Set(takers(state, courseId, kind, except).flatMap((one) => (one.finished ? [one.item] : [])));
  return supportListOf(state, courseId, kind)?.items.find((item) => !finished.has(item.id)) ?? null;
}

/** Whether a logged session other than `except` names the scheduled support session `id`, which ends it. */
export function supportEnded(state: State, id: string, except?: string): boolean {
  return [...state.extras.values()].some((versions) => {
    const extra = current(versions);
    return extra !== null && extra.scheduled === id && extra.id !== except;
  });
}
