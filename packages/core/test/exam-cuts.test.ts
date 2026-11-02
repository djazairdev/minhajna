// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Where a school exam's cut stands (#601, answers 33 and 632): with no record
// the paper is set as today; one setter's cut is proposed and waits for the
// other; once both signed an item the earliest applies, a setter's highest
// version by the deadline counting, so an older cut put again never wins, and
// the proposer being the setter who has named it the longest; a cut signed past
// the deadline does not count; and a setter's no cut, or the deadline passing
// unsettled, leaves the decision to the director, whose first decision once it
// falls to them is final, an earlier one not counting. Every school, class and
// teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cutState, parseDay } from '../src/index.ts';
import { madeUpRoom } from './exam-kit.ts';

const day = (text: string) => parseDay(text);

describe('where a school exam’s cut stands', () => {
  it('waits for every setter, the earliest item applying, a later cut replacing an earlier one', async () => {
    const { decider, first, second, chart, put, cut, read } = await madeUpRoom();
    const [one, two] = chart.setters.map((setter) => setter.assignment);
    assert.equal(cutState(await read(), day('2029-11-23')), null);
    await put('chart', chart, decider);
    const none = cutState(await read(), day('2029-11-23'))!;
    assert.deepEqual([none.signed.size, none.proposed, none.settled, none.director], [0, null, null, false]);
    await put('cut', cut('u2.w1'), first);
    const waits = cutState(await read(), day('2029-11-23'))!;
    assert.deepEqual([waits.proposed, waits.settled, waits.director], [{ item: 'u2.w1', by: one }, null, false]);
    await put('cut', cut('u2'), second);
    const settled = cutState(await read(), day('2029-11-24'))!;
    assert.deepEqual(settled.settled, { item: 'u2', by: 'setters' });
    assert.deepEqual(settled.proposed, { item: 'u2', by: two });
    await put('cut', cut('u1.w2', '2029-11-27', 1), first);
    await put('cut', cut('u1', '2029-11-28', 1), second);
    const later = cutState(await read(), day('2029-11-30'))!;
    assert.deepEqual(
      [later.settled, later.proposed],
      [
        { item: 'u1.w2', by: 'setters' },
        { item: 'u1.w2', by: one },
      ],
    );
    assert.deepEqual(
      [...later.signed],
      [
        [one, 'u1.w2'],
        [two, 'u2'],
      ],
    );
  });

  it('leaves the decision to the director on a no cut or past the deadline, the first once due final', async () => {
    const { decider, first, second, chart, put, cut, read } = await madeUpRoom();
    await put('chart', chart, decider);
    await put('decision', cut('u1', '2029-11-23'), decider);
    await put('cut', cut('u2'), first);
    assert.deepEqual(cutState(await read(), day('2029-11-27'))!.director, false);
    assert.deepEqual(cutState(await read(), day('2029-11-28'))!.director, true);
    await put('cut', cut(null), second);
    const due = cutState(await read(), day('2029-11-24'))!;
    assert.deepEqual([due.settled, due.director, due.proposed?.item], [null, true, 'u2']);
    await put('decision', cut('u1.w1', '2029-11-24'), decider);
    await put('decision', cut(null, '2029-11-25'), decider);
    await put('cut', cut('u2'), second);
    const decided = cutState(await read(), day('2029-11-25'))!;
    assert.deepEqual([decided.settled, decided.director], [{ item: 'u1.w1', by: 'director' }, true]);
  });

  it('decides with no setter’s record once the deadline passed', async () => {
    const { decider, chart, put, cut, read } = await madeUpRoom();
    await put('chart', chart, decider);
    await put('decision', cut(null, '2029-11-28'), decider);
    assert.deepEqual(cutState(await read(), day('2029-11-28'))!.settled, { item: null, by: 'director' });
  });

  it('counts each setter’s highest version, so an older cut put again never wins', async () => {
    const { decider, first, second, chart, put, cut, read } = await madeUpRoom();
    const [one] = chart.setters.map((setter) => setter.assignment);
    await put('chart', chart, decider);
    await put('cut', cut('u1'), first);
    await put('cut', cut('u3', '2029-11-24', 1), first);
    await put('cut', cut('u3'), second);
    await put('cut', cut('u1'), first);
    await put('cut', cut(null, '2029-11-23', 0), first);
    const state = cutState(await read(), day('2029-11-25'))!;
    assert.deepEqual(
      [state.settled, state.director, state.signed.get(one!)],
      [{ item: 'u3', by: 'setters' }, false, 'u3'],
    );
    await put('cut', cut('u2', '2029-11-25', 2), first);
    assert.deepEqual(cutState(await read(), day('2029-11-25'))!.settled, { item: 'u2', by: 'setters' });
  });
});
