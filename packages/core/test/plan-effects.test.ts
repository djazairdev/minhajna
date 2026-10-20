// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What each of a class's changes costs its plan, in sessions (#225): each
// counted after the changes before it, so the counts add up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { addedId, changeEffects, type Context } from '../src/index.ts';
import { cemEvents, openBook } from './fixtures.ts';
import { change, made } from './plan-change-fixtures.ts';

const effects = (context: Context) => Object.fromEntries(changeEffects(context, 'c-math'));

describe('What a change costs the plan', () => {
  it('counts two budgets of one item each from the one before', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'b1', kind: 'budget', item: 'l3', sessions: 3 },
      { ...made, id: 'b2', kind: 'budget', item: 'l3', sessions: 4 },
    );
    assert.deepEqual(effects(context), { b1: 2, b2: 1 });
  });

  it('counts an added item, then its new budget', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'a1', kind: 'add', title: 'Revision', sessions: 1, before: 'l4' },
      { ...made, id: 'b1', kind: 'budget', item: addedId('a1'), sessions: 3 },
    );
    assert.deepEqual(effects(context), { a1: 1, b1: 2 });
  });

  it('gives back what an item takes now when it is left out', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'b1', kind: 'budget', item: 'l4', sessions: 4 },
      { ...made, id: 's1', kind: 'skip', item: 'l4' },
    );
    assert.deepEqual(effects(context), { b1: 2, s1: -4 });
  });

  it('teaches a join in one session, and splits a one-session item in two', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'j1', kind: 'join', items: ['l3', 'l4'] },
      { ...made, id: 's1', kind: 'split', item: 'l2', titles: ['Comparing', 'Ordering'] },
      { ...made, id: 'm1', kind: 'move', item: 'i1', before: 'l1' },
    );
    assert.deepEqual(effects(context), { j1: -2, s1: 1, m1: 0 });
  });

  it('leaves out a change taken back', async () => {
    const book = await openBook(cemEvents());
    const context = await change(
      book,
      { ...made, id: 'b1', kind: 'budget', item: 'l3', sessions: 3 },
      { ...made, id: 'u1', kind: 'undo', change: 'b1' },
      { ...made, id: 'b2', kind: 'budget', item: 'l3', sessions: 2 },
    );
    assert.deepEqual(effects(context), { b2: 1 });
  });
});
