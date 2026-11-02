// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// How far each grade's classes got, as the server takes it and adds it up
// (#601, answer 631): a share's grades are read when it gives them, a grade's
// reach never above its classes, its classes at most the subject's, a name no
// object holds, at most 16 grades, in a share no heavier, and with no more
// grades and items, than the core makes one; the directorates' and the nation's
// grades add up the shares', a grade under the floor hidden with what would
// give it away within its figure, and across the nation and the directorates,
// even through a directorate holding one grade, the same however the shares
// came in; an item too few schools reached hidden with another, one no school
// reached showing as none; and a share without grades gives none. Every share
// is made up.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  MAX_SHARE_BYTES,
  MAX_SHARE_GRADES,
  MAX_SHARE_ITEMS,
  readShare,
  type GradeReach,
  type Share,
} from '../src/totals/share-read.js';
import { dayTotals, type DayTotals } from '../src/totals/share-sums.js';
import { madeUpShare } from './share-kit.js';

/** A made-up share of a directorate, with four math teachers of four classes and, when given, its math grades. */
function share(at: number, directorate: string, grades?: Record<string, GradeReach>): Share {
  const base = madeUpShare(at, '2026-12-06', 4);
  const math = base.subjects['math']!;
  return { ...base, directorate, subjects: { math: grades === undefined ? math : { ...math, grades } } };
}

const reach = (teachers: number, classes: number, ...items: [string, number][]): GradeReach => ({
  teachers,
  classes,
  items: Object.fromEntries(items),
});

const gradesOf = (one: { subjects: Record<string, { grades?: unknown } | null> }) => one.subjects['math']?.grades;

describe('how far each grade’s classes got', () => {
  it('is read when a share gives it, within the grade’s and the subject’s classes', () => {
    const graded = share(1, 'dir-01', { '1am': reach(2, 2, ['item-01', 2]) });
    assert.deepEqual(readShare(graded), graded);
    const refused = (grades: unknown) => {
      const math = { ...madeUpShare(1).subjects['math']!, grades };
      return typeof readShare({ ...madeUpShare(1), subjects: { math } }) === 'string';
    };
    assert.equal(refused({ '1am': reach(2, 2, ['item-01', 3]) }), true);
    assert.equal(refused({ '1am': reach(2, 3), '2am': reach(2, 2) }), true);
    assert.equal(refused(JSON.parse('{"__proto__":{"teachers":1,"classes":1,"items":{}}}')), true);
    assert.equal(refused({ '1am': { classes: 1, items: {} } }), true);
    assert.equal(refused({ '1am': { ...reach(1, 1), more: 1 } }), true);
    assert.equal(refused([]), true);
    const many = Object.fromEntries(Array.from({ length: 17 }, (_, at) => [`g${at}`, reach(1, 0)]));
    assert.equal(refused(many), true);
  });

  it('takes a share as heavy, and with as many grades and items, as the core may make one, and no more', () => {
    const core = (file: string) =>
      readFileSync(new URL(`../../../../packages/core/src/${file}`, import.meta.url), 'utf8');
    const [, many, size] = /export const SHARE_BYTES = (\d+) \* (\d+);/.exec(core('total-shares.ts')) ?? [];
    assert.equal(Number(many) * Number(size), MAX_SHARE_BYTES);
    const grades = core('share-grades.ts');
    assert.equal(Number(/export const MOST_GRADES = (\d+);/.exec(grades)?.[1]), MAX_SHARE_GRADES);
    assert.equal(Number(/export const MOST_GRADE_ITEMS = (\d+);/.exec(grades)?.[1]), MAX_SHARE_ITEMS);
  });

  it('adds up a directorate’s grades, hiding one under the floor with another of its figure', () => {
    const grades = (first: boolean) => ({
      '1am': reach(3, 2, ['item-01', 2]),
      '2am': reach(3, first ? 1 : 2, ['item-01', first ? 1 : 2], ['item-02', first ? 1 : 0]),
      ...(first ? { '3am': reach(2, 1) } : {}),
    });
    const shares = [1, 2, 3, 4].map((at) => share(at, 'dir-01', grades(at < 3)));
    const math = dayTotals('2026-12-06', shares, 'dir-01').directorates[0]!.subjects['math']!;
    assert.deepEqual(math.grades, {
      '1am': null,
      '2am': { teachers: 12, classes: 6, schools: 4, items: { 'item-01': 6, 'item-02': null } },
      '3am': null,
    });
  });

  it('never lets a hidden grade be worked out through a directorate holding one grade', () => {
    const one = (grade: string) => ({ [grade]: reach(4, 4, ['item-01', 4]) });
    const spread: [string, string, number][] = [
      ['dir-01', '2am', 2],
      ['dir-01', '1am', 4],
      ['dir-02', '2am', 3],
      ['dir-03', '1am', 3],
      ['dir-04', '2am', 5],
      ['dir-05', '1am', 5],
    ];
    let at = 0;
    const shares = spread.flatMap(([directorate, grade, count]) =>
      Array.from({ length: count }, () => share((at += 1), directorate, one(grade))),
    );
    const known = (totals: DayTotals, grade: string) => {
      const national = (gradesOf(totals.national!) as Record<string, { classes: number } | null>)[grade];
      if (national === null) return false;
      const others = totals.directorates.filter((row) => row.id !== 'dir-01');
      return others.every((row) => {
        const math = row.subjects['math'];
        if (math === null || math === undefined) return math === undefined;
        const held = (math.grades ?? {}) as Record<string, { classes: number } | null>;
        if (!(grade in held) || held[grade] !== null) return true;
        return Object.keys(held).length === 1;
      });
    };
    const ministry = dayTotals('2026-12-06', shares, null);
    assert.equal(ministry.directorates[0]!.subjects['math']?.grades?.['2am'] ?? null, null);
    assert.equal(known(ministry, '2am'), false);
    assert.deepEqual(dayTotals('2026-12-06', [...shares].reverse(), null), ministry);
  });

  it('hides an item too few schools reached, with another so it is not the nation less the others', () => {
    const item = (at: number, reached: number) =>
      share(at, at < 5 ? 'dir-01' : 'dir-02', { '1am': reach(4, 4, ['item-01', 4], ['item-02', reached]) });
    const shares = [1, 2, 3, 4, 5, 6, 7, 8].map((at) => item(at, at === 4 || at > 4 ? 1 : 0));
    const ministry = dayTotals('2026-12-06', shares, null);
    const items = ministry.directorates.map((one) => one.subjects['math']?.grades?.['1am']?.items['item-02']);
    assert.deepEqual(items, [null, null]);
    assert.equal(ministry.national!.subjects['math']!.grades!['1am']!.items['item-02'], 5);
    const none = dayTotals(
      '2026-12-06',
      [1, 2, 3, 4].map((at) => item(at, 0)),
      'dir-01',
    );
    assert.equal(none.directorates[0]!.subjects['math']!.grades!['1am']!.items['item-02'], 0);
  });

  it('gives no grades when no share gives them', () => {
    const shares = [1, 2, 3, 4].map((at) => share(at, 'dir-01'));
    assert.equal('grades' in dayTotals('2026-12-06', shares, 'dir-01').directorates[0]!.subjects['math']!, false);
  });
});
