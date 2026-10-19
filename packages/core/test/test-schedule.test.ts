// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Tests on the teacher's schedule, the decisions about items past an exam
// window, and the warning (#221). In lateBook nothing is taught until the
// end of November: the window of 6 to 10 December is then four lessons
// away, and the term's plan needs more.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allowedBy,
  awaitingBetween,
  confirmSessions,
  mayMerge,
  pastWindow,
  proposalAt,
  recordsForRoute,
  sessionsBetween,
  walkCourse,
  type Day,
  type PlanDecision,
  type RecordBook,
  type RecordEvent,
  type ScheduledTest,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook } from './fixtures.ts';

function scheduled(id: string, day: Day, index: number): ScheduledTest {
  return { id, courseId: 'c-math', day, slot: { half: 'morning', index }, groupId: 'g-all', title: 'First test' };
}

function decided(decision: PlanDecision): RecordEvent {
  return { kind: 'plan.decided', decision };
}

function proposedOn(book: RecordBook, day: Day): string | null | undefined {
  const context = contextOf(book);
  const [session] = sessionsBetween(context, day, day);
  assert.ok(session);
  return proposalAt(context, session)?.item.id ?? null;
}

async function lateBook(): Promise<RecordBook> {
  const book = await openBook(cemEvents());
  const context = contextOf(book);
  const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-11-26'));
  await book.recordAll(
    d('2026-11-26'),
    confirmSessions(
      context,
      sessions.map((session) => ({ session, choice: { outcome: 'not-held' } })),
    ),
  );
  return book;
}

function itemsPast(book: RecordBook, today: Day = d('2026-11-26')): (readonly [string, Day | null])[] | null {
  return (
    pastWindow(contextOf(book), 'c-math', today)?.items.map(({ item, lands }) => [item.id, lands] as const) ?? null
  );
}

