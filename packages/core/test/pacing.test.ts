// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  awaitingBetween,
  confirmSessions,
  makeContext,
  pace,
  packKey,
  parsePlanPack,
  termCheck,
  type Choice,
  type Day,
  type RecordBook,
} from '../src/index.ts';
import { cemEvents, contextOf, d, mathPackSource, openBook, primaryEvents, reference } from './fixtures.ts';

async function confirmAll(book: RecordBook, from: Day, to: Day, choice?: Choice): Promise<void> {
  const context = contextOf(book);
  const sessions = awaitingBetween(context, from, to);
  await book.recordAll(
    to,
    confirmSessions(
      context,
      sessions.map((session) => (choice === undefined ? { session } : { session, choice })),
    ),
  );
}

describe('pacing', () => {
  it('gives the September check: what the plan needs and what the year gives', async () => {
    const cem = contextOf(await openBook(cemEvents()));
    assert.deepEqual(termCheck(cem, 'c-math', d('2026-09-20')), {
      term: 1,
      before: '2026-12-06',
      basis: 'exam-window',
      confidence: 'announced',
      needs: 12,
      gives: 38,
      td: { gives: 10, items: 2 },
    });
    const primary = contextOf(await openBook(primaryEvents()));
    assert.deepEqual(termCheck(primary, 'c-lang', d('2026-09-20')), {
      term: 1,
      before: '2026-12-18',
      basis: 'term-end',
      confidence: null,
      needs: 11,
      gives: 94,
      td: { gives: 0, items: 0 },
    });
  });

  it('counts TD apart in the September check, and drops the TD items done', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-10-01'));
    const check = termCheck(contextOf(book), 'c-math', d('2026-10-02'));
    assert.deepEqual(check?.td, { gives: 8, items: 1 });
    assert.equal(check?.needs, 4);
    assert.equal(check?.gives, 30);
  });

  it('never reads sessions awaiting confirmation as a delay', async () => {
    const result = pace(contextOf(await openBook(cemEvents())), 'c-math', d('2026-10-01'));
    assert.equal(result?.awaiting, 8);
    assert.equal(result?.recorded, 0);
    assert.equal(result?.delay, 0);
    assert.equal(result?.bufferUsed, 0);
  });

  it('is on the plan when every session went as planned', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-10-01'));
    const result = pace(contextOf(book), 'c-math', d('2026-10-01'));
    assert.equal(result?.recorded, 8);
    assert.equal(result?.position, 8);
    assert.equal(result?.expected, 8);
    assert.equal(result?.delay, 0);
    assert.equal(result?.ahead, 0);
    assert.equal(result?.bufferLeft, 2);
  });

  it('says which buffers are left once some are used', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-30'));
    await confirmAll(book, d('2026-10-01'), d('2026-10-01'), { outcome: 'not-held' });
    const result = pace(contextOf(book), 'c-math', d('2026-10-01'));
    assert.equal(result?.bufferUsed, 1);
    assert.equal(result?.bufferLeft, 1);
    assert.equal(result?.delay, 0);
  });

  it('lets the buffers absorb a delay before showing one', async () => {
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-24'));
    await confirmAll(book, d('2026-09-27'), d('2026-10-01'), { outcome: 'not-held' });
    const result = pace(contextOf(book), 'c-math', d('2026-10-01'));
    assert.equal(result?.position, 4);
    assert.equal(result?.expected, 8);
    assert.equal(result?.bufferUsed, 2);
    assert.equal(result?.delay, 2);
    assert.equal(result?.bufferLeft, 0);
  });

  // The same pack gets a made-up term-2 buffer, which must not absorb a
  // term-1 delay.
  it('takes buffers only from the term being checked', async () => {
    const buffer = {
      id: 'r2',
      kind: 'assessment-remediation',
      title: 'Term 2 remediation',
      unit: 'u2',
      budget: 3,
      buffer: true,
      term: 2,
    };
    const pack = parsePlanPack({ ...mathPackSource, items: [...mathPackSource.items, buffer] });
    assert.ok(pack.ok);
    const withBuffer = { ...reference, packs: new Map([[packKey(pack.value.id, pack.value.release), pack.value]]) };
    const book = await openBook(cemEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-24'));
    await confirmAll(book, d('2026-09-27'), d('2026-10-01'), { outcome: 'not-held' });
    const result = pace(makeContext(withBuffer, book.state), 'c-math', d('2026-10-01'));
    assert.equal(result?.bufferUsed, 2);
    assert.equal(result?.delay, 2);
  });

  it("counts sessions lost to the calendar apart, and those lost to the teacher's own calendar for the teacher alone", async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(pace(contextOf(book), 'c-math', d('2026-11-19'))?.lost, {
      holiday: 1,
      closure: 1,
      teacher: 0,
      rotation: 0,
    });
    await book.record(d('2026-10-01'), {
      kind: 'calendar.set',
      entry: {
        id: 'training',
        layer: 'teacher',
        from: d('2026-10-04'),
        to: d('2026-10-08'),
        effect: 'no-school',
        name: { en: 'Made-up training week' },
        source: 'teacher',
        confidence: 'announced',
      },
    });
    const result = pace(contextOf(book), 'c-math', d('2026-11-19'));
    assert.deepEqual(result?.lost, { holiday: 1, closure: 1, teacher: 4, rotation: 0 });
  });

  it('counts week packs in plan weeks', async () => {
    const book = await openBook(primaryEvents());
    await confirmAll(book, d('2026-09-20'), d('2026-09-24'), { outcome: 'not-held' });
    const first = pace(contextOf(book), 'c-lang', d('2026-09-24'));
    assert.equal(first?.expected, 5);
    assert.equal(first?.bufferUsed, 1);
    assert.equal(first?.delay, 4);
    assert.equal(first?.weeksBehind, 0);

    await confirmAll(book, d('2026-09-27'), d('2026-09-27'), { outcome: 'not-held' });
    const second = pace(contextOf(book), 'c-lang', d('2026-09-27'));
    assert.equal(second?.expected, 8);
    assert.equal(second?.delay, 7);
    assert.equal(second?.weeksBehind, 1);
  });
});
