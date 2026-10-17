// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  emptyAll,
  emptySeat,
  fillInListOrder,
  groupPupils,
  layerOf,
  newPlan,
  planOf,
  pupilAt,
  resizePlan,
  rollCallUnits,
  seatPupil,
  seatedRoll,
  setSeating,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const ids = (plan: { seats: readonly { row: number; column: number; pupilId: string }[] }) =>
  [...plan.seats].sort((a, b) => a.row - b.row || a.column - b.column).map((seat) => seat.pupilId);

describe('the seating plan', () => {
  it('starts as six rows of six seats in pairs, and fills the empty seats in list order from the board', async () => {
    const context = contextOf(await openBook(cemEvents()));
    const plan = { ...newPlan('k-1am2', 'g-all'), columns: 4 };
    assert.deepEqual([newPlan('k-1am2', 'g-all').rows, newPlan('k-1am2', 'g-all').aisleEvery], [6, 2]);
    const pupils = groupPupils(context, 'k-1am2', 'g-all', d('2026-09-21'));
    assert.equal(pupils.length, 10);
    const filled = fillInListOrder(seatPupil(plan, 'p10', 0, 1), pupils);
    assert.equal(pupilAt(filled, 0, 1), 'p10');
    assert.deepEqual(ids(filled), ['p01', 'p10', 'p02', 'p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09']);
    assert.deepEqual(ids(emptyAll(filled)), []);
    assert.equal(pupilAt(emptySeat(filled, 0, 1), 0, 1), null);
  });

  it('moves a seated pupil, giving the moving pupil’s old seat to the one displaced', () => {
    const plan = seatPupil(seatPupil(newPlan('k-1am2', 'g-all'), 'p01', 0, 0), 'p02', 2, 3);
    const swapped = seatPupil(plan, 'p01', 2, 3);
    assert.equal(pupilAt(swapped, 2, 3), 'p01');
    assert.equal(pupilAt(swapped, 0, 0), 'p02');
    const unseated = seatPupil(plan, 'p03', 0, 0);
    assert.deepEqual(ids(unseated), ['p03', 'p02']);
    assert.deepEqual(seatPupil(plan, 'p01', 0, 0).seats.length, 2);
    assert.throws(() => seatPupil(plan, 'p04', 6, 0), /No such seat/);
  });

  it('unseats the pupils of the seats a smaller room loses, and keeps the size within bounds', () => {
    const plan = seatPupil(seatPupil(newPlan('k-1am2', 'g-all'), 'p01', 5, 5), 'p02', 1, 1);
    const smaller = resizePlan(plan, 4, 4);
    assert.deepEqual([smaller.rows, smaller.columns, ids(smaller)], [4, 4, ['p02']]);
    const bounded = resizePlan(plan, 40, 0);
    assert.deepEqual([bounded.rows, bounded.columns], [12, 1]);
  });

  it('records a plan in the private layer, one per group, once checked', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const group = fillInListOrder(newPlan('k-1am2', 'g-1'), groupPupils(context, 'k-1am2', 'g-1', d('2026-09-21')));
    const event = setSeating(context, group);
    assert.equal(layerOf(event), 'private');
    await book.record(d('2026-09-21'), event);
    assert.deepEqual(ids(planOf(contextOf(book), 'k-1am2', 'g-1')!), ['p01', 'p02', 'p03', 'p04', 'p05']);
    assert.equal(planOf(contextOf(book), 'k-1am2', 'g-all'), null);

    const plan = newPlan('k-1am2', 'g-all');
    assert.throws(() => setSeating(context, { ...plan, classId: 'k-none' }), /Unknown class/);
    assert.throws(() => setSeating(context, { ...plan, groupId: 'g-none' }), /Unknown group/);
    assert.throws(() => setSeating(context, { ...plan, rows: 13 }), /too large/);
    assert.throws(() => setSeating(context, { ...plan, aisleEvery: 4 }), /Unknown aisle/);
    assert.throws(
      () => setSeating(context, { ...plan, seats: [{ row: 6, column: 0, pupilId: 'p01' }] }),
      /outside the room/,
    );
    const twice = [
      { row: 0, column: 0, pupilId: 'p01' },
      { row: 0, column: 1, pupilId: 'p01' },
    ];
    assert.throws(() => setSeating(context, { ...plan, seats: twice }), /appears twice/);
    assert.throws(
      () => setSeating(context, { ...plan, seats: [{ row: 0, column: 0, pupilId: 'p99' }] }),
      /not in the class/,
    );
  });

  it('lays a roll call’s pupils on its group’s plan, with those who have no seat apart', async () => {
    const book = await openBook(cemEvents());
    const unit = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-21'), d('2026-09-21'))[0]!;
    assert.equal(seatedRoll(contextOf(book), unit), null);
    const plan = seatPupil(seatPupil(newPlan('k-1am2', 'g-all'), 'p02', 0, 0), 'p01', 1, 2);
    await book.record(d('2026-09-21'), setSeating(contextOf(book), plan));
    const roll = seatedRoll(contextOf(book), unit)!;
    assert.equal(roll.seats.length, 6);
    assert.equal(roll.seats[0]![0]?.id, 'p02');
    assert.equal(roll.seats[1]![2]?.id, 'p01');
    assert.equal(roll.seats[0]![1], null);
    assert.deepEqual(
      roll.unseated.map((pupil) => pupil.id),
      ['p03', 'p04', 'p05', 'p06', 'p07', 'p08', 'p09', 'p10'],
    );
  });
});
