// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  cancelCalendarEntry,
  editableCalendarEntry,
  layerOf,
  setCalendarEntry,
  sessionsBetween,
  type CalendarEntry,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

const closure: CalendarEntry = {
  id: 'local-closure',
  layer: 'school',
  schoolId: 's-cem',
  from: d('2026-10-14'),
  to: d('2026-10-15'),
  effect: 'closure',
  name: { ar: 'غلق تجريبي', en: 'Made-up closure' },
  source: 'Made-up notice',
  confidence: 'announced',
};

test('adding, correcting and cancelling an entry append versions and never change an earlier entry', async () => {
  const book = await openBook(cemEvents());
  const before = [...book.entries];
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), closure));
  const corrected = { ...closure, to: closure.from, source: 'Made-up correction', confidence: 'expected' as const };
  await book.record(d('2026-10-13'), setCalendarEntry(contextOf(book), corrected));
  assert.deepEqual(book.state.calendar, [corrected]);
  assert.deepEqual(book.entries.slice(0, before.length), before);
  assert.equal(sessionsBetween(contextOf(book), closure.to, closure.to)[0]?.calendar, null);
  const versions = [...book.entries];
  await book.record(d('2026-10-14'), cancelCalendarEntry(contextOf(book), closure.id));
  assert.deepEqual(book.state.calendar, []);
  assert.deepEqual(book.entries.slice(0, versions.length), versions);
  assert.throws(() => cancelCalendarEntry(contextOf(book), closure.id), /No editable/);
});

test('private entries and their cancellations remain private; an edit cannot promote their layer', async () => {
  const book = await openBook(cemEvents());
  const { schoolId, ...fields } = closure;
  assert.equal(schoolId, 's-cem');
  const entry = { ...fields, id: 'private-seminar', layer: 'teacher' as const };
  const event = setCalendarEntry(contextOf(book), entry);
  assert.equal(layerOf(event), 'private');
  await book.record(d('2026-10-12'), event);
  assert.throws(
    () => setCalendarEntry(contextOf(book), { ...entry, layer: 'school', schoolId: 's-cem' }),
    /keeps its layer/,
  );
  assert.equal(layerOf(cancelCalendarEntry(contextOf(book), entry.id)), 'private');
  assert.equal(
    contextOf(book).calendar.teachingWeeks(book.state.schools.get('s-cem')!).length,
    contextOf(await openBook(cemEvents())).calendar.teachingWeeks(book.state.schools.get('s-cem')!).length,
  );
});

test('reference entries, private A/B resets and Ramadan rules are not editable through the local form', async () => {
  const book = await openBook(cemEvents());
  assert.equal(editableCalendarEntry(contextOf(book), 'storm'), null);
  assert.throws(() => setCalendarEntry(contextOf(book), { ...closure, id: 'storm' }), /Reference/);
  assert.throws(() => cancelCalendarEntry(contextOf(book), 'storm'), /No editable/);
  for (const entry of [
    { ...closure, id: 'reset', layer: 'teacher' as const, effect: 'week-a' as const },
    { ...closure, id: 'ramadan', times: 'ramadan' as const },
  ]) {
    await book.record(d('2026-10-12'), { kind: 'calendar.set', entry });
    assert.equal(editableCalendarEntry(contextOf(book), entry.id), null);
  }
});

test('rejects invalid dates, scopes, names, sources and an invented local confidence', async () => {
  const book = await openBook(cemEvents());
  for (const fields of [
    { from: d('2025-10-14') },
    { to: d('2027-12-01') },
    { to: d('2026-10-01') },
    { from: '2026-02-30' },
    { source: '' },
    { source: 'line\nbreak' },
    { source: 'x'.repeat(201) },
    { name: {} },
    { name: { ar: '' } },
    { name: { ar: 'x'.repeat(161) } },
    { schoolId: 'missing' },
    { layer: 'national', schoolId: undefined },
    { layer: 'zone', zone: '31', schoolId: undefined },
    { confidence: 'projected' },
    { levels: ['missing'] },
    { levels: ['cem'], grades: ['5ap'] },
    { term: 1 },
  ])
    assert.throws(() => setCalendarEntry(contextOf(book), { ...closure, ...fields } as CalendarEntry));
  assert.equal(book.state.calendar.length, 0);
});

test('a school event marks the day without cancelling lessons; a wilaya closure affects its own schools only', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), { ...closure, effect: 'marker' }));
  assert.equal(sessionsBetween(contextOf(book), closure.from, closure.from)[0]?.calendar, null);
  const { schoolId, ...rest } = closure;
  assert.equal(schoolId, 's-cem');
  await book.record(
    d('2026-10-12'),
    setCalendarEntry(contextOf(book), { ...rest, id: 'zone', layer: 'zone', zone: '16' }),
  );
  assert.equal(sessionsBetween(contextOf(book), closure.from, closure.from)[0]?.calendar, 'closure');
  await book.record(d('2026-10-12'), cancelCalendarEntry(contextOf(book), 'zone'));
  assert.equal(sessionsBetween(contextOf(book), closure.from, closure.from)[0]?.calendar, null);
});

test('correcting an added day keeps its ID and ignores its own old sessions during clash checks', async () => {
  const book = await openBook(cemEvents());
  const day = d('2026-10-17');
  const entry: CalendarEntry = {
    ...closure,
    id: 'make-up',
    from: day,
    to: day,
    effect: 'adds-sessions',
    adds: 'make-up',
    follows: 3,
    takes: ['c-math/m3/g-all/every'],
  };
  await book.record(d('2026-10-12'), setCalendarEntry(contextOf(book), entry));
  const before = [...book.entries];
  await book.record(d('2026-10-13'), setCalendarEntry(contextOf(book), { ...entry, source: 'Corrected source' }));
  assert.equal(book.state.calendar.length, 1);
  assert.equal(book.state.calendar[0]?.id, entry.id);
  assert.equal(sessionsBetween(contextOf(book), day, day).length, 1);
  assert.deepEqual(book.entries.slice(0, before.length), before);
});
