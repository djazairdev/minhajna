// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The floors under the totals above the school (#595): a figure under its
// scope's floor of teachers and schools is hidden, unless it covers no school;
// and so is the smallest other figure of a sum, until no combination of the
// sums works a hidden figure out exactly: across rows and columns, past a
// hidden figure joining two hidden blocks, and round a cycle of sums sharing
// figures; a sum naming a figure twice is refused; and a range over the
// wilayas shows only when at least 8 pass the wilaya floor, covering only
// those. Each case was checked against an exact rank test outside the code.
// Every figure is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FLOORS, hiddenCells, passesFloor, RANGE_WILAYAS, wilayaRange, type FloorCell } from '../src/index.ts';

const cell = (id: string, teachers: number, schools = 3, scope: FloorCell['scope'] = 'wilaya'): FloorCell => ({
  id,
  scope,
  teachers,
  schools,
});

describe('the floors', () => {
  it('asks 5 teachers and 3 schools of a directorate, and 10 and 3 of a wilaya or the nation', () => {
    assert.deepEqual(FLOORS, {
      directorate: { teachers: 5, schools: 3 },
      wilaya: { teachers: 10, schools: 3 },
      national: { teachers: 10, schools: 3 },
    });
    assert.equal(passesFloor({ scope: 'directorate', teachers: 5, schools: 3 }), true);
    assert.equal(passesFloor({ scope: 'directorate', teachers: 4, schools: 9 }), false);
    assert.equal(passesFloor({ scope: 'directorate', teachers: 40, schools: 2 }), false);
    assert.equal(passesFloor({ scope: 'wilaya', teachers: 9, schools: 3 }), false);
    assert.equal(passesFloor({ scope: 'wilaya', teachers: 10, schools: 3 }), true);
    assert.equal(passesFloor({ scope: 'national', teachers: 9, schools: 30 }), false);
    assert.equal(passesFloor({ scope: 'national', teachers: Number.NaN, schools: 30 }), false);
  });

  it('hides a figure under its floor, and shows the rest when no sum gives it away', () => {
    const cells = [cell('a', 12), cell('b', 9), cell('c', 4, 3, 'directorate'), cell('d', 11, 2), cell('e', 0, 0)];
    assert.deepEqual([...hiddenCells(cells, [])].sort(), ['b', 'c', 'd']);
  });

  it('hides the smallest other part of a sum that would give a hidden part away by subtraction', () => {
    const cells = [
      cell('nation', 60, 18, 'national'),
      cell('w1', 25, 6),
      cell('w2', 9),
      cell('w3', 14, 5),
      cell('w4', 12),
    ];
    const hidden = hiddenCells(cells, [{ total: 'nation', parts: ['w1', 'w2', 'w3', 'w4'] }]);
    assert.deepEqual([...hidden].sort(), ['w2', 'w4']);
  });

  it('settles a tie on teachers by schools, then by ID, so the same figures always hide the same cells', () => {
    const sum = { total: 'nation', parts: ['w1', 'w2', 'w3', 'w4'] };
    const bySchools = [
      cell('nation', 50, 20, 'national'),
      cell('w1', 8),
      cell('w2', 12, 5),
      cell('w3', 12, 4),
      cell('w4', 18),
    ];
    assert.deepEqual([...hiddenCells(bySchools, [sum])].sort(), ['w1', 'w3']);
    const byId = [cell('nation', 50, 20, 'national'), cell('w1', 8), cell('w2', 18), cell('w3', 12), cell('w4', 12)];
    assert.deepEqual([...hiddenCells(byId, [sum])].sort(), ['w1', 'w3']);
    assert.deepEqual([...hiddenCells([...byId].reverse(), [sum])].sort(), ['w1', 'w3']);
  });

  it('hides the total when its only part is hidden, and leaves a sum hiding two or none alone', () => {
    const one = hiddenCells(
      [cell('school', 4, 3, 'directorate'), cell('subject', 4, 3, 'directorate')],
      [{ total: 'school', parts: ['subject'] }],
    );
    assert.deepEqual([...one].sort(), ['school', 'subject']);
    const two = [cell('nation', 40, 12, 'national'), cell('w1', 8), cell('w2', 9), cell('w3', 23, 6)];
    assert.deepEqual([...hiddenCells(two, [{ total: 'nation', parts: ['w1', 'w2', 'w3'] }])].sort(), ['w1', 'w2']);
    const none = [cell('nation', 40, 12, 'national'), cell('w1', 18), cell('w2', 22, 6)];
    assert.deepEqual([...hiddenCells(none, [{ total: 'nation', parts: ['w1', 'w2'] }])], []);
  });

  it('goes on across two subjects by three wilayas, with their totals, until no sum gives one away', () => {
    const cells = [
      cell('arabic', 60, 18, 'national'),
      cell('math', 70, 18, 'national'),
      cell('a1', 8),
      cell('a2', 25, 6),
      cell('a3', 27, 6),
      cell('m1', 20, 6),
      cell('m2', 24, 6),
      cell('m3', 26, 6),
      cell('w1', 28, 6),
      cell('w2', 49, 6),
      cell('w3', 53, 6),
      cell('nation', 130, 18, 'national'),
    ];
    const sums = [
      { total: 'arabic', parts: ['a1', 'a2', 'a3'] },
      { total: 'math', parts: ['m1', 'm2', 'm3'] },
      { total: 'w1', parts: ['a1', 'm1'] },
      { total: 'w2', parts: ['a2', 'm2'] },
      { total: 'w3', parts: ['a3', 'm3'] },
      { total: 'nation', parts: ['arabic', 'math'] },
      { total: 'nation', parts: ['w1', 'w2', 'w3'] },
    ];
    const hidden = hiddenCells(cells, sums);
    assert.deepEqual([...hidden].sort(), ['a1', 'a2', 'm1', 'm2']);
    for (const sum of sums) {
      const count = [sum.total, ...sum.parts].filter((id) => hidden.has(id)).length;
      assert.notEqual(count, 1, `${sum.total} hides exactly one`);
    }
  });

  it('hides a figure joining two hidden blocks of a table, which every line alone would let through', () => {
    const under = new Set(['11', '12', '21', '22', '33', '34', '43', '44', '23']);
    const lines = [1, 2, 3, 4];
    const cells = lines.flatMap((row) => lines.map((column) => `${row}${column}`));
    const table = [
      ...cells.map((id) => cell(id, under.has(id) ? 6 : 10 + Number(id[0]) * 4 + Number(id[1]))),
      ...lines.flatMap((line) => [cell(`R${line}`, 80 + line, 12), cell(`C${line}`, 90 + line, 12)]),
      cell('G', 400, 48, 'national'),
    ];
    const sums = [
      ...lines.flatMap((line) => [
        { total: `R${line}`, parts: lines.map((column) => `${line}${column}`) },
        { total: `C${line}`, parts: lines.map((row) => `${row}${line}`) },
      ]),
      { total: 'G', parts: lines.map((line) => `R${line}`) },
      { total: 'G', parts: lines.map((line) => `C${line}`) },
    ];
    assert.deepEqual([...hiddenCells(table, sums)].sort(), [...under, '13'].sort());
  });

  it('hides one more figure round a cycle of sums that share figures', () => {
    const cells = [cell('a', 4), cell('b', 4), cell('c', 4), cell('x', 12, 6), cell('y', 11, 6), cell('z', 13, 6)];
    const sums = [
      { total: 'x', parts: ['a', 'b'] },
      { total: 'y', parts: ['b', 'c'] },
      { total: 'z', parts: ['c', 'a'] },
    ];
    assert.deepEqual([...hiddenCells(cells, sums)].sort(), ['a', 'b', 'c', 'y']);
  });

  it('refuses two figures with one ID, and a sum with no parts, naming a figure twice or one it was not given', () => {
    assert.throws(() => hiddenCells([cell('a', 12), cell('a', 14)], []), RangeError);
    assert.throws(() => hiddenCells([cell('a', 12)], [{ total: 'a', parts: [] }]), RangeError);
    assert.throws(() => hiddenCells([cell('a', 12)], [{ total: 'a', parts: ['b'] }]), RangeError);
    const named = [cell('a', 4), cell('b', 20), cell('t', 30, 6)];
    assert.throws(() => hiddenCells(named, [{ total: 't', parts: ['a', 'a', 'b'] }]), /twice/);
    assert.throws(() => hiddenCells(named, [{ total: 't', parts: ['t', 'a', 'b'] }]), /twice/);
  });
});

