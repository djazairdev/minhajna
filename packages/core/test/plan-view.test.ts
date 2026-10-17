// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { awaitingBetween, confirmSessions, planView, type Choice, type Day, type RecordBook } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

async function confirmAll(book: RecordBook, from: Day, to: Day, choice?: Choice): Promise<void> {
  const context = contextOf(book);
  await book.recordAll(
    to,
    confirmSessions(
      context,
      awaitingBetween(context, from, to).map((session) => (choice === undefined ? { session } : { session, choice })),
    ),
  );
}

describe('A class plan', () => {
  it('starts with nothing taught, the class and the plan on the first item', async () => {
    const view = planView(contextOf(await openBook(cemEvents())), 'c-math', d('2026-09-20'));
    assert.deepEqual(
      view?.units.map((unit) => unit.id),
      ['u1', 'u2'],
    );
    const [first] = view?.main ?? [];
    assert.equal(first?.status, 'open');
    assert.equal(first?.position, true);
    assert.equal(first?.expected, true);
    assert.equal(first?.next, '2026-09-20');
  });

  it('gives what was taught and when, the stages, the position, the plan as a reference, and the days ahead', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-24'));
    await confirmAll(book, d('2026-09-27'), d('2026-09-28'), { outcome: 'not-held' });
    const view = planView(contextOf(book), 'c-math', d('2026-09-29'));
    const row = (id: string) => view?.main.find((one) => one.item.id === id);
    assert.deepEqual(row('l1'), {
      ...row('l1'),
      status: 'done',
      taught: { from: '2026-09-21', to: '2026-09-23' },
      next: null,
      stages: 4,
      covered: 4,
      position: false,
    });
    assert.equal(row('l3')?.position, true);
    assert.equal(row('l3')?.status, 'open');
    assert.equal(row('l3')?.next, '2026-09-30');
    assert.equal(row('l4')?.expected, true);
    assert.equal(view?.main.filter((one) => one.expected).length, 1);
  });

  it('places the class where the plan goes on after its last recorded session', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-21'), d('2026-09-24'));
    const view = planView(contextOf(book), 'c-math', d('2026-09-25'));
    assert.equal(view?.main.find((one) => one.item.id === 'd1')?.status, 'open');
    assert.equal(view?.main.find((one) => one.position)?.item.id, 'l3');
  });

  it('keeps the class where it is while later sessions await confirmation', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-21'));
    const view = planView(contextOf(book), 'c-math', d('2026-09-24'));
    assert.equal(view?.main.find((one) => one.position)?.item.id, 'l1');
    assert.equal(view?.main.find((one) => one.item.id === 'l2')?.next, '2026-09-24');
  });

  it('counts a TD taught to one half of the class as started', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-24'));
    const td = planView(contextOf(book), 'c-math', d('2026-09-25'))?.td ?? [];
    assert.equal(td[0]?.status, 'started');
    assert.deepEqual(td[0]?.taught, { from: '2026-09-22', to: '2026-09-22' });
    assert.equal(
      td.some((one) => one.expected),
      false,
    );
  });

  it('is null without a pack', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const course = context.state.courses.get('c-math');
    assert.ok(course);
    await book.record(d('2026-09-20'), { kind: 'course.set', course: { ...course, pack: null } });
    assert.equal(planView(contextOf(book), 'c-math', d('2026-09-20')), null);
  });
});
