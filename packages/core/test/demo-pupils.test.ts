// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo class's made-up pupils (#27): 45 names that look like a real
// Algerian class list, with the cases engineering.md asks for.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEMO_PUPILS, demoPupils } from '../src/index.ts';

const family = (name: string) => name.split(' ')[0];

describe('the demo class', () => {
  it('has 45 pupils, girls and boys, each named in Arabic and Latin letters', () => {
    assert.equal(DEMO_PUPILS.length, 45);
    assert.equal(new Set(DEMO_PUPILS.map((pupil) => pupil.name)).size, 45);
    assert.ok(DEMO_PUPILS.some((pupil) => pupil.sex === 'f') && DEMO_PUPILS.some((pupil) => pupil.sex === 'm'));
    for (const pupil of DEMO_PUPILS) {
      assert.match(pupil.name, /^[؀-ۿ ]+$/, pupil.name);
      assert.match(pupil.latinName, /^[A-Za-z ]+$/, pupil.latinName);
    }
  });

  it('has long names, hamzas and shared family names', () => {
    assert.ok(DEMO_PUPILS.some((pupil) => pupil.name.length >= 25));
    assert.ok(DEMO_PUPILS.filter((pupil) => /[ءأإآؤئ]/.test(pupil.name)).length >= 5);
    const families = DEMO_PUPILS.map((pupil) => family(pupil.name));
    const shared = families.filter((name, index) => families.indexOf(name) !== index);
    assert.ok(new Set(shared).size >= 3);
  });

  it('puts them in one class with new IDs and registration numbers no school gives out', () => {
    let next = 0;
    const pupils = demoPupils('c-1', () => `id-${++next}`);
    assert.equal(new Set(pupils.map((pupil) => pupil.id)).size, 45);
    assert.ok(pupils.every((pupil) => pupil.classId === 'c-1' && /^99\d{8}$/.test(pupil.registration ?? '')));
    assert.equal(new Set(pupils.map((pupil) => pupil.registration)).size, 45);
    assert.deepEqual(Object.keys(pupils[0] ?? {}).sort(), [
      'classId',
      'groups',
      'id',
      'latinName',
      'movements',
      'name',
      'registration',
      'sex',
    ]);
  });
});
