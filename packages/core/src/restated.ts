// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Records restated without a pupil whose data was erased (#248, answer 473).
// A roll call or a seating plan is shared by the class, so erasing a pupil
// cannot erase it whole: each of its versions is written again without the
// pupil, naming the entry it replaces, and the old versions are then erased.
// A restated version stands where the one it replaces stood, with that
// entry's day and place in the history, so the books and their corrections
// read as before. Once restated, an entry no longer counts, even before its
// erasure is written. A version restated again, when a second pupil's data
// is erased, names the entry it first stood for, whose header always stays,
// and the newer restatement replaces the older.

import { eventOf, type RecordEvent } from './events.ts';
import type { Entry } from './history.ts';

/** A version restated without a pupil names the entry it replaces (answer 473). */
export interface Restating {
  readonly restates?: string;
}

/** The restated versions, each with the entry it stands for, and the entries replaced. */
export interface Restatements {
  readonly of: ReadonlyMap<string, Entry>;
  readonly replaced: ReadonlySet<string>;
}

/** The record a restatable event sets, or null for an event that is never restated. */
export function sharedKey(event: RecordEvent): string | null {
  switch (event.kind) {
    case 'roll-call.taken':
      return `roll-call:${event.rollCall.unit}`;
    case 'seating.set':
      return `seating:${event.plan.classId}/${event.plan.groupId}`;
    default:
      return null;
  }
}

/**
 * Every restatement that holds: of an earlier entry of the same kind that is not itself a restatement, for the same
 * record as that entry or the restatement before, while either's content is there to compare. The latest
 * restatement of an entry stands, and replaces the ones before it.
 */
export function restatements(entries: readonly Entry[]): Restatements {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const of = new Map<string, Entry>();
  const standing = new Map<string, string>();
  const replaced = new Set<string>();
  for (const entry of entries) {
    const event = eventOf(entry);
    const key = event === null ? null : sharedKey(event);
    if (event === null || key === null || !('restates' in event) || event.restates === undefined) continue;
    const original = byId.get(event.restates);
    if (original === undefined || original.seq >= entry.seq || original.kind !== entry.kind) continue;
    if (of.has(original.id)) continue;
    const older = standing.get(original.id);
    const olderEntry = older === undefined ? undefined : byId.get(older);
    const before = eventOf(original) ?? (olderEntry === undefined ? null : eventOf(olderEntry));
    if (before !== null && sharedKey(before) !== key) continue;
    if (older !== undefined) {
      of.delete(older);
      replaced.add(older);
    }
    of.set(entry.id, original);
    standing.set(original.id, entry.id);
    replaced.add(original.id);
  }
  return { of, replaced };
}

/**
 * A record's versions in the order they stand, a restated one at the place of the entry it replaced, so the
 * current version is right even while an erasure is not finished.
 */
export function standingOrder<T extends { readonly entry: string }>(
  versions: readonly T[],
  entries: readonly Entry[],
  restated: Restatements,
): T[] {
  const seqs = new Map(entries.map((entry) => [entry.id, entry.seq]));
  const place = (id: string) => restated.of.get(id)?.seq ?? seqs.get(id) ?? Infinity;
  return [...versions].sort((a, b) => place(a.entry) - place(b.entry));
}
