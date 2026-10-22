// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The sessions that take a class's list, paired with its items (#230,
// answer 376): the day's and the coming remediation sessions in order, an
// item held but not finished staying for the next one, and the support
// sessions the teacher scheduled taking their turn among the timetabled
// «دعم» sessions. Made-up records only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addCatchUp,
  awaitingBetween,
  confirmSessions,
  listPairs,
  saveSupportQueue,
  scheduledSupport,
  supportItemFor,
  type ListPair,
  type RecordBook,
} from '../src/index.ts';
import { listEvents } from './demo-class.ts';
import { contextOf, d, openBook } from './fixtures.ts';

const tuesday = d('2026-10-13');
const titles = (prefix: string) =>
  [1, 2, 3].map((n) => ({ id: `${prefix}${n}`, title: `${prefix === 'm' ? 'معالجة' : 'دعم'} ${n} (مثال)` }));
const shown = (pairs: readonly ListPair[]) =>
  pairs.map((pair) => [pair.day, pair.catchUp?.id ?? 'timetabled', pair.item?.id ?? null]);

async function withLists(): Promise<RecordBook> {
  const book = await openBook(listEvents());
  await book.record(
    tuesday,
    saveSupportQueue(book.state, { courseId: 'c-lang', kind: 'remediation', items: titles('m') }),
  );
  await book.record(tuesday, saveSupportQueue(book.state, { courseId: 'c-lang', items: titles('s') }));
  return book;
}

describe('list pairs', () => {
  it('pairs the day’s and the coming remediation sessions with the items left, in order', async () => {
    const book = await withLists();
    const pairs = listPairs(contextOf(book), 'c-lang', 'remediation', tuesday);
    assert.deepEqual(shown(pairs).slice(0, 2), [
      [tuesday, 'timetabled', 'm1'],
      [d('2026-10-20'), 'timetabled', 'm2'],
    ]);
    assert.equal(pairs.length >= 3, true);

    const [session] = awaitingBetween(contextOf(book), tuesday, tuesday);
    assert.ok(session);
    const taken = { listItem: { id: 'm1', finished: false } };
    await book.recordAll(tuesday, confirmSessions(contextOf(book), [{ session, details: taken }]));
    const after = listPairs(contextOf(book), 'c-lang', 'remediation', tuesday);
    assert.deepEqual(shown(after)[0], [d('2026-10-20'), 'timetabled', 'm1']);
  });

  it('gives scheduled support sessions their turn among the timetabled ones', async () => {
    const book = await withLists();
    const afternoon = { half: 'afternoon', index: 3 } as const;
    for (const [id, day] of [
      ['u-1', '2026-10-14'],
      ['u-2', '2026-10-18'],
    ] as const) {
      const input = { id, courseId: 'c-lang', day: d(day), slot: afternoon, kind: 'support' as const };
      await book.record(tuesday, addCatchUp(contextOf(book), input, tuesday));
    }
    const context = contextOf(book);
    assert.deepEqual(shown(listPairs(context, 'c-lang', 'support', tuesday)).slice(0, 3), [
      [d('2026-10-14'), 'u-1', 's1'],
      [d('2026-10-15'), 'timetabled', 's2'],
      [d('2026-10-18'), 'u-2', 's3'],
    ]);
    assert.deepEqual(
      scheduledSupport(context, 'c-lang', tuesday).map((one) => [one.catchUp.id, one.item?.id ?? null]),
      [
        ['u-1', 's1'],
        ['u-2', 's3'],
      ],
    );
    assert.equal(supportItemFor(context, 'c-lang', tuesday, 'u-2')?.id, 's3');
    assert.equal(supportItemFor(context, 'c-lang', tuesday)?.id, 's1');
    assert.deepEqual(listPairs(context, 'c-lang', 'remediation', tuesday)[0]?.catchUp, undefined);
  });
});
