// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The totals of an announced day (#596, answer 628): the server's floors are
// the core's, byte for byte; the Ministry's view adds each directorate's
// shares by subject and over every subject, and the nation's, items included
// by subject, and hides a directorate under the wilaya floor, and another so
// it is not the nation less the others, while the nation still shows; a
// directorate's own view shows its figures under the directorate floor, a
// subject of too few teachers hidden with what would give it away, and hides
// as well what would give away, with the Ministry's view, a figure hidden in
// both; a plan item fewer than three schools did is hidden, with another so it
// is not the nation's less the others; a teacher of several subjects counts
// once over every subject, at least; a directorate with no share shows nothing
// but zeros; and no figure is ever one share's. Every share is made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import type { Share } from '../src/totals/share-read.js';
import { dayTotals } from '../src/totals/share-sums.js';
import { madeUpShare } from './share-kit.js';

const ITEM = { sessions: 0, merged: 0, skipped: 0, retaught: 0 };

/** A made-up share of a directorate, with its math and, when given, its Arabic teachers. */
function share(at: number, directorate: string, math: number, arabic = 0): Share {
  const base = madeUpShare(at, '2026-12-06', math);
  const subjects =
    arabic === 0 ? base.subjects : { ...base.subjects, arabic: { ...base.subjects['math']!, teachers: arabic } };
  return { ...base, directorate, subjects };
}

/** Made-up shares of `count` schools of a directorate, their IDs from `from`, each of `math` math teachers. */
const schools = (from: number, count: number, directorate: string, math: number, arabic = 0): Share[] =>
  Array.from({ length: count }, (_, at) => share(from + at, directorate, math, arabic));

