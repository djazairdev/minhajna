// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Today's half-group pair (#231, R-4.7-15, answer 387): a half's session
// names the other half's turn at its item, its day and, with A and B
// weeks, its week letter, the
// whole class's session that takes it first, or that it has had it; a
// whole-class session and a half alone in the main plan have no pair.
// Made-up classes only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awaitingBetween, confirmSessions, halfPair, halfPairs, walkCourse, type RecordEvent } from '../src/index.ts';
import { contextOf, d, openBook } from './fixtures.ts';
import { labEvents } from './half-fixtures.ts';

/** Both halves every week on Tuesday, one after the other. */
function weeklyEvents(): RecordEvent[] {
  return labEvents().map((event) =>
    event.kind === 'timetable.set'
      ? {
          ...event,
          version: {
            ...event.version,
            entries: event.version.entries.map((entry) =>
              entry.id === 'e-tue-1'
                ? { ...entry, weeks: 'every' as const }
                : entry.id === 'e-tue-2'
                  ? { ...entry, weeks: 'every' as const, slot: { ...entry.slot, index: entry.slot.index + 1 } }
                  : entry,
            ),
          },
        }
      : event,
  );
}

const from = d('2026-09-20');
const to = d('2026-10-20');

describe('the half-group pair', () => {
  it('names the other half’s session for the same item, with its day and no letter in a weekly timetable', async () => {
    const context = contextOf(await openBook(weeklyEvents()));
    const proposals = walkCourse(context, 'c-math', to).proposals;
    const [first, second] = awaitingBetween(context, from, to).filter((one) => one.groupId !== 'g-all');
    const item = proposals.get(first!.key)!.item.id;
    assert.equal(proposals.get(second!.key)?.item.id, item);
    assert.deepEqual(halfPair(context, first!, item), [
      { groupId: 'g-1', done: false, day: first!.day, withClass: false, letter: null },
      { groupId: 'g-2', done: false, day: second!.day, withClass: false, letter: null },
    ]);
  });

  it('says the other half has had it once its session is on record', async () => {
    const book = await openBook(weeklyEvents());
    const context = contextOf(book);
    const [first, second] = awaitingBetween(context, from, to).filter((one) => one.groupId !== 'g-all');
    const item = walkCourse(context, 'c-math', to).proposals.get(first!.key)!.item.id;
    await book.recordAll(first!.day, confirmSessions(context, [{ session: first!, choice: { outcome: 'done' } }]));
    const pair = halfPair(contextOf(book), second!, item);
    assert.deepEqual(pair?.[0], { groupId: 'g-2', done: false, day: second!.day, withClass: false, letter: null });
    assert.deepEqual(pair?.[1], { groupId: 'g-1', done: true, day: null, withClass: false, letter: null });
  });

  it('names the whole class’s session when it takes the item before the other half’s turn', async () => {
    const context = contextOf(await openBook(labEvents()));
    const awaiting = awaitingBetween(context, from, to);
    const proposals = walkCourse(context, 'c-math', to).proposals;
    const half = awaiting.find((one) => one.groupId === 'g-1')!;
    const item = proposals.get(half.key)!.item.id;
    const next = awaiting.find((one) => one.groupId === 'g-all' && one.day > half.day);
    assert.equal(proposals.get(next!.key)?.item.id, item);
    assert.deepEqual(halfPair(context, half, item)?.[1], {
      groupId: 'g-2',
      done: false,
      day: next!.day,
      withClass: true,
      letter: 'A',
    });
  });

  it('gives every session of a day the same turns at once', async () => {
    const context = contextOf(await openBook(weeklyEvents()));
    const proposals = walkCourse(context, 'c-math', to).proposals;
    const day = awaitingBetween(context, from, to).filter((one) => one.day === d('2026-09-22'));
    const wanted = day.map((session) => ({ session, itemId: proposals.get(session.key)!.item.id }));
    const pairs = halfPairs(context, wanted);
    assert.equal(pairs.size, 2);
    assert.deepEqual(
      [...pairs.keys()],
      day.filter((one) => one.groupId !== 'g-all').map((one) => one.key),
    );
    for (const { session, itemId } of wanted) {
      assert.deepEqual(pairs.get(session.key) ?? null, halfPair(context, session, itemId));
    }
  });

  it('has no pair for a whole-class session, a half alone or an unknown item', async () => {
    const context = contextOf(await openBook(labEvents()));
    const awaiting = awaitingBetween(context, from, to);
    const proposals = walkCourse(context, 'c-math', to).proposals;
    const whole = awaiting.find((one) => one.groupId === 'g-all')!;
    assert.equal(halfPair(context, whole, proposals.get(whole.key)!.item.id), null);
    const half = awaiting.find((one) => one.groupId === 'g-1')!;
    assert.equal(halfPair(context, half, 'no-such-item'), null);

    const alone = contextOf(await openBook(labEvents(true)));
    const lone = awaitingBetween(alone, from, to).find((one) => one.groupId === 'g-1')!;
    assert.equal(halfPair(alone, lone, proposals.get(half.key)!.item.id), null);
  });
});
