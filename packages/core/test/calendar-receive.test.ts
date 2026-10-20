// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calendarImpact,
  cancelCalendarEntry,
  confirmCourse,
  current,
  effectiveCalendar,
  editableCalendarEntry,
  makeContext,
  parseCalendarNotice,
  receiveCalendarNotice,
  sessionsBetween,
} from '../src/index.ts';
import { cemEvents, d, openBook, reference } from './fixtures.ts';
import { noticeFile } from './calendar-notice-fixtures.ts';

const ref = { ...reference, country: { ...reference.country, zones: [{ code: '16', name: { en: 'Example zone' } }] } };
const read = (value = noticeFile) => parseCalendarNotice(JSON.stringify(value), ref.country, ref.year);
const contextOf = (book: Awaited<ReturnType<typeof openBook>>) => makeContext(ref, book.state);

test('requires explicit acknowledgement, a matching school/wilaya, and then previews without writing', async () => {
  const book = await openBook(cemEvents());
  const context = contextOf(book);
  const notice = read();
  const before = [...book.entries];
  assert.throws(() => receiveCalendarNotice(context, notice, 's-cem', false));
  assert.throws(() => receiveCalendarNotice(context, notice, 'missing', true));
  assert.throws(() =>
    receiveCalendarNotice(context, { ...notice, school: { ...notice.school!, name: 'Another school' } }, 's-cem', true),
  );
  const result = receiveCalendarNotice(context, notice, 's-cem', true);
  assert.equal(result.status, 'new');
  if (result.status !== 'new') throw new Error('Expected a new notice');
  assert.equal(result.match, 'name');
  const impact = calendarImpact(context, result.event, d('2026-10-14'));
  assert.ok(impact.changes.some((one) => one.after?.calendar === 'closure'));
  assert.deepEqual(book.entries, before);
  await book.record(d('2026-10-14'), result.event);
  assert.equal(book.state.calendar[0]?.received?.sender, notice.sender);
  assert.equal(editableCalendarEntry(contextOf(book), notice.entry.id), null);
  const same = receiveCalendarNotice(contextOf(book), notice, 's-cem', true);
  assert.equal(same.status, 'duplicate');
  const length = book.entries.length;
  await book.record(d('2026-10-14'), cancelCalendarEntry(contextOf(book), notice.entry.id));
  assert.equal(book.entries.length, length + 1);
  assert.equal(book.state.calendar.length, 0);
});

test('matching official codes win over spelling, but mismatched codes, zones and taught grades are refused', async () => {
  const book = await openBook(cemEvents());
  const school = book.state.schools.get('s-cem')!;
  await book.record(d('2026-10-14'), { kind: 'school.set', school: { ...school, code: 'example-code' } });
  const notice = read();
  const matched = receiveCalendarNotice(
    contextOf(book),
    { ...notice, school: { name: 'Different spelling', zone: '16', code: 'example-code' } },
    's-cem',
    true,
  );
  assert.equal(matched.status === 'new' && matched.match, 'code');
  for (const school of [
    { name: notice.school!.name, zone: '16', code: 'wrong-code' },
    { name: notice.school!.name, zone: '31', code: 'example-code' },
  ])
    assert.throws(() => receiveCalendarNotice(contextOf(book), { ...notice, school }, 's-cem', true));
  assert.throws(() =>
    receiveCalendarNotice(contextOf(book), { ...notice, entry: { ...notice.entry, grades: ['4am'] } }, 's-cem', true),
  );
});

test('an ID collision never overwrites an entry or a private layer; the same file remains idempotent', async () => {
  const book = await openBook(cemEvents());
  const result = receiveCalendarNotice(contextOf(book), read(), 's-cem', true);
  if (result.status !== 'new') throw new Error('Expected a new notice');
  await book.record(d('2026-10-14'), result.event);
  const prior = [...book.entries];
  const changed = read({ ...noticeFile, entry: { ...noticeFile.entry, to: '2026-10-16' } });
  assert.throws(() => receiveCalendarNotice(contextOf(book), changed, 's-cem', true));
  assert.equal(receiveCalendarNotice(contextOf(book), read(), 's-cem', true).status, 'duplicate');
  assert.equal(
    receiveCalendarNotice(contextOf(book), { ...read(), sender: 'Another unverified sender' }, 's-cem', true).status,
    'duplicate',
  );
  assert.deepEqual(book.entries, prior);
  const privateBook = await openBook(cemEvents());
  await privateBook.record(d('2026-10-14'), {
    kind: 'calendar.set',
    entry: { ...read().entry, layer: 'teacher', effect: 'no-school' },
  });
  const privateHistory = [...privateBook.entries];
  assert.throws(() => receiveCalendarNotice(contextOf(privateBook), read(), 's-cem', true));
  assert.deepEqual(privateBook.entries, privateHistory);
});

test('a wilaya notice binds only to a school in that wilaya, with no portable school identity', async () => {
  const book = await openBook(cemEvents());
  const school = book.state.schools.get('s-cem')!;
  await book.record(d('2026-10-14'), { kind: 'school.set', school: { ...school, id: 'other-school', zone: '31' } });
  const { school: portable, ...file } = noticeFile;
  assert.ok(portable);
  const notice = parseCalendarNotice(
    JSON.stringify({ ...file, entry: { ...file.entry, layer: 'zone', zone: '16' } }),
    ref.country,
    ref.year,
  );
  const result = receiveCalendarNotice(contextOf(book), notice, 's-cem', true);
  assert.equal(result.status, 'new');
  if (result.status !== 'new') throw new Error('Expected a new notice');
  assert.equal(result.match, 'zone');
  assert.equal(result.entry.schoolId, undefined);
  assert.equal(result.entry.received?.school, undefined);
  assert.throws(() => receiveCalendarNotice(contextOf(book), notice, 'other-school', true));
});

test('a later reference with the same stable identity replaces the received effect without duplicate sessions', async () => {
  const book = await openBook(cemEvents());
  const result = receiveCalendarNotice(contextOf(book), read(), 's-cem', true);
  if (result.status !== 'new') throw new Error('Expected a new notice');
  await book.record(d('2026-10-14'), result.event);
  const { received, ...entry } = result.entry;
  assert.ok(received);
  const base = { ...entry, source: 'Example bundled correction', to: d('2026-10-16') };
  assert.equal(effectiveCalendar([base], book.state.calendar).length, 1);
  const context = makeContext({ ...ref, calendar: [base] }, book.state);
  assert.equal(receiveCalendarNotice(context, read(), 's-cem', true).status, 'duplicate');
  assert.equal(sessionsBetween(context, d('2026-10-14'), d('2026-10-15')).length, 2);
  assert.equal(effectiveCalendar([{ ...base, layer: 'teacher' }], book.state.calendar).length, 2);
});

test('receiving a late closure never rewrites a taught session', async () => {
  const book = await openBook(cemEvents());
  const day = d('2026-10-14');
  const session = sessionsBetween(contextOf(book), day, day)[0]!;
  const record = confirmCourse(contextOf(book), session.courseId, [{ sessionKey: session.key }], day)[0]!;
  await book.record(day, { kind: 'session.recorded', record });
  const result = receiveCalendarNotice(contextOf(book), read(), 's-cem', true);
  if (result.status !== 'new') throw new Error('Expected a new notice');
  await book.record(day, result.event);
  assert.deepEqual(current(book.state.sessions.get(session.key)), record);
  assert.equal(sessionsBetween(contextOf(book), day, day)[0]!.calendar, null);
});
