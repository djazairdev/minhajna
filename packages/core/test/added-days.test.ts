// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Make-up, support and revision days (#219, PRD §4.5, §7.7, R-4.5-08): on a
// weekday's timetable, even on a Saturday or in a holiday. Make-up sessions
// are plan sessions and give the plan more room before the exams, while the
// closure's sessions stay lost; support and revision sessions stay off the
// plan and go on the page for additional lessons. Refused outside the year,
// off the weekday's timetable, or where two sessions would share a slot;
// taken back with the history kept. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MemoryStore,
  RecordBook,
  addSessionsDay,
  addedSessions,
  busySlots,
  closuresBefore,
  followedEntries,
  layerOf,
  removeAddedDay,
  sessionsBetween,
  supervisedRows,
  supportDayRows,
  termCheck,
  type AddedDay,
  type CalendarEntry,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const plain: AddedDay = {
  id: 'add-1',
  schoolId: 's-cem',
  day: d('2026-11-21'),
  adds: 'make-up',
  follows: 3,
  takes: ['c-math/m3/g-all/every'],
  name: { en: 'Make-up day' },
  source: "Director's notice",
  confidence: 'announced',
};

const makeUp: AddedDay = { ...plain, replaces: 'storm' };

test("a make-up day on a Saturday adds plan sessions on Wednesday's timetable, and the closure's stay lost", async () => {
  const book = await openBook(cemEvents());
  const before = termCheck(contextOf(book), 'c-math', d('2026-11-15'));
  assert.deepEqual(
    closuresBefore(contextOf(book), 's-cem', makeUp.day).map((entry) => entry.id),
    ['storm'],
  );
  await book.record(d('2026-11-15'), addSessionsDay(contextOf(book), makeUp));
  const [added] = sessionsBetween(contextOf(book), makeUp.day, makeUp.day);
  assert.deepEqual(added && [added.key, added.calendar, added.added, added.sessionType], [
    'c-math/2026-11-21/m3/g-all',
    null,
    'add-1',
    'lesson',
  ]);
  const storm = sessionsBetween(contextOf(book), d('2026-11-18'), d('2026-11-18'));
  assert.deepEqual(
    storm.map((session) => session.calendar),
    ['closure'],
  );
  const after = termCheck(contextOf(book), 'c-math', d('2026-11-15'));
  assert.equal(after?.gives, (before?.gives ?? 0) + 1);
  assert.equal(after?.needs, before?.needs);
  assert.deepEqual(addedSessions(contextOf(book), makeUp.day, makeUp.day, ['support', 'revision']), []);
});

test("a make-up day in a holiday that falls in a teaching week takes the place of that day's lost session", async () => {
  const book = await openBook(cemEvents());
  const day = d('2026-10-29');
  assert.deepEqual(
    sessionsBetween(contextOf(book), day, day).map((session) => session.calendar),
    ['holiday'],
  );
  await book.record(
    d('2026-10-20'),
    addSessionsDay(contextOf(book), { ...plain, day, follows: 4, takes: ['c-math/m1/g-all/every'] }),
  );
  const [session] = sessionsBetween(contextOf(book), day, day);
  assert.deepEqual(session && [session.key, session.calendar, session.added], [
    'c-math/2026-10-29/m1/g-all',
    null,
    'add-1',
  ]);
});