describe('the range over the wilayas', () => {
  const wilaya = (value: number, teachers = 12, schools = 6) => ({ value, teachers, schools });

  it('shows all of them and the middle half once 8 wilayas pass the wilaya floor', () => {
    assert.equal(RANGE_WILAYAS, 8);
    const range = wilayaRange([70, 40, 55, 90, 65, 50, 80, 60].map((value) => wilaya(value)));
    assert.deepEqual(range, { wilayas: 8, all: [40, 90], middle: [53.75, 72.5] });
  });

  it('shows nothing when fewer than 8 pass, and leaves out the wilayas under the floor', () => {
    const seven = [70, 40, 55, 90, 65, 50, 80].map((value) => wilaya(value));
    assert.equal(wilayaRange(seven), null);
    assert.equal(wilayaRange([...seven, wilaya(10, 9), wilaya(99, 30, 2)]), null);
    const nine = wilayaRange([...seven, wilaya(60), wilaya(10, 9), wilaya(99, 30, 2)]);
    assert.deepEqual(nine?.all, [40, 90]);
    assert.equal(nine?.wilayas, 8);
  });

  it('refuses a figure that is not a number', () => {
    const eight = [70, 40, 55, 90, 65, 50, 80, 60].map((value) => wilaya(value));
    assert.throws(() => wilayaRange([...eight, wilaya(Number.NaN)]), RangeError);
    assert.throws(() => wilayaRange([wilaya(Number.POSITIVE_INFINITY)]), RangeError);
  });
});
