// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A cover the teacher gives a colleague's class (#224, answer 332): any day
// of the year, a school of the teacher's and the class as typed on one line,
// times that end after they start, and whether it took place; never an
// exam-week entry, and never counted. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coversOn, dutiesOn, sessionsBetween, setDuty, type ExamDuty } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const cover: ExamDuty = {
  id: 'cover-1',
  kind: 'cover',
  day: d('2026-10-14'),
  from: '11:00',
  to: '12:00',
  schoolId: 's-cem',
  className: ' 3م4 ',
};

test('a cover is set on any day of the year, its class trimmed, and is listed apart from the exam week', async () => {
  const book = await openBook(cemEvents());
  const event = setDuty(contextOf(book), cover);
  assert.deepEqual(event, { kind: 'duty.set', duty: { ...cover, className: '3م4' } });
  const before = sessionsBetween(contextOf(book), cover.day, cover.day).length;
  await book.record(d('2026-10-12'), event);
  assert.deepEqual(
    coversOn(book.state, cover.day).map((one) => one.id),
    ['cover-1'],
  );
  assert.deepEqual(dutiesOn(book.state, cover.day), []);
  assert.equal(sessionsBetween(contextOf(book), cover.day, cover.day).length, before);
  const done = setDuty(contextOf(book), { ...cover, done: true });
  assert.equal(done.kind === 'duty.set' && done.duty.done, true);
});

test('a cover needs a school of the teacher’s, a class on one line, and times; it has no room or classes', async () => {
  const context = contextOf(await openBook(cemEvents()));
  for (const fields of [
    { schoolId: 'other' },
    { schoolId: undefined },
    { className: '  ' },
    { className: 'x'.repeat(21) },
    { className: '3م\n4' },
    { from: '12:00', to: '11:00' },
    { from: '9h' },
    { room: '5' },
    { courseIds: ['c-math'] },
    { done: false },
    { day: d('2025-10-14') },
  ])
    assert.throws(() => setDuty(context, { ...cover, ...fields } as ExamDuty));
});

test('only a cover names a school, a class or its outcome', async () => {
  const context = contextOf(await openBook(cemEvents()));
  const invigilation: ExamDuty = { id: 'i-1', kind: 'invigilation', day: d('2026-12-07'), from: '10:00', to: '12:00' };
  assert.doesNotThrow(() => setDuty(context, invigilation));
  for (const fields of [{ schoolId: 's-cem' }, { className: '3م4' }, { done: true as const }])
    assert.throws(() => setDuty(context, { ...invigilation, ...fields }), /Only a cover/);
});
