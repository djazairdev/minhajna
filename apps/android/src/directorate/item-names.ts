// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The plan items' names and order in the directorate's curriculum report
// (#598, answer 629): a share keys an item by its ID alone, which several
// grades' packs reuse, so an item is named by its title only when every pack
// the directorate's classes pin for the subject that holds the ID gives it the
// same title, and by its ID otherwise; items come in the order the first pack
// holding them gives, the packs taken as the classes pin them, and an item no
// pack holds comes last, by ID. A pack the reference data does not hold names
// nothing.

import { packKey, type DemoSchool, type PlanPack } from '@minhajna/core';

/** How the report names and orders a subject's items. */
export interface ItemNames {
  /** An item's title, or null when the packs do not agree on one. */
  readonly title: (subject: string, item: string) => string | null;
  /** A subject's items in the packs' order. */
  readonly sorted: <T>(subject: string, items: readonly (readonly [string, T])[]) => (readonly [string, T])[];
}

/** The names and order the directorate's classes' pinned packs give, by subject and item. */
export function itemNames(schools: readonly DemoSchool[], packs: readonly PlanPack[]): ItemNames {
  const byKey = new Map(packs.map((pack) => [packKey(pack.id, pack.release), pack]));
  const titles = new Map<string, Map<string, string | null>>();
  const seen = new Set<string>();
  for (const one of schools.flatMap((school) => school.classes)) {
    for (const [subject, pinned] of Object.entries(one.packs)) {
      const key = packKey(pinned.id, pinned.release);
      const pack = byKey.get(key);
      if (pack === undefined || seen.has(`${subject}\n${key}`)) continue;
      seen.add(`${subject}\n${key}`);
      const held = titles.get(subject) ?? new Map<string, string | null>();
      for (const item of pack.items) {
        held.set(item.id, held.has(item.id) && held.get(item.id) !== item.title ? null : item.title);
      }
      titles.set(subject, held);
    }
  }
  const order = new Map(
    [...titles].map(([subject, held]) => [subject, new Map([...held.keys()].map((id, i) => [id, i]))]),
  );
  const at = (subject: string, item: string) => order.get(subject)?.get(item) ?? Number.MAX_SAFE_INTEGER;
  return {
    title: (subject, item) => titles.get(subject)?.get(item) ?? null,
    sorted: (subject, items) =>
      [...items].sort(([a], [b]) => at(subject, a) - at(subject, b) || (a < b ? -1 : a > b ? 1 : 0)),
  };
}
