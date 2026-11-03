// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The curriculum report's item names and order (#598, answer 629): an item is
// named by its title when every pack the directorate's classes pin for the
// subject that holds its ID agrees on the title, and by its ID otherwise; items
// come in the packs' order, an item no pack holds last, by ID; and a pack the
// reference data does not hold names nothing. Every pack and class is made up.

import type { DemoSchool, PlanPack } from '@minhajna/core';
import { itemNames } from '../src/directorate/item-names';

const pack = (id: string, items: readonly [string, string][]) =>
  ({
    id,
    release: '2026.1',
    items: items.map(([one, title]) => ({ id: one, kind: 'lesson', title })),
  }) as unknown as PlanPack;

const school = (pinned: readonly string[]) =>
  ({
    classes: pinned.map((id) => ({ packs: { arabic: { id, release: '2026.1' } } })),
  }) as unknown as DemoSchool;

const first = pack('dz.cem.1am.arabic.example', [
  ['u1-1', 'Reading 1'],
  ['u1-2', 'Grammar 1'],
  ['u1-10', 'Writing 1'],
]);
const fourth = pack('dz.cem.4am.arabic.example', [
  ['u1-2', 'Grammar 4'],
  ['u1-1', 'Reading 1'],
  ['u2-1', 'Poetry 4'],
]);

test('a title shows only when the packs agree, and items follow the packs’ order', () => {
  const names = itemNames([school([first.id]), school([fourth.id, 'dz.cem.2am.arabic.missing'])], [first, fourth]);
  expect(names.title('arabic', 'u1-1')).toBe('Reading 1');
  expect(names.title('arabic', 'u1-2')).toBeNull();
  expect(names.title('arabic', 'u2-1')).toBe('Poetry 4');
  expect(names.title('arabic', 'x9')).toBeNull();
  expect(names.title('math', 'u1-1')).toBeNull();
  const items = ['x9', 'u2-1', 'u1-10', 'u1-2', 'u1-1', 'a0'].map((one) => [one, 0] as const);
  expect(names.sorted('arabic', items).map(([one]) => one)).toEqual(['u1-1', 'u1-2', 'u1-10', 'u2-1', 'a0', 'x9']);
});

test('a pack no class pins names nothing', () => {
  const names = itemNames([school([first.id])], [first, fourth]);
  expect(names.title('arabic', 'u1-2')).toBe('Grammar 1');
  expect(names.title('arabic', 'u2-1')).toBeNull();
});
