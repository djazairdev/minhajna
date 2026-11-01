// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Source budgets against the reference grid and calendar (#610), using
// made-up plans only. Overruns are findings, while missing data is unknown.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkBudgetPack, parsePlanPack } from '../src/index.ts';
import { calendar, grid, ref, scope, source } from './budget-pack-fixtures.ts';
import { d, languagePack } from './fixtures.ts';

function checked(pack = source(), reference = ref, horizon = scope) {
  const result = checkBudgetPack(pack, reference, horizon);
  assert.equal(result.status, 'checked');
  if (result.status !== 'checked') throw new Error('Expected a checked source');
  return result;
}

describe('budget-pack release checks', () => {
  it('fits the exact main and TD allocation across the declared horizon', () => {
    const result = checked();
    assert.equal(result.source, grid.source);
    assert.deepEqual(result.periods, [
      { term: null, from: scope.from, to: scope.to, main: { needs: 4, gives: 4 }, td: { needs: 2, gives: 2 } },
    ]);
    assert.deepEqual(result.findings, []);
  });

  it('reports an overlong plan as an advisory and keeps its source valid and unchanged', () => {
    const pack = source(source().items.map((item) => ({ ...item, budget: 3 })));
    const before = JSON.stringify(pack);
    const result = checked(pack);
    assert.deepEqual(result.findings, [
      {
        kind: 'budget-overrun',
        severity: 'advisory',
        queue: 'main',
        term: null,
        from: scope.from,
        to: scope.to,
        needs: 6,
        gives: 4,
        shortfall: 2,
        items: ['l2'],
      },
      {
        kind: 'budget-overrun',
        severity: 'advisory',
        queue: 'td',
        term: null,
        from: scope.from,
        to: scope.to,
        needs: 3,
        gives: 2,
        shortfall: 1,
        items: ['td1'],
      },
    ]);
    assert.equal(parsePlanPack(pack).ok, true);
    assert.equal(JSON.stringify(pack), before);
  });

  it('keeps unavailable grid data distinct from a known zero allocation', () => {
    assert.deepEqual(checkBudgetPack(source(), ref, { ...scope, grid: null }), {
      status: 'not-checked',
      reason: 'missing-grid',
    });
    const zero = checked(source(), ref, { ...scope, grid: { ...grid, sessions: [] } });
    assert.deepEqual(zero.periods[0]?.main, { needs: 4, gives: 0 });
    assert.equal(zero.findings.length, 2);
  });

  it('counts partial weeks and does not turn every touched week into a full allocation', () => {
    const result = checked(source(), ref, { ...scope, to: d('2026-09-21') });
    assert.deepEqual(result.periods[0]?.main, { needs: 4, gives: 2 });
    assert.deepEqual(result.periods[0]?.td, { needs: 2, gives: 0 });
  });

  it('removes holiday weeks and individual closures or exams through the calendar engine', () => {
    const holiday = calendar({ effect: 'no-school', to: d('2026-09-24') });
    const result = checked(source(), { ...ref, calendar: [holiday] });
    assert.deepEqual(result.periods[0]?.main, { needs: 4, gives: 2 });
    assert.deepEqual(result.periods[0]?.td, { needs: 2, gives: 1 });
    for (const effect of ['closure', 'exam', 'no-school'] as const) {
      assert.equal(checked(source(), { ...ref, calendar: [calendar({ effect })] }).periods[0]?.main.gives, 3);
    }
  });

  it('applies zone and grade scope without reading school or teacher calendars', () => {
    const entries = [calendar({ layer: 'zone', zone: '16' })];
    assert.equal(checked(source(), { ...ref, calendar: entries }, { ...scope, zone: '16' }).periods[0]?.main.gives, 3);
    assert.equal(checked(source(), { ...ref, calendar: entries }, { ...scope, zone: '31' }).periods[0]?.main.gives, 4);
    assert.equal(checked(source(), { ...ref, calendar: [calendar({ grades: ['2am'] })] }).periods[0]?.main.gives, 4);
    const privateEntries = [
      calendar({ layer: 'teacher' }),
      calendar({ id: 'school', layer: 'school', schoolId: 'pack-check-school' }),
    ];
    assert.deepEqual(checked(source(), { ...ref, calendar: privateEntries }).periods[0]?.main, { needs: 4, gives: 4 });
  });

  it('honours a half-day closure and a reference make-up day', () => {
    const afternoon = {
      ...grid,
      sessions: [...grid.sessions, { ...grid.sessions[0]!, slot: { half: 'afternoon' as const, index: 1 } }],
    };
    assert.equal(
      checked(source(), { ...ref, calendar: [calendar({ half: 'morning' })] }, { ...scope, grid: afternoon }).periods[0]
        ?.main.gives,
      5,
    );
    const extra = calendar({
      id: 'extra',
      from: d('2026-09-25'),
      to: d('2026-09-25'),
      effect: 'adds-sessions',
      adds: 'make-up',
      follows: 0,
    });
    assert.equal(checked(source(), { ...ref, calendar: [extra] }).periods[0]?.main.gives, 5);
  });

  it('counts A/B sessions once and follows a reference parity reset', () => {
    const alternates = {
      ...grid,
      sessions: [
        { ...grid.sessions[0]!, weeks: 'A' as const },
        { ...grid.sessions[0]!, weeks: 'B' as const },
      ],
    };
    assert.equal(checked(source(), ref, { ...scope, grid: alternates }).periods[0]?.main.gives, 2);
    const onlyA = { ...grid, sessions: [{ ...grid.sessions[0]!, weeks: 'A' as const }] };
    const reset = calendar({ effect: 'week-a', from: d('2026-09-27'), to: d('2026-09-27') });
    assert.equal(checked(source(), { ...ref, calendar: [reset] }, { ...scope, grid: onlyA }).periods[0]?.main.gives, 2);
  });

  it('uses per-item engine rounding for hours, sessions and short-session grids', () => {
    const items = [{ id: 'x', kind: 'lesson' as const, title: 'Made up', budget: 2 }];
    const short = { ...scope, grid: { ...grid, sessionMinutes: 45 } };
    assert.equal(checked(source(items), ref, short).periods[0]?.main.needs, 3);
    assert.equal(checked(source(items, 'sessions'), ref, short).periods[0]?.main.needs, 2);
    const tiny = [0.1, 0.1, 1.4].map((budget, index) => ({ ...items[0]!, id: `x${index}`, budget }));
    assert.equal(checked(source(tiny)).periods[0]?.main.needs, 3);
  });

  it('counts buffers and optional items, excludes unit headings, and never spends TD on the main plan', () => {
    const items = [
      { id: 'u', kind: 'unit' as const, title: 'Made up' },
      { id: 'x', kind: 'lesson' as const, title: 'Made up', budget: 5, optional: true, buffer: true },
    ];
    const result = checked(source(items));
    assert.deepEqual(result.periods[0]?.main, { needs: 5, gives: 4 });
    assert.deepEqual(result.periods[0]?.td, { needs: 0, gives: 2 });
    assert.equal(result.findings[0]?.shortfall, 1);
  });

  it('checks a term deadline even when the whole plan fits by the end of its horizon', () => {
    const end = d('2026-10-15');
    const reference = {
      ...ref,
      year: {
        ...ref.year,
        to: end,
        terms: [
          { number: 1, from: scope.from, to: scope.to },
          { number: 2, from: d('2026-10-04'), to: end },
        ],
      },
      calendar: [calendar({ effect: 'exam', term: 1, from: d('2026-09-27'), to: scope.to })],
    };
    const pack = source([1, 2].map((term) => ({ id: `t${term}`, kind: 'lesson', title: 'Made up', term, budget: 3 })));
    const result = checked(pack, reference, { ...scope, to: end });
    assert.equal(result.periods.at(-1)?.main.gives, 6);
    assert.equal(result.periods.at(-1)?.main.needs, 6);
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0]?.term, 1);
    assert.equal(result.findings[0]?.to, d('2026-09-26'));
    assert.equal(result.findings[0]?.shortfall, 1);
  });

  it('reports zero capacity when the first exam already starts at the source horizon', () => {
    const pack = source([{ id: 'x', kind: 'lesson', title: 'Made up', budget: 1, term: 1 }]);
    const result = checked(pack, { ...ref, calendar: [calendar({ effect: 'exam', term: 1 })] });
    assert.equal(result.periods[0]?.main.gives, 0);
    assert.equal(result.findings[0]?.severity, 'advisory');
    assert.equal(result.findings[0]?.shortfall, 1);
  });

  it('checks stale and hybrid source packs without changing import behaviour', () => {
    const pack = source();
    assert.deepEqual(checked({ ...pack, status: 'stale' }).periods, checked(pack).periods);
    assert.deepEqual(checked({ ...pack, anchor: { kind: 'hybrid', unit: 'hours' } }).periods, checked(pack).periods);
    assert.deepEqual(checkBudgetPack(languagePack, ref, scope), { status: 'not-applicable' });
  });
});
