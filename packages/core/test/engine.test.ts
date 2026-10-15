// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  makeContext,
  sessionsBetween,
  walkCourse,
  type Choice,
  type Context,
  type Day,
  type Proposal,
  type RecordBook,
  type Session,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPack, openBook, primaryEvents, reference } from './fixtures.ts';

function show(proposal: Proposal | null | undefined): string {
  if (proposal === null || proposal === undefined) return 'none';
  return `${proposal.item.id} ${proposal.from}-${proposal.to}${proposal.continued ? ' continued' : ''}`;
}

function proposalsFor(context: Context, courseId: string, from: Day, to: Day): string[] {
  const walk = walkCourse(context, courseId, to);
  return awaitingBetween(context, from, to)
    .filter((session) => session.courseId === courseId)
    .map((session) => `${session.day} ${session.groupId}: ${show(walk.proposals.get(session.key))}`);
}

async function confirm(book: RecordBook, from: Day, to: Day, choices: Record<string, Choice> = {}): Promise<void> {
  const context = contextOf(book);
  const sessions = awaitingBetween(context, from, to);
  await book.recordAll(
    to,
    confirmSessions(
      context,
      sessions.map((session: Session) => {
        const choice = choices[session.day];
        return choice === undefined ? { session } : { session, choice };
      }),
    ),
  );
}

