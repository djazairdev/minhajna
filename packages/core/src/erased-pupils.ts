// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pupils whose data was erased (#248, answer 473), as the state keeps
// them: each one's class, place on its list and the erasure's day, read from
// the facts the history keeps. Apart from pupil-erase.ts, so the state needs
// nothing that reaches back to it.

import type { Day } from './day.ts';
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
}

/**
 * Each erasure's class, the pupil's place on its list and the erasure's day. An erasure not finished yet, whose
 * pupil is still on the list, has none, and a place is counted once.
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
    return [{ classId: event.erased.classId, place, day: entry.day }];
  });
}
