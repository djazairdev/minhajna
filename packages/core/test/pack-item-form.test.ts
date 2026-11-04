// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The editor reads only made-up source items. Re-entry is independent,
// numeric writing is localised, and a form cannot rename an existing ID.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { packItemForm, readPackItemForm, sourceNumber, type PackItemForm, type PlanPack } from '../src/index.ts';
import { mathPack } from './fixtures.ts';

const pack: PlanPack = {
  ...mathPack,
  items: [{ id: 'lesson', kind: 'lesson', title: 'درس تجريبي', budget: 2, sourcePage: 4 }],
  merges: [],
};
const filled = (): PackItemForm => ({
  ...packItemForm(pack.items[0]!),
  retyped: { term: '', week: '', budget: '2', sourcePage: '4' },
});
const problems = (form: unknown, source = pack, id: string | null = 'lesson') => {
  const read = readPackItemForm(source, form, id);
  return read.ok ? [] : read.problems;
};

describe('the source item form', () => {
  it('never pre-fills the second entry, even for an existing item', () => {
    const form = packItemForm(pack.items[0]!);
    assert.equal(form.budget, '2');
    assert.deepEqual(form.retyped, { term: '', week: '', budget: '', sourcePage: '' });
    assert.deepEqual(problems(form), [
      { path: 'retyped.budget', problem: 'required' },
      { path: 'retyped.sourcePage', problem: 'required' },
    ]);
    assert.equal(packItemForm(null).sourcePage, '');
  });

  it('reads matching Arabic and Latin numbers without changing the source', () => {
    const form = { ...filled(), budget: '٢,٥', retyped: { ...filled().retyped, budget: '2.50' } };
    const read = readPackItemForm(pack, form, 'lesson');
    assert.ok(read.ok);
    assert.equal(read.value.budget, 2.5);
    assert.equal(read.value.title, 'درس تجريبي');
    assert.equal(pack.items[0]!.budget, 2);
    assert.equal(sourceNumber('۰۳', true), 3);
    assert.equal(sourceNumber('١٫٥', false), 1.5);
  });

  it('requires source pages and the anchor’s numbers, and rejects mismatches', () => {
    assert.ok(
      problems({ ...filled(), sourcePage: '', retyped: { ...filled().retyped, sourcePage: '' } }).some(
        (one) => one.path === 'sourcePage',
      ),
    );
    assert.ok(problems({ ...filled(), budget: '3' }).some((one) => one.path === 'retyped.budget'));
    const weekPack = { ...pack, anchor: { kind: 'weeks' as const } };
    assert.ok(problems(filled(), weekPack).some((one) => one.path === 'week'));
    assert.ok(
      problems({ ...filled(), budget: '', retyped: { ...filled().retyped, budget: '' } }).some(
        (one) => one.path === 'budget',
      ),
    );
  });

  it('refuses hidden rounding agreement, zero, grouping, exponents and unsafe numbers', () => {
    const form = { ...filled(), budget: '1.00000000000000001', retyped: { ...filled().retyped, budget: '1' } };
    assert.ok(problems(form).some((one) => one.path === 'retyped.budget'));
    for (const raw of ['0', '-1', 'NaN', 'Infinity', '1e2', '1 000', '1,000.5', '9007199254740993', ''])
      assert.equal(sourceNumber(raw, false), null, raw);
    assert.equal(sourceNumber('1.5', true), null);
    assert.equal(sourceNumber('1,5', true), null);
    assert.ok(
      problems({ ...filled(), term: '1', retyped: { ...filled().retyped, term: '2' } }).some(
        (one) => one.path === 'retyped.term',
      ),
    );
  });

  it('keeps IDs and queue meanings stable, and reports unknown references', () => {
    assert.ok(problems({ ...filled(), id: 'renamed' }).some((one) => one.path === 'id'));
    assert.ok(problems({ ...filled(), id: 'missing' }, pack, 'missing').some((one) => one.path === 'id'));
    assert.ok(problems({ ...filled(), kind: 'td' }).some((one) => one.path === 'kind'));
    for (const key of ['unit', 'stages'])
      assert.ok(problems({ ...filled(), [key]: 'missing' }).some((one) => one.path === key));
    assert.ok(problems(filled(), pack, null).some((one) => one.problem === 'duplicate'));
    assert.deepEqual(problems(null), [{ path: '', problem: 'invalid' }]);
    assert.ok(problems({ ...filled(), title: 'Unsafe\u202e' }).some((one) => one.path === 'title'));
  });

  it('leaves out an unset optional or buffer flag, and refuses one that is no flag', () => {
    const read = readPackItemForm(pack, { ...filled(), optional: false, buffer: false }, 'lesson');
    assert.ok(read.ok);
    assert.equal('optional' in read.value, false);
    assert.equal('buffer' in read.value, false);
    assert.equal(readPackItemForm(pack, { ...filled(), optional: 'yes' }, 'lesson').ok, false);
  });

  it('supports units without a teaching budget and every optional item field', () => {
    const form = {
      ...filled(),
      id: 'unit',
      kind: 'unit',
      budget: '',
      optional: true,
      buffer: true,
      pages: '10–12',
      retyped: { ...filled().retyped, budget: '' },
    };
    const read = readPackItemForm(pack, form, null);
    assert.ok(read.ok);
    assert.equal(read.value.budget, undefined);
    assert.equal(read.value.optional, true);
    assert.equal(read.value.buffer, true);
    assert.equal(read.value.pages, '10–12');
  });
});
