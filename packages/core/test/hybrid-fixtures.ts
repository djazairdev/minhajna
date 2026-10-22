// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The example mathematics pack made hybrid, for the weekly targets (#231,
// answer 387): «Comparing and ordering» due by teaching week 2, «Planning a
// class trip» by week 4, and «Comparing fractions» by week 10. Made up.

import { makeContext, packKey, type Context, type PlanPack, type RecordBook } from '../src/index.ts';
import { mathPack, reference } from './fixtures.ts';

const targets = new Map([
  ['l2', 2],
  ['i1', 4],
  ['l7', 10],
]);

export const hybridPack = {
  ...mathPack,
  anchor: { kind: 'hybrid' as const, unit: 'hours' as const },
  items: mathPack.items.map((item) => (targets.has(item.id) ? { ...item, week: targets.get(item.id)! } : item)),
};

/** The book's context with the example mathematics pack made hybrid, or replaced by `pack`. */
export function hybridContext(book: RecordBook, pack: PlanPack = hybridPack): Context {
  const packs = new Map([...reference.packs, [packKey(pack.id, pack.release), pack]]);
  return makeContext({ ...reference, packs }, book.state);
}
