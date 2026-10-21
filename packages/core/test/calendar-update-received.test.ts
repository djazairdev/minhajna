// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyCalendarUpdate,
  CALENDAR_UPDATE_FORMAT,
  CalendarNoticeError,
  makeContext,
  parseCalendarNotice,
  parseCalendarUpdate,
  readVersion,
  receiveCalendarNotice,
  type CalendarUpdate,
} from '../src/index.ts';
import { noticeFile } from './calendar-notice-fixtures.ts';
import { cemEvents, d, openBook, reference } from './fixtures.ts';

const zones = [{ code: '16', name: { en: 'Example zone' } }];
const ref = { ...reference, calendarRelease: '2026.3', country: { ...reference.country, zones } };
const { school: portable, ...file } = noticeFile;
const closure = { ...file.entry, layer: 'zone', zone: '16' };
const { half, ...wholeDay } = closure;
const notice = (entry: object = closure) =>
  parseCalendarNotice(JSON.stringify({ ...file, entry }), ref.country, ref.year);

const update = (release: string, fields: object): CalendarUpdate => {
  const read = parseCalendarUpdate(
    {
      format: CALENDAR_UPDATE_FORMAT,
      version: { major: 1, minor: 0 },
      country: 'dz',
      year: '2026-2027',
      release,
      published: '2026-10-13',
      entries: [],
      removed: [],
      ...fields,
    },
    ref.country,
    ref.year,
  );
  if (!read.ok) throw new Error(JSON.stringify(read.problems));
  return read.value;
};

async function received() {
  const book = await openBook(cemEvents());
  const result = receiveCalendarNotice(makeContext(ref, book.state), notice(), 's-cem', true);
  if (result.status !== 'new') throw new Error('Expected a new notice');
  await book.record(d('2026-10-12'), result.event);
  const apply = async (one: CalendarUpdate) =>
    book.record(d('2026-10-13'), applyCalendarUpdate(makeContext(ref, book.state), one, 'example-ministry', '{}'));
  const closed = () => {
    const school = book.state.schools.get('s-cem')!;
    return makeContext(ref, book.state).calendar.info(d('2026-10-14'), school).closure?.id ?? null;
  };
  return { book, apply, closed };
}

test('a received closure an update cancels stays cancelled', async () => {
  const { apply, closed } = await received();
  assert.ok(portable);
  assert.equal(half, 'morning');
  assert.equal(closed(), closure.id);
  await apply(update('2026.4', { entries: [{ ...wholeDay, source: 'Example update' }] }));
  assert.equal(closed(), closure.id);
  await apply(update('2026.5', { removed: [closure.id] }));
  assert.equal(closed(), null);
});

test('a received closure an update narrows to other grades no longer applies twice', async () => {
  const { book, apply, closed } = await received();
  await apply(update('2026.4', { entries: [{ ...wholeDay, grades: ['3am'], levels: ['cem'] }] }));
  const school = book.state.schools.get('s-cem')!;
  const entries = makeContext(ref, book.state).calendar.entriesFor(school);
  assert.deepEqual(
    entries.filter((entry) => entry.id === closure.id),
    [],
  );
  assert.equal(closed(), null);
});

test('a notice under an ID an update took out is refused', async () => {
  const book = await openBook(cemEvents());
  const removed = update('2026.4', { removed: [closure.id] });
  await book.record(
    d('2026-10-13'),
    applyCalendarUpdate(makeContext(ref, book.state), removed, 'example-ministry', '{}'),
  );
  assert.throws(
    () => receiveCalendarNotice(makeContext(ref, book.state), notice(), 's-cem', true),
    (error) => error instanceof CalendarNoticeError && error.problem === 'conflict',
  );
});

test('reads a version strictly', () => {
  assert.deepEqual(readVersion({ major: 1, minor: 2 }), { major: 1, minor: 2 });
  for (const value of [
    { major: 1, minor: 0, extra: 1 },
    { major: 1, minor: -1 },
    { major: 1, minor: 0.5 },
    { major: 0, minor: 0 },
    { major: 1 },
    [1, 0],
    null,
  ])
    assert.equal(readVersion(value), null);
  const problems = (version: unknown) => {
    const read = parseCalendarUpdate(
      { ...{ format: CALENDAR_UPDATE_FORMAT, country: 'dz', year: '2026-2027', release: '2026.4' }, version },
      ref.country,
      ref.year,
    );
    return read.ok ? [] : read.problems.map((one) => `${one.path} ${one.problem}`);
  };
  assert.deepEqual(problems({ major: 1, minor: 0, extra: 1 }), ['version invalid']);
  assert.deepEqual(problems({ major: 1, minor: -1 }), ['version invalid']);
});
