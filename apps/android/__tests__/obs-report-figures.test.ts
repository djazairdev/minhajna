// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What Obs-Report's cards say of a figure (#627, answer 680): the items in the
// pack's order, those it does not hold after them in the server's, and the
// server's without the pack; the plan by the pack's anchor, 1 for a weeks item
// with no budget, a budget in sessions as it is, and none in hours; a median
// above the plan only as the page writes both; the most changed by band, then
// classes, then order, with how many others share its band, and none when every
// item is hidden; the classes the items cover; and a band's words at its edges.
// Every pack and figure here is made up.

import type { PlanPack } from '@minhajna/core';
import type { Figure, ItemFigure } from '../src/observatory/figures-read';
import { bandWords, classesRange, mostChanged, reportRows } from '../src/observatory/report-figures';

const item = (classes: number, sessions: number | null, merged: [number, number] = [0, 5]): ItemFigure => ({
  classes,
  sessions,
  merged,
  skipped: [0, 5],
  split: [0, 5],
  retaught: [0, 5],
});
const figure = (items: Figure['items']): Figure => ({
  classes: 30,
  teachers: 12,
  schools: 4,
  reached: { low: 0, median: 0, high: 0 },
  items,
});
const pack = (anchor: PlanPack['anchor'], items: { id: string; budget?: number }[]) =>
  ({ anchor, items: items.map((one) => ({ ...one, title: `title ${one.id}` })) }) as unknown as PlanPack;

test('orders items by the pack, then the server’s order; the server’s alone without the pack', () => {
  const made = figure([
    ['z', item(10, 1)],
    ['b', item(10, 1)],
    ['y', item(10, 1)],
    ['a', item(10, 1)],
  ]);
  const held = pack({ kind: 'weeks' }, [{ id: 'a' }, { id: 'b' }]);
  expect(reportRows(made, held).map((one) => one.id)).toEqual(['a', 'b', 'z', 'y']);
  expect(reportRows(made, undefined).map((one) => one.id)).toEqual(['z', 'b', 'y', 'a']);
  expect(reportRows(made, undefined)[0]).toMatchObject({ title: 'z', plan: null, above: false });
  expect(reportRows(made, held)[0]).toMatchObject({ title: 'title a', plan: 1 });
  expect(reportRows(made, held)[2]).toMatchObject({ title: 'z', plan: null });
});

test('gives the plan only where the pack counts in sessions', () => {
  const made = figure([
    ['a', item(10, 7)],
    ['b', item(10, 7)],
  ]);
  const items = [{ id: 'a', budget: 5 }, { id: 'b' }];
  const plans = (anchor: PlanPack['anchor']) => reportRows(made, pack(anchor, items)).map((one) => one.plan);
  expect(plans({ kind: 'weeks' })).toEqual([5, 1]);
  expect(plans({ kind: 'budgets', unit: 'sessions' })).toEqual([5, null]);
  expect(plans({ kind: 'hybrid', unit: 'sessions' })).toEqual([5, null]);
  expect(plans({ kind: 'budgets', unit: 'hours' })).toEqual([null, null]);
  expect(plans({ kind: 'hybrid', unit: 'hours' })).toEqual([null, null]);
});

test('marks a median above the plan only as the page writes both', () => {
  const made = figure([
    ['equal', item(10, 5)],
    ['rounds', item(10, 5.04)],
    ['above', item(10, 5.5)],
    ['held', item(10, null)],
    ['hidden', null],
  ]);
  const held = pack(
    { kind: 'weeks' },
    ['equal', 'rounds', 'above', 'held', 'hidden'].map((id) => ({ id, budget: 5 })),
  );
  expect(reportRows(made, held).map((one) => one.above)).toEqual([false, false, true, false, false]);
});

test('finds the most changed by band, then classes, then order, with the others in its band', () => {
  const rows = reportRows(
    figure([
      ['first', item(10, 1, [15, 30])],
      ['most', item(20, 1, [15, 30])],
      ['tied', item(20, 1, [15, 30])],
      ['wider', item(5, 1, [15, 50])],
      ['low', item(30, 1, [5, 15])],
      ['hidden', null],
    ]),
    undefined,
  );
  expect(mostChanged(rows, 'merged')).toMatchObject({ row: { id: 'wider' }, band: [15, 50], others: 0 });
  const without = rows.filter((one) => one.id !== 'wider');
  expect(mostChanged(without, 'merged')).toMatchObject({ row: { id: 'most' }, band: [15, 30], others: 2 });
  expect(mostChanged(without, 'skipped')).toMatchObject({ row: { id: 'low' }, others: 3 });
  expect(
    mostChanged(
      rows.filter((one) => one.id === 'hidden'),
      'merged',
    ),
  ).toBeNull();
});

test('gives the classes the items shown cover', () => {
  const rows = reportRows(
    figure([
      ['a', item(12, 1)],
      ['b', null],
      ['c', item(30, 1)],
    ]),
    undefined,
  );
  expect(classesRange(rows)).toEqual({ low: 12, high: 30 });
  expect(classesRange([])).toBeNull();
});

test('words a band by its edges', () => {
  expect(bandWords([0, 5]).key).toBe('under');
  expect(bandWords([95, 100]).key).toBe('over');
  expect(bandWords([15, 30]).key).toBe('between');
  expect(bandWords([0, 100]).key).toBe('between');
});
