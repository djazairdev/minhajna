// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A stale pack (#230, Plan-stale, answer 382): its reason read with it, and
// refused on a pack that is not stale; a class pinned to it gets no
// proposal, and no buffer, delay, term check, re-pace draft, exam-window
// warning or drift beside a parallel class on a release in force is counted
// from it, while the same class on a pack in force does. Made-up packs only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  courseSetup,
  driftBefore,
  makeContext,
  nextSeq,
  packKey,
  pace,
  parsePlanPack,
  pastWindow,
  recordChange,
  repaceDraft,
  termCheck,
  todayView,
  type Context,
} from '../src/index.ts';
import { cemEvents, contextOf, d, languagePackSource, mathPack, openBook, reference } from './fixtures.ts';
import { twoClasses } from './parallel-fixtures.ts';

const reason = { ar: 'غيّر قرار لاحق ساعات المادة (مثال)', fr: 'Exemple', en: 'Example' };
const stale = { ...mathPack, status: 'stale' as const, staleReason: reason };
const staleRef = { ...reference, packs: new Map([...reference.packs, [packKey(stale.id, stale.release), stale]]) };
const day = d('2026-10-04');

async function contexts(): Promise<{ readonly fresh: Context; readonly old: Context }> {
  const book = await openBook(cemEvents());
  return { fresh: makeContext(reference, book.state), old: makeContext(staleRef, book.state) };
}

describe('stale packs', () => {
  it('reads the reason of a stale pack, and refuses one on a pack that is not stale', () => {
    const read = parsePlanPack({ ...languagePackSource, status: 'stale', staleReason: reason });
    assert.ok(read.ok);
    assert.deepEqual(read.value.staleReason, reason);
    const refused = parsePlanPack({ ...languagePackSource, staleReason: reason });
    assert.equal(refused.ok, false);
    assert.ok(!refused.ok && refused.problems.some((one) => one.path === 'staleReason'));
  });

  it('proposes nothing and counts no pace from a stale pack', async () => {
    const { fresh, old } = await contexts();
    assert.equal(courseSetup(fresh, 'c-math').packStale, false);
    assert.equal(courseSetup(old, 'c-math').packStale, true);
    const proposals = (context: Context) =>
      todayView(context, day)
        .sessions.filter((one) => one.course.id === 'c-math' && one.status === 'awaiting')
        .map((one) => one.proposal);
    assert.ok(proposals(fresh).length > 0 && proposals(fresh).every((one) => one !== null));
    assert.ok(proposals(old).length > 0 && proposals(old).every((one) => one === null));
    assert.notEqual(pace(fresh, 'c-math', day), null);
    assert.equal(pace(old, 'c-math', day), null);
    assert.equal(termCheck(old, 'c-math', day), null);
    assert.equal(repaceDraft(old, 'c-math', day), null);
  });

  it('warns of no exam window and no drift from a stale pack', async () => {
    const late = await openBook(cemEvents());
    const sessions = awaitingBetween(makeContext(reference, late.state), d('2026-09-20'), d('2026-11-26'));
    const notHeld = sessions.map((session) => ({ session, choice: { outcome: 'not-held' as const } }));
    await late.recordAll(d('2026-11-26'), confirmSessions(makeContext(reference, late.state), notHeld));
    assert.notEqual(pastWindow(makeContext(reference, late.state), 'c-math', d('2026-11-26')), null);
    assert.equal(pastWindow(makeContext(staleRef, late.state), 'c-math', d('2026-11-26')), null);

    const book = await openBook(twoClasses());
    const start = d('2026-09-20');
    const test = { id: 't3', courseId: 'c-math3', day: d('2026-10-08'), groupId: 'h-all', title: 'Common test' };
    await book.record(start, {
      kind: 'test.set',
      test: { ...test, slot: { half: 'morning', index: 1 }, common: true },
    });
    await book.record(start, {
      kind: 'test.set',
      test: {
        ...test,
        id: 't1',
        courseId: 'c-math',
        groupId: 'g-all',
        slot: { half: 'morning', index: 1 },
        common: true,
      },
    });
    const before = contextOf(book);
    const seq = nextSeq(before.state.decisions, 'c-math3');
    const slower = { id: 'b1', kind: 'budget', item: 'l1', sessions: 5, courseId: 'c-math3', day: start, seq } as const;
    await book.record(start, recordChange(before, slower));
    assert.notEqual(driftBefore(contextOf(book), 'c-math3', start), null);
    const older = { ...stale, release: '2022.1' };
    const both = { ...reference, packs: new Map([...reference.packs, [packKey(older.id, older.release), older]]) };
    const course = book.state.courses.get('c-math3');
    assert.ok(course?.pack);
    await book.record(start, {
      kind: 'course.set',
      course: { ...course, pack: { ...course.pack, release: '2022.1' } },
    });
    assert.equal(courseSetup(makeContext(both, book.state), 'c-math').packStale, false);
    assert.equal(driftBefore(makeContext(both, book.state), 'c-math3', start), null);
    assert.equal(driftBefore(makeContext(both, book.state), 'c-math', start), null);
  });
});
