// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Names the totals server refuses (#601, answer 631): one starting with `__`
// or one an object already holds, such as `constructor`. A pack naming an item,
// unit, stage template or migration ID so, or a profile naming a grade or a
// subject so, is refused when read, rather than installed with weeks the share
// then leaves out. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseCountryProfile, parsePlanPack } from '../src/index.ts';
import { isName } from '../src/reference-fields.ts';
import { ITEM_ID } from '../src/pack-fields.ts';
import { mathPackSource } from './fixtures.ts';

const RESERVED = ['__proto__', '__x', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'];

function packProblems(source: unknown): unknown {
  const result = parsePlanPack(source);
  return result.ok ? [] : result.problems;
}

const profileSource = {
  format: 1,
  code: 'dz',
  release: '2026.1',
  weekStartsOn: 0,
  workingDays: [0, 1, 2, 3, 4],
  levels: [
    {
      code: 'cem',
      rollCallUnit: 'session',
      sessionMinutes: 60,
      name: { en: 'Middle school' },
      grades: [{ code: '1am', name: { en: 'Year 1' } }],
    },
  ],
  subjects: [{ code: 'math', name: { en: 'Mathematics' }, levels: ['cem'] }],
  sessionTypes: [{ code: 'lesson', queue: 'main', name: { en: 'Lesson' } }],
};

function profileProblems(source: unknown): unknown {
  const result = parseCountryProfile(source);
  return result.ok ? [] : result.problems;
}

describe('names the totals refuse', () => {
  it('takes a name of the shape that no object holds', () => {
    for (const name of ['l1', '_x', 'x__', 'Constructor', 'proto', 'u1.a-b']) assert.equal(isName(name, ITEM_ID), true);
    for (const name of [...RESERVED, '', 'a b', 1, null]) assert.equal(isName(name, ITEM_ID), false, String(name));
  });

  it('refuses a pack naming an item so', () => {
    for (const id of RESERVED) {
      const items = [...mathPackSource.items, { id, kind: 'lesson', title: 'Reserved', budget: 1 }];
      assert.deepEqual(packProblems({ ...mathPackSource, items }), [{ path: 'items[14].id', problem: 'invalid' }], id);
    }
  });

  it('refuses an item naming its unit or stages so', () => {
    const named = (fields: object) => ({
      ...mathPackSource,
      items: [...mathPackSource.items, { id: 'x', kind: 'lesson', title: 'X', budget: 1, ...fields }],
    });
    assert.deepEqual(packProblems(named({ unit: 'constructor' })), [{ path: 'items[14].unit', problem: 'invalid' }]);
    assert.deepEqual(packProblems(named({ stages: '__proto__' })), [{ path: 'items[14].stages', problem: 'invalid' }]);
  });

  it('refuses a stage template named so', () => {
    const stageTemplates = [...mathPackSource.stageTemplates, { id: 'valueOf', stages: ['One'] }];
    assert.deepEqual(packProblems({ ...mathPackSource, stageTemplates }), [
      { path: 'stageTemplates[1].id', problem: 'invalid' },
    ]);
  });

  it('refuses a migration entry naming an old ID so', () => {
    const migration = { from: '2026.1', entries: [{ kind: 'remove', item: 'toString' }] };
    assert.deepEqual(packProblems({ ...mathPackSource, release: '2026.2', migration }), [
      { path: 'migration.entries[0].item', problem: 'invalid' },
    ]);
  });

  it('refuses a profile naming a grade or a subject so', () => {
    const [cem] = profileSource.levels;
    const grades = [{ code: 'constructor', name: { en: 'Odd' } }];
    assert.deepEqual(profileProblems({ ...profileSource, levels: [{ ...cem, grades }] }), [
      { path: 'levels[0].grades[0].code', problem: 'invalid' },
    ]);
    const subjects = [{ code: 'constructor', name: { en: 'Odd' }, levels: ['cem'] }];
    assert.deepEqual(profileProblems({ ...profileSource, subjects }), [
      { path: 'subjects[0].code', problem: 'invalid' },
    ]);
    assert.deepEqual(profileProblems(profileSource), []);
  });
});