test('a redrawn week keeps the sessions a day takes, and a day from a file follows the last A or B week in a holiday', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-11-15'), addSessionsDay(contextOf(book), makeUp));
  const [first] = cemEvents().flatMap((event) => (event.kind === 'timetable.set' ? [event.version] : []));
  assert.ok(first);
  await book.record(d('2026-11-16'), {
    kind: 'timetable.set',
    version: {
      ...first,
      id: 'v2',
      from: d('2026-11-16'),
      entries: first.entries.map((entry) => ({ ...entry, id: `new-${entry.id}` })),
    },
  });
  assert.deepEqual(
    sessionsBetween(contextOf(book), makeUp.day, makeUp.day).map((session) => session.key),
    ['c-math/2026-11-21/m3/g-all'],
  );
  const fromFile: CalendarEntry = {
    id: 'file-day',
    layer: 'school',
    schoolId: 's-cem',
    from: d('2026-11-03'),
    to: d('2026-11-03'),
    effect: 'adds-sessions',
    adds: 'revision',
    follows: 2,
    name: { en: 'Holiday revision' },
    source: 'Made-up notice',
    confidence: 'announced',
  };
  await book.record(d('2026-11-16'), { kind: 'calendar.set', entry: fromFile });
  const tuesday = addedSessions(contextOf(book), d('2026-11-03'), d('2026-11-03'), ['revision']);
  assert.equal(tuesday.length, 1);
});

test("the weekday's A and B sessions are the teacher's choice, and the week's are offered first", async () => {
  const book = await openBook(cemEvents());
  const tuesday = followedEntries(contextOf(book), 's-cem', d('2026-11-21'), 2);
  assert.deepEqual(
    tuesday.map((one) => one.entry.id),
    ['e-tue-1', 'e-tue-2'],
  );
  assert.equal(tuesday.filter((one) => one.inWeek).length, 1);
  const chosen = tuesday.find((one) => !one.inWeek)?.take ?? '';
  await book.record(d('2026-11-15'), addSessionsDay(contextOf(book), { ...makeUp, follows: 2, takes: [chosen] }));
  const [session] = sessionsBetween(contextOf(book), makeUp.day, makeUp.day);
  assert.equal(session?.groupId, chosen.includes('/g-1/') ? 'g-1' : 'g-2');
  assert.equal(session?.sessionType, 'td');
});

test('refuses a day outside the year, a day off, sessions off the timetable, a bad closure and a shared slot', async () => {
  const book = await openBook(cemEvents());
  const context = contextOf(book);
  const refused = (changes: Partial<AddedDay>, message: RegExp) =>
    assert.throws(() => addSessionsDay(context, { ...makeUp, ...changes }), message);
  refused({ schoolId: 's-none' }, /No such school/);
  refused({ adds: 'cover' as never }, /Unknown kind/);
  refused({ day: d('2027-07-03') }, /outside the school year/);
  refused({ follows: 5 }, /working day/);
  refused({ takes: [] }, /at least one/);
  refused({ takes: ['c-math/m1/g-all/every'] }, /not on that weekday/);
  refused({ adds: 'support' }, /Only a make-up day/);
  refused({ replaces: 'storm-elsewhere' }, /No such closure/);
  refused({ day: d('2026-11-14') }, /No such closure/);
  refused({ source: '  ' }, /one line/);
  refused({ follows: 2, takes: ['c-math/a1/g-1/A', 'c-math/a1/g-2/B'] }, /one slot/);
  assert.throws(() => addSessionsDay(context, { ...plain, day: d('2026-10-14') }), /one slot/);
  assert.doesNotThrow(() => addSessionsDay(context, { ...plain, day: d('2026-10-11') }));
  await book.record(d('2026-11-15'), addSessionsDay(context, makeUp));
  assert.deepEqual([...busySlots(contextOf(book), makeUp.day)], ['m3']);
  assert.deepEqual([...busySlots(contextOf(book), makeUp.day, 'add-1')], []);
  assert.doesNotThrow(() => addSessionsDay(contextOf(book), { ...makeUp, source: 'Corrected notice' }));
  assert.throws(() => addSessionsDay(contextOf(book), { ...makeUp, id: 'add-2' }), /one slot/);
});

