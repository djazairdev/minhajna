// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { budgetInSessions, parsePlanPack, queueItems, stageCount, type PackItem } from '../src/index.ts';
import { languagePack, mathPack, mathPackSource } from './fixtures.ts';

function item(id: string): PackItem {
  const found = mathPack.items.find((candidate) => candidate.id === id);
  assert.ok(found);
  return found;
}

function problemsOf(source: unknown): unknown {
  const result = parsePlanPack(source);
  return result.ok ? [] : result.problems;
}

describe('plan packs', () => {
  it('reads a valid pack', () => {
    assert.equal(mathPack.items.length, 14);
    assert.equal(languagePack.anchor.kind, 'weeks');
    assert.deepEqual(mathPack.merges, [['l2', 'l3']]);
  });

  it('drops fields outside the format', () => {
    const result = parsePlanPack({
      ...mathPackSource,
      uploadedBy: 'someone',
      items: mathPackSource.items.map((entry) => ({ ...entry, macro: '=CMD()' })),
    });
    assert.ok(result.ok);
    assert.doesNotMatch(JSON.stringify(result.value), /someone|CMD/);
  });

  it('refuses what the format does not allow', () => {
    assert.deepEqual(problemsOf({ ...mathPackSource, id: 'Math pack' }), [{ path: 'id', problem: 'invalid' }]);
    assert.deepEqual(problemsOf({ ...mathPackSource, status: 'approved' }), [{ path: 'status', problem: 'invalid' }]);
    assert.deepEqual(problemsOf({ ...mathPackSource, format: 2 }), [{ path: 'format', problem: 'invalid' }]);
    assert.deepEqual(
      problemsOf({
        ...mathPackSource,
        items: [...mathPackSource.items, { id: 'l1', kind: 'lesson', title: 'Again', budget: 1 }],
      }),
      [{ path: 'items[14].id', problem: 'duplicate' }],
    );
    assert.deepEqual(
      problemsOf({ ...mathPackSource, items: [{ id: 'x', kind: 'lesson', title: 'No budget' }], merges: [] }),
      [{ path: 'items[0].budget', problem: 'required' }],
    );
    assert.deepEqual(
      problemsOf({
        ...mathPackSource,
        items: [{ id: 'x', kind: 'lesson', title: 'Bad', budget: 1, stages: 'none', unit: 'nowhere' }],
        merges: [],
      }),
      [
        { path: 'items[0].unit', problem: 'unknown-reference' },
        { path: 'items[0].stages', problem: 'unknown-reference' },
      ],
    );
    assert.deepEqual(problemsOf({ ...mathPackSource, merges: [['l2', 'u1']] }), [
      { path: 'merges[0]', problem: 'unknown-reference' },
    ]);
    assert.deepEqual(
      problemsOf({ ...mathPackSource, items: [{ id: 'x', kind: 'chapter', title: 'Bad', budget: 1 }], merges: [] }),
      [{ path: 'items[0].kind', problem: 'invalid' }],
    );
    assert.deepEqual(problemsOf('not a pack'), [{ path: '', problem: 'invalid' }]);
  });

  it('asks week packs for weeks', () => {
    const source = {
      ...mathPackSource,
      anchor: { kind: 'weeks' },
      items: [{ id: 'x', kind: 'lesson', title: 'No week' }],
      merges: [],
    };
    assert.deepEqual(problemsOf(source), [{ path: 'items[0].week', problem: 'required' }]);
  });

  // Two hours of 45-minute sessions round to three sessions.
  it('counts stages and budgets in sessions', () => {
    assert.equal(stageCount(mathPack, item('l1')), 4);
    assert.equal(stageCount(mathPack, item('l3')), 1);
    assert.equal(budgetInSessions(mathPack, item('l1'), 60), 2);
    assert.equal(budgetInSessions(mathPack, item('l1'), 45), 3);
    assert.equal(budgetInSessions(mathPack, item('d1'), 90), 1);
  });

  it('keeps TD items in their own queue', () => {
    assert.deepEqual(
      queueItems(mathPack, 'main').map((entry) => entry.id),
      ['d1', 'l1', 'l2', 'l3', 'l4', 'i1', 'r1', 'l5', 'l6', 'l7'],
    );
    assert.deepEqual(
      queueItems(mathPack, 'td').map((entry) => entry.id),
      ['t1', 't2'],
    );
    assert.deepEqual(queueItems(mathPack, 'none'), []);
  });
});
