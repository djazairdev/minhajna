// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Parallel classes and «مواءمة … مع X» (#225, R-4.7-36, answer 286): a
// second made-up class, 1AM3, on the same pack, taught on other weekdays.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { alignChange, parallelCourses, planView, recordChange } from '../src/index.ts';
import { contextOf, d, openBook } from './fixtures.ts';
import { teach, twoClasses } from './parallel-fixtures.ts';

describe('Parallel classes', () => {
  it('pairs classes of the same subject, grade, school, year and pack', async () => {
    const context = contextOf(await openBook(twoClasses()));
    assert.deepEqual(
      parallelCourses(context, 'c-math').map((course) => course.id),
      ['c-math3'],
    );
    assert.deepEqual(
      parallelCourses(context, 'c-math3').map((course) => course.id),
      ['c-math'],
    );
  });

  it('aligns a class behind another on its next item, the items passed following it', async () => {
    const book = await openBook(twoClasses());
    await teach(book, 'c-math', '2026-09-24');
    const day = d('2026-09-25');
    const ahead = planView(contextOf(book), 'c-math', day)!.main.find((row) => row.position)!.item.id;
    const behind = planView(contextOf(book), 'c-math3', day)!.main.find((row) => row.position)!.item.id;
    assert.notEqual(ahead, behind);
    assert.equal(alignChange(contextOf(book), 'c-math', 'c-math3', day, 'x'), null);
    const change = alignChange(contextOf(book), 'c-math3', 'c-math', day, 'a1');
    assert.deepEqual(change, {
      id: 'a1',
      courseId: 'c-math3',
      day,
      seq: 1,
      kind: 'move',
      item: ahead,
      before: behind,
      align: 'k-1am2',
    });
    await book.record(day, recordChange(contextOf(book), change));
    const main = planView(contextOf(book), 'c-math3', day)!.main;
    assert.equal(main.find((row) => row.position)?.item.id, ahead);
    assert.equal(main[main.findIndex((row) => row.item.id === ahead) + 1]?.item.id, behind);
    assert.equal(main.length, planView(contextOf(book), 'c-math', day)!.main.length);
  });
});
