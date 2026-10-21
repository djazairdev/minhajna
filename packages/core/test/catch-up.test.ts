// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The catch-up options of a class behind its plan (#228, answers 349 to
// 351): the buffers used and left, TD apart, and the pack's merges and
// optional items for the next exams' term. The demo pack marks
// «Subtracting whole numbers» optional here. Made-up data only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  behindPlan,
  catchUp,
  confirmSessions,
  makeContext,
  pace,
  packKey,
  type Context,
  type Day,
  type PlanChoice,
} from '../src/index.ts';
import { cemEvents, d, mathPack, openBook, reference } from './fixtures.ts';

const pack = {
  ...mathPack,
  items: mathPack.items.map((item) => (item.id === 'l4' ? { ...item, optional: true } : item)),
};
const ref = { ...reference, packs: new Map([[packKey(pack.id, pack.release), pack]]) };

/** The class with every session until `until` recorded as not held. */
async function lateContext(until: Day): Promise<Context> {
  const book = await openBook(cemEvents());
  const before = makeContext(ref, book.state);
  const sessions = awaitingBetween(before, d('2026-09-20'), until);
  await book.recordAll(
    until,
    confirmSessions(
      before,
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return makeContext(ref, book.state);
}

const named = (choice: PlanChoice): string =>
  choice.kind === 'leave-out'
    ? `leave-out ${choice.item.id}`
    : `merge ${choice.items.map((item) => item.id).join('+')}`;

describe('catch-up options', () => {
  it('are not called for while the class is on its plan', async () => {
    const context = makeContext(ref, (await openBook(cemEvents())).state);
    assert.equal(behindPlan(pace(context, 'c-math', d('2026-09-13'))), false);
    assert.equal(behindPlan(null), false);
  });

  it('state the buffers, TD apart, and the pack’s proposals for the next exams', async () => {
    const day = d('2026-10-15');
    const context = await lateContext(day);
    const paced = pace(context, 'c-math', day);
    assert.ok(behindPlan(paced));
    const options = catchUp(context, 'c-math', day);
    assert.ok(options);
    assert.equal(options.term, 1);
    assert.equal(options.bufferUsed, paced?.bufferUsed);
    assert.equal(options.bufferLeft, paced?.bufferLeft);
    assert.equal(options.delay, paced?.delay);
    assert.equal(options.hasBuffers, true);
    assert.equal(options.own, false);
    assert.ok(options.td !== null && options.td.items > 0);
    assert.deepEqual(options.choices.map(named), ['merge l2+l3', 'leave-out l4']);
  });

  it('offer nothing for a class without a plan', async () => {
    const book = await openBook(
      cemEvents().map((event) =>
        event.kind === 'course.set' && event.course.id === 'c-math'
          ? { ...event, course: { ...event.course, pack: null } }
          : event,
      ),
    );
    assert.equal(catchUp(makeContext(ref, book.state), 'c-math', d('2026-10-15')), null);
  });
});