describe('the engine', () => {
  it('proposes the next unfinished item, spreading stages over the budget', async () => {
    const context = contextOf(await openBook(cemEvents()));
    assert.deepEqual(proposalsFor(context, 'c-math', d('2026-09-20'), d('2026-09-24')), [
      '2026-09-20 g-all: d1 0-1',
      '2026-09-21 g-all: l1 0-2',
      '2026-09-22 g-1: t1 0-1',
      '2026-09-23 g-all: l1 2-4 continued',
      '2026-09-24 g-all: l2 0-4',
    ]);
  });

  it('carries the remaining stages over after "last stage reached"', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-21'), { '2026-09-21': { outcome: 'partial', reached: 1 } });
    assert.deepEqual(proposalsFor(contextOf(book), 'c-math', d('2026-09-23'), d('2026-09-23')), [
      '2026-09-23 g-all: l1 1-4 continued',
    ]);
  });

  it("shares a merged session's time between its items", async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-24'), { '2026-09-24': { outcome: 'merged', with: 'l3' } });
    const progress = walkCourse(contextOf(book), 'c-math', d('2026-09-24')).progress;
    assert.equal(progress.spent('l2', 'g-all'), 0.5);
    assert.equal(progress.spent('l3', 'g-all'), 0.5);
  });

  it('keeps an item without stages in progress until its budget is used', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-24'), { '2026-09-24': { outcome: 'merged', with: 'l3' } });
    assert.deepEqual(proposalsFor(contextOf(book), 'c-math', d('2026-09-27'), d('2026-09-28')), [
      '2026-09-27 g-all: l4 0-0',
      '2026-09-28 g-all: l4 0-1 continued',
    ]);
  });

  it('skips an item, and can teach the next one in its place', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-24'), { '2026-09-24': { outcome: 'skipped', instead: true } });
    const thursday = [...book.state.sessions.values()]
      .map((versions) => versions.at(-1)?.value)
      .find((r) => r?.session.day === '2026-09-24');
    assert.deepEqual(thursday?.coverage, [
      { op: 'skipped', item: 'l2' },
      { op: 'taught', item: 'l3', from: 0, to: 1 },
    ]);
    assert.deepEqual(proposalsFor(contextOf(book), 'c-math', d('2026-09-27'), d('2026-09-27')), [
      '2026-09-27 g-all: l4 0-0',
    ]);
  });

  it('does not move the plan for a session not held, or an item taught again', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-21'), {
      '2026-09-20': { outcome: 'not-held' },
      '2026-09-21': { outcome: 'retaught', item: 'd1' },
    });
    assert.deepEqual(proposalsFor(contextOf(book), 'c-math', d('2026-09-23'), d('2026-09-23')), [
      '2026-09-23 g-all: d1 0-1',
    ]);
  });

  // By 24 September only the first half-group has had t1.
  it('runs TD in its own queue, done for the class once both half-groups have had it', async () => {
    const book = await openBook(cemEvents());
    const t1 = mathPack.items.find((item) => item.id === 't1');
    assert.ok(t1);
    await confirm(book, d('2026-09-20'), d('2026-09-24'));
    const half = walkCourse(contextOf(book), 'c-math', d('2026-09-24')).progress;
    assert.equal(half.isFinished(mathPack, t1, 'g-1'), true);
    assert.equal(half.isFinished(mathPack, t1, 'g-2'), false);
    assert.equal(half.isFinished(mathPack, t1, 'g-all'), false);
    assert.deepEqual(half.coveredStages('t1', 'g-all'), []);

    await confirm(book, d('2026-09-27'), d('2026-10-01'));
    const context = contextOf(book);
    assert.deepEqual(
      proposalsFor(context, 'c-math', d('2026-10-06'), d('2026-10-13')).filter(
        (line) => line.includes('g-1') || line.includes('g-2'),
      ),
      ['2026-10-06 g-1: t2 0-1', '2026-10-13 g-2: t2 0-1'],
    );
    const progress = walkCourse(context, 'c-math', d('2026-10-01')).progress;
    assert.equal(progress.isFinished(mathPack, t1, 'g-all'), true);
    assert.equal(progress.covered('d1', 'g-all'), 1);
  });

  it('keeps the outcome and stages when a correction gives only details', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-21'), { '2026-09-21': { outcome: 'partial', reached: 1 } });
    const [monday] = sessionsBetween(contextOf(book), d('2026-09-21'), d('2026-09-21'));
    assert.ok(monday);
    const homework = { text: 'Exercise 3', due: d('2026-09-23') };
    await book.recordAll(
      d('2026-09-22'),
      confirmSessions(contextOf(book), [{ session: monday, details: { homework }, reason: 'Added the homework' }]),
    );
    const [first, second] = book.state.sessions.get(monday.key)?.map((version) => version.value) ?? [];
    assert.ok(first && second);
    assert.equal(second.outcome, 'partial');
    assert.deepEqual(second, { ...first, homework });
  });

  // Monday covers stages 0-2 of l1, and Wednesday stages 2-4. Once Monday is
  // corrected, Thursday starts again from the first stage not covered.
  it('uncovers the stages of a session corrected to not held', async () => {
    const book = await openBook(cemEvents());
    await confirm(book, d('2026-09-20'), d('2026-09-23'));
    const [monday] = sessionsBetween(contextOf(book), d('2026-09-21'), d('2026-09-21'));
    assert.ok(monday);
    await book.recordAll(
      d('2026-09-24'),
      confirmSessions(contextOf(book), [
        { session: monday, choice: { outcome: 'not-held' }, reason: 'Recorded by mistake' },
      ]),
    );
    const progress = walkCourse(contextOf(book), 'c-math', d('2026-09-24')).progress;
    const l1 = mathPack.items.find((item) => item.id === 'l1');
    assert.ok(l1);
    assert.deepEqual(progress.coveredStages('l1', 'g-all'), [2, 3]);
    assert.equal(progress.isFinished(mathPack, l1, 'g-all'), false);
    assert.deepEqual(proposalsFor(contextOf(book), 'c-math', d('2026-09-24'), d('2026-09-24')), [
      '2026-09-24 g-all: l1 0-4 continued',
    ]);
  });

  it('matches activity slots in a week pack', async () => {
    const context = contextOf(await openBook(primaryEvents()));
    assert.deepEqual(proposalsFor(context, 'c-lang', d('2026-09-20'), d('2026-09-24')), [
      '2026-09-20 h-all: r1 0-1',
      '2026-09-20 h-all: w1 0-1',
      '2026-09-20 h-all: s1 0-1',
      '2026-09-21 h-all: r2 0-1',
      '2026-09-21 h-all: w2 0-1',
      '2026-09-22 h-all: s2 0-1',
      '2026-09-23 h-all: r3 0-1',
      '2026-09-24 h-all: w3 0-1',
    ]);
  });

  it('refuses outcomes that do not fit the proposal', async () => {
    const book = await openBook(cemEvents());
    const context = contextOf(book);
    const [sunday] = awaitingBetween(context, d('2026-09-20'), d('2026-09-20'));
    assert.ok(sunday);
    assert.throws(
      () => confirmSessions(context, [{ session: sunday, choice: { outcome: 'partial', reached: 2 } }]),
      RangeError,
    );
    assert.throws(
      () => confirmSessions(context, [{ session: sunday, choice: { outcome: 'merged', with: 'd1' } }]),
      RangeError,
    );
    assert.throws(
      () => confirmSessions(context, [{ session: sunday, choice: { outcome: 'retaught', item: 'u1' } }]),
      RangeError,
    );
  });

  it('proposes nothing without a pack, and says when the pinned pack is missing', async () => {
    const events = cemEvents().map((event) =>
      event.kind === 'course.set'
        ? { ...event, course: { ...event.course, pack: { id: 'dz.cem.1am.math.other', release: '2026.1' } } }
        : event,
    );
    const context = makeContext(reference, (await openBook(events)).state);
    const walk = walkCourse(context, 'c-math', d('2026-09-20'));
    assert.equal(walk.setup.packMissing, true);
    assert.deepEqual([...walk.proposals.values()], [null]);
  });
});