describe('the day’s totals', () => {
  it('runs on a byte-for-byte copy of the core’s floors', () => {
    const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal(read('../../src/totals/floors.ts'), read('../../../../packages/core/src/floors.ts'));
  });

  it('adds up every directorate and the nation for the Ministry, items by subject', () => {
    const totals = dayTotals('2026-12-06', [...schools(1, 3, 'dir-01', 4), ...schools(6, 4, 'dir-03', 4)], null);
    assert.deepEqual(
      totals.directorates.map((one) => one.id),
      ['dir-01', 'dir-03'],
    );
    const [first] = totals.directorates;
    const math = first!.subjects['math']!;
    assert.deepEqual([math.teachers, math.schools, math.classes, math.cover, math.reached], [12, 3, 12, 3, 5400]);
    assert.deepEqual(math.items, { 'item-01': { sessions: 36, merged: 0, skipped: 3, retaught: 0 } });
    assert.deepEqual(first!.all, Object.fromEntries(Object.entries(math).filter(([field]) => field !== 'items')));
    const nation = totals.national!.subjects['math']!;
    assert.deepEqual([nation.teachers, nation.schools, nation.items!['item-01']!.sessions], [28, 7, 84]);
    assert.deepEqual([totals.national!.all!.teachers, totals.national!.all!.schools], [28, 7]);
  });

  it('hides a directorate under the wilaya floor, and another so it is not the nation less the others', () => {
    const shares = [...schools(1, 3, 'dir-01', 4), ...schools(4, 2, 'dir-02', 5), ...schools(6, 4, 'dir-03', 4)];
    const totals = dayTotals('2026-12-06', shares, null);
    const shown = totals.directorates.map((one) => [one.id, one.subjects['math'] !== null, one.all !== null]);
    assert.deepEqual(shown, [
      ['dir-01', false, false],
      ['dir-02', false, false],
      ['dir-03', true, true],
    ]);
    const nation = totals.national!.subjects['math']!;
    assert.deepEqual([nation.teachers, nation.schools], [38, 9]);
  });

  it('shows a directorate its own figures under the directorate floor, hiding what would give one away', () => {
    const shares = [...schools(1, 3, 'dir-01', 3, 1), share(4, 'dir-02', 9)];
    const own = dayTotals('2026-12-06', shares, 'dir-01');
    assert.equal(own.national, undefined);
    assert.deepEqual(
      own.directorates.map((one) => one.id),
      ['dir-01'],
    );
    const [directorate] = own.directorates;
    assert.equal(directorate!.subjects['arabic'], null);
    assert.equal(
      directorate!.subjects['math'] === null || directorate!.all === null,
      true,
      'the math figure and the figure over every subject never both show beside a hidden Arabic',
    );
    const none = dayTotals('2026-12-06', shares, 'dir-09');
    const zeros = { teachers: 0, schools: 0, vacantPosts: 0, hoursWithoutTeacher: 0, classes: 0, cover: 0, closed: 0 };
    assert.deepEqual(none.directorates, [{ id: 'dir-09', subjects: {}, all: { ...zeros, reached: 0, runLong: 0 } }]);
  });

  it('hides in a directorate’s own view what, with the Ministry’s, would give away a figure both hide', () => {
    const shares = [...schools(1, 3, 'dir-01', 4, 1), ...schools(4, 3, 'dir-02', 4, 3)];
    const arabic = dayTotals('2026-12-06', shares, null).national!.subjects['arabic']!;
    assert.deepEqual([arabic.teachers, arabic.schools], [12, 6]);
    assert.equal(dayTotals('2026-12-06', shares, 'dir-01').directorates[0]!.subjects['arabic'], null);
    assert.equal(dayTotals('2026-12-06', shares, 'dir-02').directorates[0]!.subjects['arabic'], null);
  });

  it('hides from the Ministry a directorate under the wilaya floor that its own view shows', () => {
    const shares = [...schools(1, 3, 'dir-01', 2), ...schools(4, 4, 'dir-02', 4), ...schools(8, 4, 'dir-03', 4)];
    const own = dayTotals('2026-12-06', shares, 'dir-01').directorates[0]!;
    assert.deepEqual([own.subjects['math']!.teachers, own.subjects['math']!.schools, own.all!.teachers], [6, 3, 6]);
    const ministry = dayTotals('2026-12-06', shares, null);
    const math = ministry.directorates.map((one) => one.subjects['math']?.teachers ?? null);
    assert.deepEqual(math, [null, 16, 16]);
    assert.deepEqual([ministry.directorates[0]!.all, ministry.national!.all!.teachers], [null, 38]);
  });

  it('hides a plan item fewer than three schools did, and another so it is not the nation less the others', () => {
    const withItem = (one: Share, item: string, sessions: number): Share => {
      const math = one.subjects['math']!;
      return { ...one, subjects: { math: { ...math, items: { ...math.items, [item]: { ...ITEM, sessions } } } } };
    };
    const shares = [
      ...schools(1, 3, 'dir-01', 4).map((one, at) => (at === 2 ? withItem(one, 'item-02', 7) : one)),
      ...schools(4, 4, 'dir-02', 4).map((one) => withItem(one, 'item-02', 5)),
      ...schools(8, 4, 'dir-03', 4).map((one) => withItem(one, 'item-02', 6)),
    ];
    const ministry = dayTotals('2026-12-06', shares, null);
    const items = ministry.directorates.map((one) => one.subjects['math']?.items?.['item-02']?.sessions ?? null);
    assert.deepEqual(items, [null, null, 24]);
    assert.equal(ministry.national!.subjects['math']!.items!['item-02']!.sessions, 51);
    assert.equal(ministry.directorates[1]!.subjects['math']!.items!['item-01']!.sessions, 48);
    assert.equal(dayTotals('2026-12-06', shares, 'dir-01').directorates[0]!.subjects['math']!.items!['item-02'], null);
    const lone = dayTotals(
      '2026-12-06',
      [...schools(1, 3, 'dir-01', 4), withItem(share(4, 'dir-01', 4), 'item-09', 2)],
      'dir-01',
    );
    assert.equal(lone.directorates[0]!.subjects['math']!.items!['item-09'], null);
  });

  it('counts a teacher of several subjects once over every subject, at least', () => {
    const own = dayTotals('2026-12-06', schools(1, 4, 'dir-01', 3, 3), 'dir-01').directorates[0]!;
    assert.deepEqual([own.subjects['math']!.teachers, own.subjects['arabic']!.teachers], [12, 12]);
    assert.deepEqual([own.all!.teachers, own.all!.schools], [12, 4]);
  });

  it('never shows one share’s figures', () => {
    const lone = dayTotals('2026-12-06', [share(1, 'dir-01', 30)], null);
    assert.deepEqual(
      [
        lone.directorates[0]!.subjects['math'],
        lone.directorates[0]!.all,
        lone.national!.subjects['math'],
        lone.national!.all,
      ],
      [null, null, null, null],
    );
    assert.deepEqual(dayTotals('2026-12-06', [share(1, 'dir-01', 30)], 'dir-01').directorates[0]!.all, null);
  });
});
