// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The reorientation screen's plan (#231, Reorient, answer 391): removing a
// new class, or leaving out the old class it takes, drops the pupils' choices
// for it and moves the later ones down, and taking an old class back in adds
// a new class of its name. Made-up classes only.

import { parseDay, type Reorientation, type SchoolClass } from '@minhajna/core';
import { removeClasses, toggleOld } from '../src/reorient/reorient-rules';

test('re-indexes the pupils’ choices when new classes go', () => {
  const old = (id: string, name: string) => ({ id, name }) as SchoolClass;
  const plan: Reorientation = {
    day: parseDay('2026-10-08'),
    olds: ['k-a', 'k-b'],
    classes: [
      { name: 'A', takes: 'k-a' },
      { name: 'B', takes: 'k-b' },
      { name: 'C', takes: 'k-b' },
      { name: 'D', takes: 'k-a' },
    ],
    pupils: new Map([
      ['p-1', 1],
      ['p-2', 3],
      ['p-3', null],
      ['p-4', 0],
    ]),
  };
  const fewer = removeClasses(plan, [1]);
  expect(fewer.classes.map((one) => one.name)).toEqual(['A', 'C', 'D']);
  expect([...fewer.pupils]).toEqual([
    ['p-2', 2],
    ['p-3', null],
    ['p-4', 0],
  ]);
  const without = toggleOld(plan, old('k-b', '2 ع ت 2'));
  expect(without.olds).toEqual(['k-a']);
  expect(without.classes.map((one) => one.name)).toEqual(['A', 'D']);
  expect([...without.pupils]).toEqual([
    ['p-2', 1],
    ['p-3', null],
    ['p-4', 0],
  ]);
  expect(toggleOld(without, old('k-b', '2 ع ت 2')).classes.at(-1)).toEqual({ name: '2 ع ت 2', takes: 'k-b' });
});
