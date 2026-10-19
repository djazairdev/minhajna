// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_COUNTING,
  correctPupil,
  countRollCalls,
  layerOf,
  markOf,
  previewCorrection,
  recordsForRoute,
  rollCallUnits,
  takeRollCall,
  type RecordBook,
  type RollCallUnit,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

async function taken(): Promise<{ book: RecordBook; unit: RollCallUnit }> {
  const book = await openBook(cemEvents());
  const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
  assert.ok(unit);
  await book.record(
    d('2026-09-20'),
    takeRollCall(contextOf(book), unit, { absent: [{ pupilId: 'p01', justified: false }], late: ['p02'] }),
  );
  return { book, unit };
}

describe('roll-call corrections', () => {
  it("reads each pupil's mark", async () => {
    const { book, unit } = await taken();
    const rollCall = book.state.rollCalls.get(unit.key)?.at(-1)?.value;
    assert.ok(rollCall);
    assert.deepEqual(
      ['p01', 'p02', 'p03'].map((id) => markOf(rollCall, id)),
      ['unjustified', 'late', 'present'],
    );
  });

  it("corrects one pupil with a coded reason, keeps the others' marks and both versions", async () => {
    const { book, unit } = await taken();
    await book.record(d('2026-10-04'), correctPupil(contextOf(book), unit, 'p01', 'late', 'arrived-late'));
    const versions = book.state.rollCalls.get(unit.key);
    assert.equal(versions?.length, 2);
    assert.deepEqual(
      versions?.map((version) => version.day),
      ['2026-09-20', '2026-10-04'],
    );
    assert.equal(versions?.[1]?.reason, 'arrived-late');
    assert.deepEqual(versions?.[1]?.value.absent, []);
    assert.deepEqual([...(versions?.[1]?.value.late ?? [])].sort(), ['p01', 'p02']);
    assert.deepEqual(versions?.[0]?.value.absent, [{ pupilId: 'p01', justified: false }]);
  });

  it('marks an absence justified without a cause, and turns lateness into an absence', async () => {
    const { book, unit } = await taken();
    await book.record(d('2026-09-21'), correctPupil(contextOf(book), unit, 'p01', 'justified', 'administration'));
    await book.record(d('2026-09-21'), correctPupil(contextOf(book), unit, 'p02', 'unjustified', 'entry-error'));
    const rollCall = book.state.rollCalls.get(unit.key)?.at(-1)?.value;
    assert.deepEqual(rollCall?.absent, [
      { pupilId: 'p01', justified: true },
      { pupilId: 'p02', justified: false },
    ]);
    assert.deepEqual(rollCall?.late, []);
  });

  it('refuses a mark that does not change, and a roll call not taken', async () => {
    const { book, unit } = await taken();
    assert.throws(() => correctPupil(contextOf(book), unit, 'p02', 'late', 'other'), /does not change/);
    const later = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-21'), d('2026-09-21'))[0];
    assert.ok(later);
    assert.throws(() => correctPupil(contextOf(book), later, 'p01', 'late', 'other'), /No roll call/);
  });

  it('corrects one pupil after another marked in the roll call has changed group, not a pupil off its list', async () => {
    const book = await openBook(cemEvents());
    const unit = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-10-08')).find(
      (one) => one.groupId === 'g-2',
    );
    assert.ok(unit);
    const absent = [
      { pupilId: 'p06', justified: false },
      { pupilId: 'p07', justified: false },
    ];
    await book.record(unit.day, takeRollCall(contextOf(book), unit, { absent, late: [] }));
    const moved = book.state.pupils.get('p07');
    assert.ok(moved);
    await book.record(d('2026-10-10'), { kind: 'pupil.set', pupil: { ...moved, groups: ['g-1'] } });
    await book.record(d('2026-10-11'), correctPupil(contextOf(book), unit, 'p06', 'justified', 'administration'));
    assert.deepEqual(book.state.rollCalls.get(unit.key)?.at(-1)?.value.absent, [
      { pupilId: 'p07', justified: false },
      { pupilId: 'p06', justified: true },
    ]);
    assert.throws(() => correctPupil(contextOf(book), unit, 'p01', 'late', 'other'), /not on this roll call/);
    await book.record(d('2026-10-11'), correctPupil(contextOf(book), unit, 'p07', 'present', 'entry-error'));
  });

  it("previews the month's totals before and after, recording nothing", async () => {
    const { book, unit } = await taken();
    const entries = book.entries.length;
    const { before, after } = previewCorrection(contextOf(book), unit, 'p01', 'late');
    assert.equal(before?.absent, 1);
    assert.equal(after?.absent, 0);
    assert.deepEqual(after?.late, ['2026-09-20']);
    assert.equal(before?.possible, after?.possible);
    assert.ok((after?.rate ?? 0) > (before?.rate ?? 1));
    assert.equal(book.entries.length, entries);
  });
});

describe('counting rules', () => {
  it('keeps the rules the teacher set, the last one winning, and counts with them by default', async () => {
    const { book, unit } = await taken();
    const stored = () => book.state.counting;
    assert.equal(stored(), null);
    const before = countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'));
    await book.record(d('2026-09-20'), { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, from: d('2026-09-23') } });
    await book.record(d('2026-09-21'), { kind: 'counting.set', rules: { ...DEFAULT_COUNTING, from: d('2026-09-21') } });
    assert.equal(stored()?.from, '2026-09-21');
    const after = countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'));
    assert.ok(before.units + before.untaken > after.units + after.untaken);
    assert.ok(!after.pupils.some((count) => count.absences.some((absence) => absence.day === unit.day)));
    const given = countRollCalls(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-24'), DEFAULT_COUNTING);
    assert.equal(given.units + given.untaken, before.units + before.untaken);
  });

  it('belongs to the pupil records, which documents take and statements do not', async () => {
    const { book } = await taken();
    const event = { kind: 'counting.set', rules: DEFAULT_COUNTING } as const;
    assert.equal(layerOf(event), 'pupil-records');
    await book.record(d('2026-09-20'), event);
    assert.ok(recordsForRoute(book.state, 'documents').some((record) => record.kind === 'counting.set'));
    assert.ok(!recordsForRoute(book.state, 'statement').some((record) => record.kind === 'counting.set'));
  });
});
