// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { confirmCourse, pace, sessionsBetween, type CalendarEntry } from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const late: CalendarEntry = {
  id: 'late-closure',
  layer: 'school',
  schoolId: 's-cem',
  from: d('2026-10-14'),
  to: d('2026-10-15'),
  effect: 'closure',
  name: { en: 'Made-up closure' },
  source: 'Made-up notice',
  confidence: 'announced',
};

test('a late closure never relabels a held lesson as a calendar loss or rewrites its record', async () => {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), late.from, late.from);
  assert.ok(session);
  const [record] = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: session.key }], late.from);
  assert.ok(record);
  await book.record(late.from, { kind: 'session.recorded', record });
  const history = [...book.entries];
  const before = pace(contextOf(book), 'c-math', late.from);
  await book.record(late.to, { kind: 'calendar.set', entry: late });
  const after = sessionsBetween(contextOf(book), late.from, late.to);
  assert.equal(after.find((one) => one.key === session.key)?.calendar, null);
  assert.equal(after.find((one) => one.day === late.to)?.calendar, 'closure');
  assert.equal(pace(contextOf(book), 'c-math', late.from)?.position, before?.position);
  assert.equal(pace(contextOf(book), 'c-math', late.from)?.lost.closure, 0);
  assert.deepEqual(book.entries.slice(0, history.length), history);
  assert.deepEqual(book.state.sessions.get(session.key)?.at(-1)?.value, record);
});

test('a session explicitly not held still counts as a calendar loss when a closure is announced', async () => {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), late.from, late.from);
  assert.ok(session);
  const [record] = confirmCourse(
    contextOf(book),
    'c-math',
    [{ sessionKey: session.key, choice: { outcome: 'not-held' } }],
    late.from,
  );
  assert.ok(record);
  await book.record(late.from, { kind: 'session.recorded', record });
  await book.record(late.to, { kind: 'calendar.set', entry: late });
  assert.equal(pace(contextOf(book), 'c-math', late.from)?.lost.closure, 1);
  assert.equal(sessionsBetween(contextOf(book), late.from, late.from)[0]?.calendar, 'closure');
});
