// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { eventOf, rollCallUnits, takeRollCall, verifyHistory } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { deps } from './support.ts';

describe('erasing records', () => {
  // Erasing a roll call's correction alone would bring the first version
  // back, with no reason. A pupil goes with their movements.
  it('erases whole records, never a single version', async () => {
    const book = await openBook(cemEvents());
    const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
    assert.ok(unit);
    const absent = { absent: [{ pupilId: 'p01', justified: false }], late: [] };
    const taken = await book.record(d('2026-09-20'), takeRollCall(contextOf(book), unit, absent));
    const fix = await book.record(
      d('2026-09-23'),
      takeRollCall(contextOf(book), unit, { absent: [], late: [] }, 'Made-up correction'),
    );
    await assert.rejects(book.erase(d('2026-09-24'), [fix.id]), /every version/);
    assert.equal(book.state.rollCalls.get(unit.key)?.length, 2);
    await book.erase(d('2026-09-24'), [taken.id, fix.id]);
    assert.equal(book.state.rollCalls.has(unit.key), false);

    const moved = await book.record(d('2026-10-01'), {
      kind: 'pupil.moved',
      pupilId: 'p02',
      movement: { day: d('2026-10-01'), kind: 'out', reason: 'Transfer', confirmed: true },
    });
    const pupil = book.entries.find((entry) => {
      const event = eventOf(entry);
      return event?.kind === 'pupil.set' && event.pupil.id === 'p02';
    });
    assert.ok(pupil);
    await assert.rejects(book.erase(d('2026-10-02'), [pupil.id]), /every version/);
    await book.erase(d('2026-10-02'), [pupil.id, moved.id]);
    assert.equal(book.state.pupils.has('p02'), false);
    assert.doesNotMatch(JSON.stringify(book.entries), /p02/);

    await assert.rejects(book.erase(d('2026-10-02'), [pupil.id]), /holds no record/);
    assert.deepEqual(await verifyHistory(deps.digest, book.entries), []);
  });
});
