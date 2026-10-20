// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calendarImpact,
  cancelCalendarEntry,
  confirmCourse,
  setCalendarEntry,
  sessionsBetween,
  type CalendarEntry,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const closure: CalendarEntry = {
  id: 'preview-closure',
  layer: 'school',
  schoolId: 's-cem',
  from: d('2026-10-14'),
  to: d('2026-10-15'),
  effect: 'closure',
  name: { en: 'Made-up closure' },
  source: 'Made-up notice',
  confidence: 'announced',
};

test('a closure preview shows changes and the next-exam capacity without writing state or history', async () => {
  const book = await openBook(cemEvents());
  const before = [...book.entries];
  const state = book.state;
  const context = contextOf(book);
  const impact = calendarImpact(context, setCalendarEntry(context, closure), d('2026-10-12'));
  assert.equal(impact.changes.length, 2);
  assert.ok(impact.changes.every((change) => change.before?.calendar === null && change.after?.calendar === 'closure'));
  assert.equal(impact.recorded, 0);
  assert.equal(impact.courses[0]!.after.gives, impact.courses[0]!.before.gives - 2);
  assert.equal(impact.courses[0]!.after.needs, impact.courses[0]!.before.needs);
  assert.deepEqual(book.entries, before);
  assert.equal(book.state, state);
});

test('editing a range previews both restored and newly cancelled dates, not only the new range', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), closure));
  const edited = { ...closure, from: d('2026-10-15'), to: d('2026-10-18') };
  const impact = calendarImpact(contextOf(book), setCalendarEntry(contextOf(book), edited), d('2026-10-12'));
  assert.ok(impact.changes.some((change) => change.before?.day === '2026-10-14' && change.after?.calendar === null));
  assert.ok(impact.changes.some((change) => change.after?.day === '2026-10-18' && change.after.calendar === 'closure'));
});

test('a cancellation preview restores sessions but leaves the real calendar alone', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), closure));
  const impact = calendarImpact(contextOf(book), cancelCalendarEntry(contextOf(book), closure.id), d('2026-10-12'));
  assert.equal(impact.changes.length, 2);
  assert.ok(impact.changes.every((change) => change.before?.calendar === 'closure' && change.after?.calendar === null));
  assert.equal(book.state.calendar.length, 1);
});

test('held records are reported separately, never among the sessions a preview proposes to change', async () => {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), closure.from, closure.from);
  assert.ok(session);
  const [record] = confirmCourse(contextOf(book), 'c-math', [{ sessionKey: session.key }], closure.from);
  assert.ok(record);
  await book.record(closure.from, { kind: 'session.recorded', record });
  const impact = calendarImpact(contextOf(book), setCalendarEntry(contextOf(book), closure), closure.from);
  assert.equal(impact.recorded, 1);
  assert.equal(impact.changes.length, 1);
  assert.equal(impact.changes[0]!.after?.day, closure.to);
});

test('a marker does not invent session changes or a missing plan’s figures', async () => {
  const events = cemEvents().map((event) =>
    event.kind === 'course.set' ? { ...event, course: { ...event.course, pack: null } } : event,
  );
  const book = await openBook(events);
  const impact = calendarImpact(
    contextOf(book),
    setCalendarEntry(contextOf(book), { ...closure, effect: 'marker' }),
    closure.from,
  );
  assert.deepEqual(impact.changes, []);
  assert.deepEqual(impact.courses, []);
});
