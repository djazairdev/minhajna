// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What a justification adds up (#239, answers 443 and 454): a pupil's
// component marks in a term or a month, T once every component has one, a
// mark above points since lowered counted as empty; and the term average by
// CEM's and primary's formulas, none while a weighted part is missing.
// Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { componentTotal, setMark, termAverage, type SetupLine } from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

const line = (id: string, points: number): SetupLine => ({ kind: 'column', id, name: id, points, min: 1, max: 10 });
const lines = [line('a', 6), line('b', 4)];
const mark = (id: string, value: number, max: number, month?: string) =>
  setMark(
    {
      courseId: 'c-math',
      term: 1,
      target: { kind: 'component', componentId: id, ...(month !== undefined && { month }) },
      pupilId: 'p01',
    },
    value,
    max,
  );

test('T is the sum of the component marks once every one has a mark', async () => {
  const book = await openBook(cemEvents());
  const total = () => componentTotal(book.state, 'c-math', 1, lines, 'p01');
  assert.deepEqual([total().total, total().empty], [null, 2]);
  await book.record(d('2026-10-01'), mark('a', 4.5, 6));
  assert.deepEqual([total().total, total().empty], [null, 1]);
  await book.record(d('2026-10-01'), mark('b', 3.25, 4));
  assert.deepEqual([total().total, total().marks.map((one) => one.mark)], [7.75, [4.5, 3.25]]);
  const lowered = [line('a', 4), line('b', 4)];
  assert.deepEqual(componentTotal(book.state, 'c-math', 1, lowered, 'p01').empty, 1);
  assert.equal(componentTotal(book.state, 'c-math', 1, [], 'p01').total, null);
});

test('a month’s marks are its own', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-01'), mark('a', 5, 6, '2026-10'));
  await book.record(d('2026-10-01'), mark('b', 2, 4, '2026-10'));
  assert.equal(componentTotal(book.state, 'c-math', 1, lines, 'p01', '2026-10').total, 7);
  assert.equal(componentTotal(book.state, 'c-math', 1, lines, 'p01', '2026-11').total, null);
  assert.equal(componentTotal(book.state, 'c-math', 1, lines, 'p01').total, null);
});

test('the term average follows the formula, and waits for every part it weighs', () => {
  const cem = { weights: { T: 1, F: 1, E: 4 } };
  assert.equal(termAverage(cem, { T: 13.5, F: 10.75, E: 10 })?.toFixed(4), '10.7083');
  assert.equal(termAverage(cem, { T: 13.5, F: null, E: 10 }), null);
  assert.equal(termAverage(cem, { T: 13.5, E: 10 }), null);
  assert.equal(termAverage({ weights: { E: 1 } }, { E: 7.5 }), 7.5);
  assert.equal(termAverage({ weights: { T: 1, E: 1 } }, { T: 8, E: 6, F: 9 }), 7);
  assert.equal(termAverage({ weights: {} }, { T: 8 }), null);
});