test('support and revision days stay off the plan and go on the page for additional lessons', async () => {
  const book = await openBook(cemEvents());
  const sessionsBefore = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-12-17'));
  await book.recordAll(d('2026-10-20'), [
    addSessionsDay(contextOf(book), {
      ...plain,
      id: 'add-s',
      adds: 'support',
      day: d('2026-11-01'),
      follows: 0,
      takes: ['c-math/m1/g-all/every'],
    }),
    addSessionsDay(contextOf(book), {
      ...plain,
      id: 'add-r',
      adds: 'revision',
      day: d('2026-11-14'),
      follows: 4,
      takes: ['c-math/m1/g-all/every'],
    }),
  ]);
  assert.deepEqual(sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-12-17')), sessionsBefore);
  const rows = supportDayRows(contextOf(book), d('2026-09-20'), d('2027-06-10'), (session) =>
    session.slot.index === 1 ? { from: '08:00', to: '09:00' } : null,
  );
  assert.deepEqual(
    rows.map((row) => [row.kind, row.day, row.from]),
    [
      ['support', '2026-11-01', '08:00'],
      ['review', '2026-11-14', '08:00'],
    ],
  );
  assert.deepEqual(
    supervisedRows(book.state, 'k-1am2', '2026-2027', rows).map((row) => [row.number, row.kind]),
    [
      [1, 'support'],
      [2, 'review'],
    ],
  );
  assert.deepEqual([...busySlots(contextOf(book), d('2026-11-01'))], ['m1']);
});

test('a day taken back leaves the plan as it was, and the history keeps both', async () => {
  const book = await openBook(cemEvents());
  const sessionsBefore = sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-12-17'));
  const added = addSessionsDay(contextOf(book), makeUp);
  assert.equal(layerOf(added), 'lesson-record');
  await book.record(d('2026-11-15'), added);
  const removed = removeAddedDay(contextOf(book), 'add-1');
  assert.deepEqual(removed, { kind: 'calendar.removed', id: 'add-1', layer: 'school' });
  assert.equal(layerOf(removed), 'lesson-record');
  assert.equal(layerOf({ kind: 'calendar.removed', id: 'x', layer: 'teacher' }), 'private');
  await book.record(d('2026-11-16'), removed);
  assert.deepEqual(sessionsBetween(contextOf(book), d('2026-09-20'), d('2026-12-17')), sessionsBefore);
  assert.equal(book.entries.length - (await openBook(cemEvents())).entries.length, 2);
  assert.throws(() => removeAddedDay(contextOf(book), 'add-1'), /No such day/);
  assert.throws(() => removeAddedDay(contextOf(book), 'storm'), /No such day/);
  const store = new MemoryStore();
  for (const entry of book.entries) await store.append(JSON.parse(JSON.stringify(entry)) as typeof entry);
  assert.deepEqual((await RecordBook.open(store, deps)).state.calendar, book.state.calendar);
});

test('an A-week and a B-week session in one slot for one group are two choices', async () => {
  const book = await openBook(cemEvents());
  const [first] = cemEvents().flatMap((event) => (event.kind === 'timetable.set' ? [event.version] : []));
  assert.ok(first);
  const paired = (id: string, weeks: 'A' | 'B', sessionType: string) => ({
    id,
    weekday: 0 as const,
    slot: { half: 'afternoon' as const, index: 2 },
    courseId: 'c-math',
    groupId: 'g-all',
    weeks,
    sessionType,
  });
  await book.record(d('2026-11-15'), {
    kind: 'timetable.set',
    version: {
      ...first,
      id: 'v2',
      from: d('2026-11-15'),
      entries: [...first.entries, paired('e-a', 'A', 'lesson'), paired('e-b', 'B', 'td')],
    },
  });
  const sunday = followedEntries(contextOf(book), 's-cem', makeUp.day, 0);
  const takes = sunday.filter((one) => one.entry.slot.half === 'afternoon').map((one) => one.take);
  assert.deepEqual(takes, ['c-math/a2/g-all/A', 'c-math/a2/g-all/B']);
  await book.record(
    d('2026-11-15'),
    addSessionsDay(contextOf(book), { ...plain, follows: 0, takes: ['c-math/a2/g-all/B'] }),
  );
  const sessions = sessionsBetween(contextOf(book), makeUp.day, makeUp.day);
  assert.deepEqual(
    sessions.map((session) => [session.key, session.sessionType]),
    [['c-math/2026-11-21/a2/g-all', 'td']],
  );
});
