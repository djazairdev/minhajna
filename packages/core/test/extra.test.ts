// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sessions outside the timetable (#219, PRD §3.3): logged with the date and
// the times the teacher typed, never after today or outside the year;
// corrected or removed with the history kept; left out of the plan; its
// topic kept as a private note that never leaves the teacher; and numbered
// in order on the class's page for supervised or additional lessons
// (R-3.8-26), for the school year, blank when there are none. Made-up
// records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MemoryStore,
  RecordBook,
  extraSessions,
  extraTopic,
  forRoute,
  layerOf,
  logExtra,
  pace,
  recordsForRoute,
  removeExtra,
  sessionsBetween,
  supervisedRows,
  type ExtraSession,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const support: ExtraSession = {
  id: 'x-1',
  courseId: 'c-math',
  kind: 'support',
  day: d('2026-10-01'),
  from: '15:00',
  to: '16:00',
};

const topic = '  Fractions, worked again  ';

test('logs a session with the times as typed, and its trimmed topic as a private note', async () => {
  const book = await openBook(cemEvents());
  const events = logExtra(contextOf(book), { ...support, topic } as ExtraSession, d('2026-10-01'), topic);
  assert.deepEqual(events, [
    { kind: 'extra.logged', extra: support },
    { kind: 'session.noted', note: { sessionKey: 'extra:x-1', note: 'Fractions, worked again' } },
  ]);
  await book.recordAll(d('2026-10-01'), events);
  assert.deepEqual(extraSessions(book.state), [support]);
  assert.equal(extraTopic(book.state, 'x-1'), 'Fractions, worked again');
  assert.deepEqual(logExtra(contextOf(book), support, d('2026-10-01'), '   ').at(-1), {
    kind: 'session.noted',
    note: { sessionKey: 'extra:x-1' },
  });
  assert.equal(logExtra(contextOf(await openBook(cemEvents())), support, d('2026-10-01')).length, 1);
});

test('refuses a later day, a day outside the year, a bad time, an end before the start, and an unknown course', async () => {
  const context = contextOf(await openBook(cemEvents()));
  const refused = (extra: ExtraSession, message: RegExp) =>
    assert.throws(() => logExtra(context, extra, d('2026-10-01')), message);
  refused({ ...support, day: d('2026-10-02') }, /once it has taken place/);
  refused({ ...support, day: d('2026-08-01') }, /outside the school year/);
  refused({ ...support, from: '7:00' }, /HH:MM/);
  refused({ ...support, to: '24:00' }, /HH:MM/);
  refused({ ...support, to: '15:00' }, /ends after it starts/);
  refused({ ...support, to: '14:30' }, /ends after it starts/);
  refused({ ...support, courseId: 'c-none' }, /No such course/);
  refused({ ...support, kind: 'detention' as never }, /Unknown kind/);
  assert.throws(() => logExtra(context, support, d('2026-10-01'), 'x'.repeat(201)), /too long/);
});

test('a correction and a removal keep the history, and the plan never moves', async () => {
  const book = await openBook(cemEvents());
  const context = () => contextOf(book);
  const before = pace(context(), 'c-math', d('2026-10-08'));
  const sessionsBefore = sessionsBetween(context(), d('2026-09-01'), d('2026-10-31'));
  await book.recordAll(d('2026-10-01'), logExtra(context(), support, d('2026-10-01')));
  await book.recordAll(
    d('2026-10-02'),
    logExtra(context(), { ...support, kind: 'review', to: '16:30' }, d('2026-10-02')),
  );
  assert.deepEqual(
    extraSessions(book.state).map((extra) => [extra.kind, extra.to]),
    [['review', '16:30']],
  );
  assert.deepEqual(pace(context(), 'c-math', d('2026-10-08')), before);
  assert.deepEqual(sessionsBetween(context(), d('2026-09-01'), d('2026-10-31')), sessionsBefore);
  await book.recordAll(d('2026-10-03'), removeExtra(book.state, 'x-1'));
  assert.deepEqual(extraSessions(book.state), []);
  assert.equal(book.state.extras.get('x-1')?.length, 3);
  assert.throws(() => removeExtra(book.state, 'x-1'), /No such session/);
  const store = new MemoryStore();
  for (const entry of book.entries) await store.append(JSON.parse(JSON.stringify(entry)) as typeof entry);
  assert.deepEqual((await RecordBook.open(store, deps)).state.extras, book.state.extras);
});

test("numbers the class's rows in order of day and time, and leaves other classes' out", async () => {
  const book = await openBook([
    ...cemEvents(),
    {
      kind: 'course.set',
      course: { id: 'c-other', classId: 'k-other', subject: 'math', year: '2026-2027', pack: null },
    },
  ]);
  const log = (extra: ExtraSession) => book.recordAll(extra.day, logExtra(contextOf(book), extra, extra.day));
  await log({ ...support, id: 'x-3', day: d('2026-10-06'), from: '13:00', to: '14:00', kind: 'supervised' });
  await log({ ...support, id: 'x-2', day: d('2026-10-01'), from: '08:00', to: '09:00', kind: 'catch-up' });
  await log(support);
  await log({ ...support, id: 'x-9', courseId: 'c-other' });
  assert.deepEqual(supervisedRows(book.state, 'k-other', '2026-2027').length, 1);
  assert.deepEqual(
    supervisedRows(book.state, 'k-1am2', '2026-2027').map((row) => [
      row.number,
      row.kind,
      row.day,
      row.from,
      row.to,
      row.course.id,
    ]),
    [
      [1, 'catch-up', '2026-10-01', '08:00', '09:00', 'c-math'],
      [2, 'support', '2026-10-01', '15:00', '16:00', 'c-math'],
      [3, 'supervised', '2026-10-06', '13:00', '14:00', 'c-math'],
    ],
  );
  await book.recordAll(d('2026-10-07'), removeExtra(book.state, 'x-2'));
  assert.deepEqual(
    supervisedRows(book.state, 'k-1am2', '2026-2027').map((row) => row.number),
    [1, 2],
  );
  assert.deepEqual(supervisedRows(book.state, 'k-none', '2026-2027'), []);
  assert.deepEqual(supervisedRows(book.state, 'k-1am2', '2027-2028'), []);
});

test('the sessions are lesson records, and their topics stay with the teacher', async () => {
  const book = await openBook(cemEvents());
  await book.recordAll(d('2026-10-01'), logExtra(contextOf(book), support, d('2026-10-01'), 'Rayane: fractions'));
  assert.equal(layerOf({ kind: 'extra.removed', id: 'x-1' }), 'lesson-record');
  const entry = book.entries.at(-2)!;
  assert.equal(layerOf(entry.content!.body as never), 'lesson-record');
  assert.ok(forRoute(book.entries, 'own-devices').includes(entry));
  for (const route of ['documents', 'handover', 'statement'] as const) {
    const records = recordsForRoute(book.state, route);
    assert.ok(
      records.some((record) => record.kind === 'extra.logged'),
      route,
    );
    assert.equal(JSON.stringify(records).includes('Rayane'), false, route);
  }
  assert.ok(forRoute(book.entries, 'own-devices').includes(book.entries.at(-1)!));
  assert.equal(extraTopic(book.state, 'x-1'), 'Rayane: fractions');
  await book.recordAll(d('2026-10-02'), removeExtra(book.state, 'x-1'));
  assert.equal(extraTopic(book.state, 'x-1'), undefined);
  assert.equal(
    recordsForRoute(book.state, 'documents').some((record) => record.kind === 'extra.logged'),
    false,
  );
});
