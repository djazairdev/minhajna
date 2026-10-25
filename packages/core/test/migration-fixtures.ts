// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A made-up fix 2026.2 of the maths example (#322): `l1` renamed `l1b`, `l2`
// split into `l2a` and `l2b`, `l5` and `l6` merged into `l56`, and `l7`
// removed; and a context whose phone has both releases.

import { makeContext, packKey, parsePlanPack, type Context, type PlanPack, type RecordBook } from '../src/index.ts';
import { mathPackSource, reference } from './reference-fixtures.ts';

type RawItem = (typeof mathPackSource)['items'][number];

/** The items with some IDs replaced: each by the IDs listed, none to drop it. */
export function edit(items: readonly RawItem[], changes: Record<string, readonly string[]>): RawItem[] {
  return items.flatMap((item) => {
    const into = changes[item.id];
    if (into === undefined) return [item];
    return into.map((id) => ({ ...item, id, title: `${item.title} ${id}` }));
  });
}

export const mathFixSource = {
  ...mathPackSource,
  release: '2026.2',
  merges: [],
  items: edit(mathPackSource.items, { l1: ['l1b'], l2: ['l2a', 'l2b'], l5: ['l56'], l6: [], l7: [] }),
  migration: {
    from: '2026.1',
    entries: [
      { kind: 'rename', from: 'l1', to: 'l1b' },
      { kind: 'split', from: 'l2', to: ['l2a', 'l2b'] },
      { kind: 'merge', from: ['l5', 'l6'], to: 'l56' },
      { kind: 'remove', item: 'l7' },
    ],
  },
};

function read(source: unknown): PlanPack {
  const result = parsePlanPack(source);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.value;
}

export const mathFix = read(mathFixSource);

/** The book's records with both releases of the maths example on the phone. */
export function withFix(book: RecordBook, ...more: readonly PlanPack[]): Context {
  const packs = new Map(reference.packs);
  for (const pack of [mathFix, ...more]) packs.set(packKey(pack.id, pack.release), pack);
  return makeContext({ ...reference, packs }, book.state);
}

/** A release made from the fix with the source's changes. */
export const releaseOf = (source: object): PlanPack => read({ ...mathFixSource, ...source });
