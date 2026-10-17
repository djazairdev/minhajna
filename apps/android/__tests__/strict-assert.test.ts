// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The storage check's assert, held to Node's own on the kinds of values the
// shared storage checks compare, and refusing any other kind.

import nodeAssert from 'node:assert/strict';
import assert, { AssertionError } from '../src/debug/strict-assert';

const entry = { seq: 0, id: 'a', content: { salt: 's', body: { text: 'ملاحظة 😀', values: [null, true, 1.5, ''] } } };

const pairs: [string, unknown, unknown][] = [
  ['same entry', entry, structuredClone(entry)],
  [
    'changed nested text',
    entry,
    { ...entry, content: { ...entry.content, body: { ...entry.content.body, text: 'x' } } },
  ],
  ['content erased', entry, { ...entry, content: null }],
  ['missing key', { a: 1, b: 2 }, { a: 1 }],
  ['extra key', { a: 1 }, { a: 1, b: 2 }],
  ['undefined key against none', { a: undefined }, {}],
  ['same keys, other order', { a: 1, b: 2 }, { b: 2, a: 1 }],
  ['number against string', 1, '1'],
  ['zero and minus zero', 0, -0],
  ['NaN and NaN', NaN, NaN],
  ['null and undefined', null, undefined],
  ['empty array and object', [], {}],
  ['array lengths', [1, 2], [1, 2, 3]],
  ['array order', [1, 2], [2, 1]],
  ['hole against undefined', [undefined], new Array(1)],
  ['null prototype', Object.create(null) as object, {}],
  ['two null prototypes', Object.create(null) as object, Object.create(null) as object],
  ['empty arrays', [], []],
  ['nested arrays', [[1], [2]], [[1], [2]]],
  ['strings', 'séance', 'séance'],
];

const passes = (run: () => void) => {
  try {
    run();
    return true;
  } catch {
    return false;
  }
};

describe('the storage check assert', () => {
  test.each(pairs)('deepEqual agrees with Node on %s', (_, actual, expected) => {
    expect(passes(() => assert.deepEqual(actual, expected))).toBe(passes(() => nodeAssert.deepEqual(actual, expected)));
  });

  test.each(pairs)('equal agrees with Node on %s', (_, actual, expected) => {
    expect(passes(() => assert.equal(actual, expected))).toBe(passes(() => nodeAssert.equal(actual, expected)));
  });

  test('both pass and fail somewhere, so the comparison means something', () => {
    const results = pairs.map(([, actual, expected]) => passes(() => assert.deepEqual(actual, expected)));
    expect(results).toContain(true);
    expect(results).toContain(false);
  });

  test('ok agrees with Node', () => {
    for (const value of [true, 1, 'a', {}, false, 0, '', null, undefined]) {
      expect(passes(() => assert.ok(value))).toBe(passes(() => nodeAssert.ok(value)));
    }
  });

  test('refuses values it does not know, even equal ones', () => {
    const date = new Date(0);
    expect(() => assert.deepEqual(date, date)).toThrow(AssertionError);
    expect(() => assert.deepEqual(new Date(0), new Date(0))).toThrow(AssertionError);
    expect(() => assert.deepEqual(new Map(), new Map())).toThrow(AssertionError);
    expect(() => assert.deepEqual({ [Symbol('s')]: 1 }, { [Symbol('s')]: 1 })).toThrow(AssertionError);
  });

  test('names the place of a difference, not the values', () => {
    expect(() => assert.deepEqual({ a: [1, { b: 'secret' }] }, { a: [1, { b: 'other' }] })).toThrow(
      new AssertionError('Values differ at $.a.1.b'),
    );
  });
});
