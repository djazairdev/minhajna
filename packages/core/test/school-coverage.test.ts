// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Which calendar entries cover a school that teaches more than one level,
// and one whose wilaya is not set yet (#25). Made-up schools and entries.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appliesTo, parseDay, type CalendarEntry, type School, type SchoolClass } from '../src/index.ts';

const entry = (fields: Partial<CalendarEntry>): CalendarEntry => ({
  id: 'entry',
  layer: 'national',
  from: parseDay('2026-11-18'),
  to: parseDay('2026-11-18'),
  effect: 'closure',
  name: { en: 'Made-up closure' },
  source: 'Made-up notice',
  confidence: 'announced',
  ...fields,
});

const school: School = { id: 's-1', name: 'Example school', levels: ['primary', 'cem'], subjects: ['english'] };
const inWilaya: School = { ...school, zone: '16' };
const primaryClass: SchoolClass = {
  id: 'c-1',
  schoolId: 's-1',
  level: 'primary',
  grade: '3ap',
  name: '3AP1',
  groups: [{ id: 'g-1', kind: 'whole', name: '3AP1' }],
};

describe('a school with several levels', () => {
  it('is covered by an entry for any of its levels', () => {
    assert.equal(appliesTo(entry({ levels: ['cem'] }), school), true);
    assert.equal(appliesTo(entry({ levels: ['primary'] }), school), true);
    assert.equal(appliesTo(entry({ levels: ['lycee'] }), school), false);
  });

  it('goes by the class level when a class is given', () => {
    assert.equal(appliesTo(entry({ levels: ['primary'] }), school, primaryClass), true);
    assert.equal(appliesTo(entry({ levels: ['cem'] }), school, primaryClass), false);
  });
});

describe('a school whose wilaya is not set', () => {
  it('takes no zone entry until its wilaya is set', () => {
    assert.equal(appliesTo(entry({ layer: 'zone', zone: '16' }), school), false);
    assert.equal(appliesTo(entry({ layer: 'zone', zone: '16' }), inWilaya), true);
    assert.equal(appliesTo(entry({ layer: 'zone', zone: '31' }), inWilaya), false);
  });

  it('still takes national entries', () => {
    assert.equal(appliesTo(entry({}), school), true);
  });
});
