// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  confirmDeparture,
  joinPupil,
  leavePupil,
  pendingDeparture,
  pupilsFor,
  rollCallUnits,
  type Joining,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const JOINING: Joining = {
  id: 'p11',
  classId: 'k-1am2',
  name: ' سلمى حداد ',
  sex: 'f',
  registration: '2209180544',
  day: d('2026-09-23'),
  reason: 'transfer',
};

const listed = (book: Awaited<ReturnType<typeof openBook>>, day: string) => {
  const context = contextOf(book);
  const unit = rollCallUnits(context, 'k-1am2', d(day), d(day))[0];
  assert.ok(unit);
  return pupilsFor(context, unit).map((pupil) => pupil.id);
};

describe('pupils who join or leave', () => {
  it('adds a pupil at the end of the list, called from the day they join', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-23'), joinPupil(contextOf(book), JOINING));
    const pupil = book.state.pupils.get('p11');
    assert.equal(pupil?.name, 'سلمى حداد');
    assert.deepEqual(pupil?.movements, [{ day: '2026-09-23', kind: 'in', reason: 'transfer' }]);
    assert.ok(!listed(book, '2026-09-21').includes('p11'));
    assert.equal(listed(book, '2026-09-23').at(-1), 'p11');
  });

  it('refuses a pupil with no name, a registration number with other signs, or one already listed', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.throws(() => joinPupil(context, { ...JOINING, name: '  ' }), /needs a name/);
    assert.throws(() => joinPupil(context, { ...JOINING, registration: '22-09' }), /digits only/);
    assert.throws(() => joinPupil(context, { ...JOINING, registration: '0000000001' }), /already listed/);
    assert.throws(() => joinPupil(context, { ...JOINING, id: 'p01' }), /already listed/);
    assert.throws(() => joinPupil(context, { ...JOINING, classId: 'k-none' }), /Unknown class/);
    const event = joinPupil(context, { ...JOINING, registration: ' ' });
    assert.ok(event.kind === 'pupil.set' && event.pupil.registration === undefined);
  });

  it('keeps a pupil who left listed until the director confirms', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-09-22'), leavePupil(contextOf(book), 'p01', d('2026-09-22'), 'transfer'));
    const pending = pendingDeparture(book.state.pupils.get('p01')!);
    assert.deepEqual(pending, { day: '2026-09-22', kind: 'out', reason: 'transfer' });
    assert.ok(listed(book, '2026-09-23').includes('p01'));
    assert.throws(() => leavePupil(contextOf(book), 'p01', d('2026-09-23'), 'other'), /already recorded/);

    await book.record(d('2026-09-24'), confirmDeparture(contextOf(book), 'p01'));
    const pupil = book.state.pupils.get('p01')!;
    assert.equal(pendingDeparture(pupil), null);
    assert.equal(pupil.movements.length, 1, 'the confirmation replaces the departure it confirms');
    assert.ok(listed(book, '2026-09-21').includes('p01'));
    assert.ok(!listed(book, '2026-09-23').includes('p01'));
  });

  it('refuses to confirm what was not recorded, and a departure before the pupil joined', async () => {
    const book = await openBook(cemEvents());
    assert.throws(() => confirmDeparture(contextOf(book), 'p02'), /No departure/);
    assert.throws(() => leavePupil(contextOf(book), 'p99', d('2026-09-22'), 'other'), /Unknown pupil/);
    await book.record(d('2026-09-23'), joinPupil(contextOf(book), JOINING));
    assert.throws(() => leavePupil(contextOf(book), 'p11', d('2026-09-21'), 'other'), /not on the list/);
  });
});
