// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Marks (#239, answers 439 and 440): what a typed mark must be; the last
// mark recorded counting, an absence, and a cleared mark; the entry check's
// counts, empty cells and pupils not on the list; and marks kept with the
// pupil records, travelling where they do.
// Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  entryCheck,
  layerOf,
  markProblem,
  marksFor,
  recordsForRoute,
  setMark,
  targetKey,
  type MarkTarget,
  type MarkValue,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

const T1: MarkTarget = { kind: 'test', testId: 't-1' };
const T2: MarkTarget = { kind: 'test', testId: 't-2' };

const mark = (target: MarkTarget, pupilId: string, value: MarkValue | null, max = 20) =>
  setMark({ courseId: 'c-math', term: 1, target, pupilId }, value, max);

test('a mark has two decimals at most, from 0 to its maximum', () => {
  assert.deepEqual(
    [12.5, 20, 0, 20.25, 10.333, -1, Number.NaN].map((value) => markProblem(value, 20)),
    [null, null, null, 'over', 'invalid', 'invalid', 'invalid'],
  );
  assert.throws(() => mark(T1, 'p01', 20.25), /above the maximum/);
  assert.throws(() => mark(T1, 'p01', 10.333), /two decimals/);
  assert.throws(() => mark(T1, 'p01', 4, 0), /maximum/);
  const kept = mark({ kind: 'component', componentId: 'participation' }, 'p01', 4.75, 6);
  assert.deepEqual(kept, {
    kind: 'mark.set',
    mark: {
      courseId: 'c-math',
      term: 1,
      target: { kind: 'component', componentId: 'participation' },
      pupilId: 'p01',
      value: 4.75,
    },
  });
  assert.equal(layerOf(kept), 'pupil-records');
  assert.deepEqual(
    [T1, { kind: 'exam' }, { kind: 'component', componentId: 'notebook', month: '2026-10' }].map((one) =>
      targetKey(one as MarkTarget),
    ),
    ['test:t-1', 'exam', 'component:notebook:2026-10'],
  );
});

test('the last mark counts, an absence is kept, and a cleared mark leaves an empty cell', async () => {
  const book = await openBook(cemEvents());
  const day = d('2026-11-08');
  for (const event of [
    mark(T1, 'p01', 12),
    mark(T1, 'p02', 'absent'),
    mark(T1, 'p03', 9.5),
    mark(T1, 'p01', 13.25),
    mark(T1, 'p03', null),
    mark(T1, 'p99', 14),
    mark(T2, 'p01', 7),
  ]) {
    await book.record(day, event);
  }
  const marks = marksFor(book.state, 'c-math', 1, T1);
  assert.deepEqual([...marks.entries()].sort(), [
    ['p01', 13.25],
    ['p02', 'absent'],
    ['p99', 14],
  ]);
  assert.deepEqual(entryCheck(['p01', 'p02', 'p03', 'p04'], marks), {
    entered: 1,
    absent: 1,
    empty: ['p03', 'p04'],
    notOnList: ['p99'],
  });
  assert.equal(marksFor(book.state, 'c-math', 2, T1).size, 0);
});

test('marks travel with the pupil records, the last one for each cell and none cleared', async () => {
  const book = await openBook(cemEvents());
  for (const event of [
    mark(T1, 'p02', 11),
    mark(T1, 'p01', 12),
    mark(T1, 'p01', 14),
    mark(T1, 'p03', 8),
    mark(T1, 'p03', null),
  ]) {
    await book.record(d('2026-11-08'), event);
  }
  const sent = (route: Parameters<typeof recordsForRoute>[1]) =>
    recordsForRoute(book.state, route).flatMap((one) =>
      one.kind === 'mark.set' ? [[one.mark.pupilId, one.mark.value]] : [],
    );
  assert.deepEqual(sent('school-space'), [
    ['p01', 14],
    ['p02', 11],
  ]);
  assert.deepEqual(
    (['documents', 'handover-direct', 'statement', 'handover'] as const).map((route) => sent(route).length),
    [2, 2, 0, 0],
  );
});
