// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pupils whose data was erased (#248, answers 473 and 474), as the state
// keeps them: each one's class, place on its list, the erasure's day and the
// day they left the list, read from the facts the history keeps. Apart from
// pupil-erase.ts, so the state needs nothing that reaches back to it. The
// books of a period that began before that day say how many pupils' data was
// erased.

import { compareDays, type Day } from './day.ts';
import { eventOf } from './events.ts';
import type { Entry } from './history.ts';
import type { Membership } from './pupil-history.ts';

/** A pupil whose data was erased, by what the numbering and the books still need. */
export interface ErasedPupil {
  readonly classId: string;
  /** The place in the history of the pupil's first entry, which gave their place on the class list. */
  readonly place: number;
  /** The day of the erasure. */
  readonly day: Day;
  /** The day the pupil left the list, or the erasure's day for an erasure that did not keep it. */
  readonly left: Day;
}

/**
 * Each erasure's class, the pupil's place on its list, the erasure's day and the day they left. An erasure not
 * finished yet, whose pupil is still on the list, has none, and a place is counted once.
 */
export function erasedPupils(
  entries: readonly Entry[],
  memberships: ReadonlyMap<string, readonly Membership[]>,
): ErasedPupil[] {
  const facts = entries.filter((entry) => entry.kind === 'pupil.erased');
  if (facts.length === 0) return [];
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const listed = new Set([...memberships.values()].flatMap((history) => history[0]?.order ?? []));
  const seen = new Set<string>();
  return facts.flatMap((entry) => {
    const event = eventOf(entry);
    if (event?.kind !== 'pupil.erased') return [];
    const places = event.erased.entries.flatMap((id) => {
      const target = byId.get(id);
      return target?.kind === 'pupil.set' ? [target.seq] : [];
    });
    const place = Math.min(...places);
    const key = `${event.erased.classId}/${place}`;
    if (places.length === 0 || listed.has(place) || seen.has(key)) return [];
    seen.add(key);
    return [{ classId: event.erased.classId, place, day: entry.day, left: event.erased.left ?? entry.day }];
  });
}

/** How many of the class's erased pupils were on its books of a period that began on `from`, before they left. */
export function erasedFrom(erased: readonly ErasedPupil[] | undefined, classId: string, from: Day): number {
  return (erased ?? []).filter((one) => one.classId === classId && compareDays(from, one.left) < 0).length;
}
