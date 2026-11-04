// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A class against its peers (#623, answer 700): each item the class or the
// figure speaks of, in the plan's order, with the plan's sessions, the median
// and the class's own, the median marked only when over the plan; an item a
// figure hides has no median and no change; the most changed come first, at
// most three, a band reaching down to none left out; places in the plan for the
// class, the median and the middle half; a plan under half the year's lessons
// scales to them, and one over it does not. Every figure is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  insightsCompare,
  planScale,
  type CompareBand,
  type CompareFigure,
  type CompareItem,
  type InsightsSending,
  type PackItem,
} from '../src/index.ts';

const item = (id: string, budget?: number): PackItem => ({
  id,
  kind: 'lesson',
  title: `Title of ${id}`,
  ...(budget === undefined ? {} : { budget }),
});
const NONE: CompareBand = [0, 5];
const published = (
  sessions: number | null,
  bands: Partial<Record<keyof Omit<CompareItem, 'sessions'>, CompareBand>> = {},
) => ({
  sessions,
  merged: NONE,
  skipped: NONE,
  split: NONE,
  retaught: NONE,
  ...bands,
});
const items = [item('a', 2), item('b'), item('c', 3), item('d', 4)];
const sending = {
  sessions: { a: 2, b: 3 },
  reached: 250,
} as unknown as InsightsSending;
const figure: CompareFigure = {
  reached: { low: 100, median: 400, high: 1000 },
  items: [
    ['a', published(3, { merged: [30, 50] })],
    ['b', null],
    ['c', published(3, { skipped: [85, 95], retaught: [5, 15], split: [15, 30] })],
    ['z', published(9, { merged: [95, 100] })],
  ],
};

describe('insightsCompare', () => {
  const made = insightsCompare(sending, items, figure);

  it('gives each item the class or the figure speaks of, in the plan’s order', () => {
    assert.deepEqual(
      made.rows.map(({ item: id, planned, median, mine, over }) => [id, planned, median, mine, over]),
      [
        ['a', 2, 3, 2, true],
        ['b', 1, null, 3, false],
        ['c', 3, 3, null, false],
      ],
    );
    assert.equal(made.rows[0]!.title, 'Title of a');
  });

  it('names the three changes most classes made, none a band reaching down to none', () => {
    assert.deepEqual(
      made.changes.map(({ list, item: id, band }) => [list, id, band]),
      [
        ['skipped', 'c', [85, 95]],
        ['merged', 'a', [30, 50]],
        ['split', 'c', [15, 30]],
      ],
    );
  });

  it('places the class, the median and the middle half in the plan', () => {
    assert.deepEqual(made.place, {
      mine: 'Title of b',
      median: 'Title of c',
      low: 'Title of a',
      high: 'Title of d',
    });
    assert.equal(insightsCompare(sending, [], figure).place, null);
    const none = insightsCompare({ ...sending, reached: 0 }, items, figure).place;
    assert.equal(none?.mine, null);
    const whole = insightsCompare({ ...sending, reached: 1000 }, items, figure).place;
    assert.equal(whole?.mine, 'Title of d');
  });

  it('scales the plan’s sessions, marking only what runs over them', () => {
    const scaled = insightsCompare(sending, items, figure, 2);
    assert.deepEqual(
      scaled.rows.map(({ planned, over }) => [planned, over]),
      [
        [4, false],
        [2, false],
        [6, false],
      ],
    );
  });
});

describe('planScale', () => {
  it('stretches a plan under half the year’s lessons, and leaves one that fills it or nearly', () => {
    assert.equal(planScale(items, 100), 9.5);
    assert.equal(planScale(items, 20), 1);
    assert.equal(planScale(items, 5), 1);
    assert.equal(planScale([], 100), 1);
  });
});
