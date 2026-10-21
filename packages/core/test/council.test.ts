// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setCalendarEntry, sessionsBetween, type CalendarEntry } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const council: CalendarEntry = {
  id: 'council',
  layer: 'school',
  schoolId: 's-cem',
  from: d('2026-10-14'),
  to: d('2026-10-14'),
  effect: 'marker',
  council: { classId: 'k-1am2', term: 1, at: '14:00' },
  name: { ar: 'مجلس قسم تجريبي' },
  source: 'Made-up notice',
  confidence: 'announced',
};

test('a class council marks its day without taking a session, and keeps its class on an edit', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), council));
  assert.equal(sessionsBetween(contextOf(book), council.from, council.from)[0]?.calendar, null);
  const held = { ...council, council: { ...council.council!, held: true as const } };
  await book.record(d('2026-10-14'), setCalendarEntry(contextOf(book), held));
  assert.deepEqual(book.state.calendar, [held]);
  assert.throws(
    () => setCalendarEntry(contextOf(book), { ...council, council: { ...council.council!, classId: 'other' } }),
    /keeps its class/,
  );
  const { council: rule, ...plain } = council;
  assert.equal(rule?.classId, 'k-1am2');
  assert.throws(() => setCalendarEntry(contextOf(book), plain), /keeps its class/);
  assert.throws(() => setCalendarEntry(contextOf(book), { ...plain, id: 'event', council: rule, effect: 'closure' }));
});

test('a council needs a known class of its school, a term of the year, a time and one day', async () => {
  const book = await openBook(cemEvents());
  for (const fields of [
    { council: { classId: 'missing', term: 1, at: '14:00' } },
    { council: { classId: 'k-1am2', term: 4, at: '14:00' } },
    { council: { classId: 'k-1am2', term: 1, at: '25:00' } },
    { council: { classId: 'k-1am2', term: 1, at: '2pm' } },
    { council: { classId: 'k-1am2', term: 1, at: '14:00', held: false } },
    { to: d('2026-10-15') },
    { half: 'afternoon' },
    { effect: 'closure' },
    { layer: 'teacher', schoolId: undefined },
    { grades: ['1am'] },
  ])
    assert.throws(
      () => setCalendarEntry(contextOf(book), { ...council, ...fields } as CalendarEntry),
      /council|scope/i,
    );
  assert.equal(book.state.calendar.length, 0);
});