describe('test schedule', () => {
  it('takes its session, which proposes nothing, and the lessons flow around it', async () => {
    const book = await openBook(cemEvents());
    assert.equal(proposedOn(book, d('2026-09-23')), 'l1');
    await book.recordAll(d('2026-09-21'), [{ kind: 'test.set', test: scheduled('t-1', d('2026-09-23'), 3) }]);

    const [session] = sessionsBetween(contextOf(book), d('2026-09-23'), d('2026-09-23'));
    assert.equal(session?.sessionType, 'test');
    assert.equal(session?.test, 't-1');
    assert.equal(proposedOn(book, d('2026-09-23')), null);
    assert.equal(proposedOn(book, d('2026-09-24')), 'l1');
    assert.equal(awaitingBetween(contextOf(book), d('2026-09-23'), d('2026-09-23')).length, 1);

    await book.recordAll(d('2026-09-22'), [{ kind: 'test.removed', id: 't-1' }]);
    assert.equal(proposedOn(book, d('2026-09-23')), 'l1');
  });

  it('leaves a session the calendar takes as it is', async () => {
    const book = await openBook(cemEvents());
    await book.recordAll(d('2026-10-20'), [{ kind: 'test.set', test: scheduled('t-1', d('2026-12-06'), 1) }]);
    const [session] = sessionsBetween(contextOf(book), d('2026-12-06'), d('2026-12-06'));
    assert.equal(session?.sessionType, 'lesson');
    assert.equal(session?.test, undefined);
    assert.notEqual(session?.calendar, null);
  });

  it('counts an optional item left out as skipped, and only an optional one', async () => {
    const book = await lateBook();
    assert.equal(proposedOn(book, d('2027-01-10')), 'l6');
    await book.recordAll(d('2026-09-13'), [
      decided({ id: 'x-1', courseId: 'c-math', kind: 'leave-out', item: 'l6' }),
      decided({ id: 'x-2', courseId: 'c-math', kind: 'leave-out', item: 'd1' }),
    ]);
    assert.equal(proposedOn(book, d('2027-01-10')), 'l7');
    assert.equal(proposedOn(book, d('2026-11-29')), 'd1');
    await book.recordAll(d('2026-09-13'), [{ kind: 'plan.undecided', id: 'x-1' }]);
    assert.equal(proposedOn(book, d('2027-01-10')), 'l6');
  });

  it('merges in the plan order, and only items the pack lets merge', async () => {
    const book = await openBook(cemEvents());
    await book.recordAll(d('2026-09-13'), [
      decided({ id: 'x-1', courseId: 'c-math', kind: 'merge', items: ['l3', 'l2'] }),
      decided({ id: 'x-2', courseId: 'c-math', kind: 'merge', items: ['l4', 'i1'] }),
    ]);
    const context = contextOf(book);
    const [session] = sessionsBetween(context, d('2026-09-24'), d('2026-09-24'));
    assert.ok(session);
    assert.equal(proposalAt(context, session)?.with?.item.id, 'l3');
    assert.equal(proposedOn(book, d('2026-09-27')), 'l4');
    const [next] = sessionsBetween(context, d('2026-09-27'), d('2026-09-27'));
    assert.ok(next);
    assert.equal(proposalAt(context, next)?.with, undefined);
  });

  it('offers a merge only of items side by side in a group, and not yet merged', async () => {
    const pack = { ...mathPack, merges: [['l2', 'l3', 'l4']] };
    const merge = (a: string, b: string): PlanDecision => ({
      id: 'x',
      courseId: 'c-math',
      kind: 'merge',
      items: [a, b],
    });
    assert.equal(allowedBy(pack, merge('l2', 'l3')), true);
    assert.equal(allowedBy(pack, merge('l4', 'l3')), true);
    assert.equal(allowedBy(pack, merge('l2', 'l4')), false);
    assert.equal(allowedBy(pack, merge('l2', 'l5')), false);
    assert.equal(allowedBy(pack, merge('l2', 'l2')), false);

    const book = await openBook(cemEvents());
    assert.equal(mayMerge(mathPack, book.state.decisions, 'c-math', ['l2', 'l3']), true);
    await book.recordAll(d('2026-09-13'), [
      decided({ id: 'x-1', courseId: 'c-math', kind: 'merge', items: ['l2', 'l3'] }),
    ]);
    assert.equal(mayMerge(mathPack, book.state.decisions, 'c-math', ['l3', 'l2']), false);
    assert.equal(mayMerge(mathPack, book.state.decisions, 'c-other', ['l2', 'l3']), true);
  });

  it('keeps a recorded session as it was recorded, a test only if so', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-09-23'));
    await book.recordAll(
      d('2026-09-23'),
      confirmSessions(
        context,
        sessions.map((session) => ({ session })),
      ),
    );
    await book.recordAll(d('2026-09-23'), [
      { kind: 'test.set', test: scheduled('t-1', d('2026-09-23'), 3) },
      { kind: 'test.set', test: scheduled('t-2', d('2026-09-24'), 1) },
    ]);
    const [taken] = awaitingBetween(contextOf(book), d('2026-09-24'), d('2026-09-24'));
    assert.ok(taken);
    await book.recordAll(d('2026-09-24'), confirmSessions(contextOf(book), [{ session: taken }]));

    const [lesson, test] = sessionsBetween(contextOf(book), d('2026-09-23'), d('2026-09-24'));
    assert.deepEqual([lesson?.sessionType, lesson?.test], ['lesson', undefined]);
    assert.deepEqual([test?.sessionType, test?.test], ['test', 't-2']);
  });

  it('proposes two merged items in one session, both to their last stage', async () => {
    const book = await openBook(cemEvents());
    await book.recordAll(d('2026-09-13'), [
      decided({ id: 'x-1', courseId: 'c-math', kind: 'merge', items: ['l2', 'l3'] }),
    ]);
    const context = contextOf(book);
    const [session] = sessionsBetween(context, d('2026-09-24'), d('2026-09-24'));
    assert.ok(session);
    const proposal = proposalAt(context, session);
    assert.equal(proposal?.item.id, 'l2');
    assert.equal(proposal?.to, 4);
    assert.deepEqual(
      proposal?.with && { item: proposal.with.item.id, from: proposal.with.from, to: proposal.with.to },
      {
        item: 'l3',
        from: 0,
        to: 1,
      },
    );

    const sessions = awaitingBetween(context, d('2026-09-20'), d('2026-09-24'));
    await book.recordAll(
      d('2026-09-24'),
      confirmSessions(
        context,
        sessions.map((s) => ({ session: s })),
      ),
    );
    const recorded = [...book.state.sessions.values()].map((versions) => versions.at(-1)?.value);
    const merged = recorded.find((record) => record?.session.day === '2026-09-24');
    assert.deepEqual(merged?.coverage, [
      { op: 'taught', item: 'l2', from: 0, to: 4 },
      { op: 'taught', item: 'l3', from: 0, to: 1 },
    ]);
    assert.equal(proposedOn(book, d('2026-09-27')), 'l4');
  });

  it('warns of the items past the next exam window, in the plan order', async () => {
    const book = await lateBook();
    const warning = pastWindow(contextOf(book), 'c-math', d('2026-11-26'));
    assert.deepEqual(warning?.window, { from: '2026-12-06', to: '2026-12-10', confidence: 'announced' });
    assert.equal(warning?.term, 1);
    assert.deepEqual(itemsPast(book), [
      ['l3', '2026-12-13'],
      ['l4', '2026-12-14'],
      ['i1', '2026-12-17'],
      ['l5', '2027-01-06'],
    ]);
    assert.equal(itemsPast(book, d('2026-12-06')), null);
    assert.equal(pastWindow(contextOf(await openBook(cemEvents())), 'c-math', d('2026-09-20')), null);
  });

  it('counts a test before the window, and a merge, in the warning', async () => {
    const book = await lateBook();
    await book.recordAll(d('2026-11-26'), [{ kind: 'test.set', test: scheduled('t-1', d('2026-12-03'), 1) }]);
    assert.deepEqual(itemsPast(book)?.[0], ['l2', '2026-12-13']);

    const merging = await lateBook();
    await merging.recordAll(d('2026-11-26'), [
      decided({ id: 'x-1', courseId: 'c-math', kind: 'merge', items: ['l2', 'l3'] }),
    ]);
    assert.deepEqual(itemsPast(merging), [
      ['l4', '2026-12-13'],
      ['i1', '2026-12-16'],
      ['l5', '2027-01-04'],
    ]);
  });

  it('leaves the items postponed for that term alone', async () => {
    const book = await lateBook();
    await book.recordAll(d('2026-11-26'), [
      decided({ id: 'x-1', courseId: 'c-math', kind: 'postpone', items: ['l3', 'l4'], term: 1 }),
    ]);
    assert.deepEqual(
      itemsPast(book)?.map(([item]) => item),
      ['i1', 'l5'],
    );
    await book.recordAll(d('2026-11-26'), [
      decided({ id: 'x-2', courseId: 'c-math', kind: 'postpone', items: ['i1', 'l5'], term: 1 }),
    ]);
    assert.equal(itemsPast(book), null);
  });

  it('sends the tests and the decisions with the lesson records', async () => {
    const book = await openBook(cemEvents());
    await book.recordAll(d('2026-09-21'), [
      { kind: 'test.set', test: scheduled('t-2', d('2026-10-14'), 3) },
      { kind: 'test.set', test: scheduled('t-1', d('2026-10-07'), 3) },
      decided({ id: 'x-1', courseId: 'c-math', kind: 'leave-out', item: 'l6' }),
    ]);
    const records = recordsForRoute(book.state, 'statement');
    assert.deepEqual(
      records.flatMap((record) => (record.kind === 'test.set' ? [record.test.id] : [])),
      ['t-1', 't-2'],
    );
    assert.ok(records.some((record) => record.kind === 'plan.decided'));
    assert.ok(walkCourse(contextOf(book), 'c-math', d('2026-10-14')).proposals.size > 0);
  });
});
