// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #610 accepts source inputs, never progress. Invalid source coordinates
// cannot silently pass; repeated checks leave the source and references as
// they were. The TD deadline follows its unit's last lesson term.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkBudgetPack, type BudgetPackGrid, type Day } from '../src/index.ts';
import { calendar, grid, ref, scope, source } from './budget-pack-fixtures.ts';
import { d } from './fixtures.ts';

describe('budget-check source inputs', () => {
  it('rejects ambiguous or unsupported grids instead of inventing their hours', () => {
    const first = grid.sessions[0]!;
    const invalid: BudgetPackGrid[] = [
      { ...grid, source: ' ' },
      ...[0, -1, Infinity, Number.NaN].map((sessionMinutes) => ({ ...grid, sessionMinutes })),
      { ...grid, sessions: [first, first] },
      { ...grid, sessions: [{ ...first, weeks: 'A' }, first] },
      { ...grid, sessions: [{ ...first, sessionType: 'unknown' }] },
      { ...grid, sessions: [{ ...first, weekday: 6 }] },
      { ...grid, sessions: [{ ...first, slot: { half: 'morning', index: 0 } }] },
      { ...grid, sessions: [{ ...first, slot: { half: 'morning', index: 1.5 } }] },
    ];
    for (const wrong of invalid)
      assert.throws(() => checkBudgetPack(source(), ref, { ...scope, grid: wrong }), RangeError);
  });

  it('requires explicit valid dates within the reference year', () => {
    for (const wrong of [
      { ...scope, from: d('2026-09-19') },
      { ...scope, to: d('2026-10-02') },
      { ...scope, from: scope.to, to: scope.from },
      { ...scope, from: 'unknown' as Day },
    ])
      assert.throws(() => checkBudgetPack(source(), ref, wrong), RangeError);
  });

  it('rejects a pack or zone the supplied profile cannot interpret', () => {
    for (const id of [
      'fr.cem.1am.math.example',
      'dz.unknown.1am.math.example',
      'dz.cem.9am.math.example',
      'dz.cem.1am.unknown.example',
    ]) {
      assert.throws(() => checkBudgetPack({ ...source(), id }, ref, scope), RangeError);
    }
    const named = { ...ref, country: { ...ref.country, zones: [{ code: '16', name: { en: 'Made up' } }] } };
    assert.throws(() => checkBudgetPack(source(), named, { ...scope, zone: '31' }), RangeError);
  });

  it('uses the profile’s own working days and keeps support outside the plan allocation', () => {
    const other = {
      ...ref,
      country: { ...ref.country, weekStartsOn: 1 as const, workingDays: [1, 2, 3, 4, 5] as const },
    };
    const allocation = { ...grid, sessions: [{ ...grid.sessions[0]!, weekday: 5 as const }] };
    const result = checkBudgetPack(source(), other, { ...scope, grid: allocation });
    assert.equal(result.status, 'checked');
    if (result.status === 'checked') assert.equal(result.periods[0]?.main.gives, 1);
    const support = { ...grid, sessions: [{ ...grid.sessions[0]!, sessionType: 'support' }] };
    const empty = checkBudgetPack(source(), ref, { ...scope, grid: support });
    assert.equal(empty.status, 'checked');
    if (empty.status === 'checked') assert.equal(empty.periods[0]?.main.gives, 0);
  });

  it('takes a TD item’s deadline from the last term of its unit', () => {
    const pack = source([
      { id: 'u', kind: 'unit', title: 'Made up' },
      { id: 'l', kind: 'lesson', title: 'Made up', unit: 'u', budget: 1, term: 1 },
      { id: 'td', kind: 'td', title: 'Made up', unit: 'u', budget: 3 },
    ]);
    const result = checkBudgetPack(
      pack,
      { ...ref, calendar: [calendar({ effect: 'exam', term: 1, from: d('2026-09-27'), to: scope.to })] },
      scope,
    );
    assert.equal(result.status, 'checked');
    if (result.status !== 'checked') throw new Error('Expected a checked source');
    assert.deepEqual(result.periods[0]?.td, { needs: 3, gives: 1 });
    assert.equal(result.findings[0]?.term, 1);
    assert.equal(result.findings[0]?.queue, 'td');
    assert.equal(result.findings[0]?.shortfall, 2);
  });

  it('leaves the pack, calendar and source grid unchanged on repeated checks', () => {
    const pack = source();
    const before = JSON.stringify([pack, ref, [...ref.packs], scope]);
    const first = checkBudgetPack(pack, ref, scope);
    assert.deepEqual(checkBudgetPack(pack, ref, scope), first);
    assert.equal(JSON.stringify([pack, ref, [...ref.packs], scope]), before);
  });
});
