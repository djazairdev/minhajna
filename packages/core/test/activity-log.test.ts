// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// «سجل النشاط» (#235, answer 425): a first record is not listed; a later
// version of a session lists the fields it changed and its reason, a
// withdrawal and a new record after it; a roll call's correction lists each
// pupil's marks, and a reason only as a known code; prints, outputs and
// signed files taken in; an erasure lists the kinds it removed while their
// versions go; newest day first, sorted when the phone's date goes back; and
// no line holds a name or text. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activityLog,
  changedFields,
  confirmSessions,
  rollCallUnits,
  sessionsBetween,
  takeRollCall,
  type Entry,
  type LogItem,
  type RecordBook,
  type RecordEvent,
  type SessionRecord,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';

/** Wednesday 30 September's math session, confirmed that day as done. */
async function withSession(): Promise<{ book: RecordBook; record: SessionRecord }> {
  const book = await openBook(cemEvents());
  const [session] = sessionsBetween(contextOf(book), d('2026-09-30'), d('2026-09-30'), new Set(['c-math']));
  assert.ok(session);
  const [event] = confirmSessions(contextOf(book), [{ session, details: {} }]);
  assert.ok(event?.kind === 'session.recorded');
  await book.record(d('2026-09-30'), event);
  return { book, record: event.record };
}

const items = (book: RecordBook): LogItem[] => activityLog(book.entries).flatMap((day) => day.items);

/** An entry as the log reads it; the log never checks hashes, which the history did when it opened. */
const entry = (seq: number, day: string, event: RecordEvent): Entry => ({
  id: `e${seq}`,
  seq,
  day: d(day),
  layer: 'private',
  kind: event.kind,
  digest: '',
  previous: '',
  hash: '',
  content: { salt: '', body: event },
});

test('a first record is not listed; a later version lists the fields it changed, with its reason', async () => {
  const { book, record } = await withSession();
  assert.deepEqual(items(book), []);
  await book.record(d('2026-09-30'), { kind: 'session.recorded', record });
  assert.deepEqual(items(book), []);
  const homework = { ...record, homework: { text: 'Made-up: exercise 4', due: d('2026-10-04') } };
  await book.record(d('2026-10-01'), { kind: 'session.recorded', record: homework, correction: 'added-later' });
  const later = { ...homework, homework: { text: 'Made-up: exercise 4', due: d('2026-10-05') } };
  await book.record(d('2026-10-02'), { kind: 'session.recorded', record: later });
  assert.deepEqual(
    items(book).map((item) => [item.day, item.category, item.line]),
    [
      ['2026-10-02', 'corrections', { kind: 'session-corrected', session: record.session, fields: ['due'] }],
      [
        '2026-10-01',
        'corrections',
        { kind: 'session-corrected', session: record.session, fields: ['homework', 'due'], reason: 'added-later' },
      ],
    ],
  );
  assert.doesNotMatch(JSON.stringify(activityLog(book.entries)), /exercise/);
});

test('every field a correction can change is named, in the texts book’s order', async () => {
  const { record } = await withSession();
  const changed: SessionRecord = {
    ...record,
    outcome: 'partial',
    coverage: [],
    unplanned: 'Made-up content',
    homework: { text: 'Made-up', due: d('2026-10-04') },
    test: 'made-up-test',
    factual: 'Made-up line',
    sessionType: 'made-up-type',
    makeUp: true,
    listItem: { id: 'item-1', finished: false },
  };
  assert.deepEqual(changedFields(record, changed), [
    'outcome',
    'coverage',
    'unplanned',
    'homework',
    'due',
    'test',
    'factual',
    'type',
    'make-up',
    'list-item',
  ]);
  assert.deepEqual(changedFields(record, { ...record }), []);
});

test('a withdrawal is listed, and so is the session recorded again after it, with no fields', async () => {
  const { book, record } = await withSession();
  await book.record(d('2026-10-02'), { kind: 'session.withdrawn', session: record.session });
  await book.record(d('2026-10-03'), { kind: 'session.recorded', record, correction: 'other' });
  assert.deepEqual(
    items(book).map((item) => item.line),
    [
      { kind: 'session-corrected', session: record.session, fields: [], reason: 'other' },
      { kind: 'session-withdrawn', session: record.session },
    ],
  );
});

test('a roll call’s correction lists each pupil’s marks and its reason, but not the first roll call', async () => {
  const book = await openBook(cemEvents());
  const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
  assert.ok(unit);
  const first = { absent: [{ pupilId: 'p01', justified: false }], late: ['p02'] };
  await book.record(d('2026-09-20'), takeRollCall(contextOf(book), unit, first));
  assert.deepEqual(items(book), []);
  const fixed = { absent: [{ pupilId: 'p03', justified: true }], late: ['p01', 'p02'] };
  await book.record(d('2026-09-23'), takeRollCall(contextOf(book), unit, fixed, 'arrived-late'));
  const [item] = items(book);
  assert.equal(item?.line.kind, 'roll-call-corrected');
  assert.deepEqual(item.line, {
    kind: 'roll-call-corrected',
    classId: 'k-1am2',
    groupId: unit.groupId,
    day: unit.day,
    half: unit.half,
    changes: [
      { pupilId: 'p01', from: 'unjustified', to: 'late' },
      { pupilId: 'p03', from: 'present', to: 'justified' },
    ],
    reason: 'arrived-late',
  });
  assert.doesNotMatch(JSON.stringify(activityLog(book.entries)), /أمينة|Amina/);
});

test('a reason that is not a known code never shows: an older or other device’s history may hold words', async () => {
  const book = await openBook(cemEvents());
  const [unit] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
  assert.ok(unit);
  await book.record(d('2026-09-20'), takeRollCall(contextOf(book), unit, { absent: [], late: [] }));
  const fixed = { absent: [], late: ['p01'] };
  await book.record(d('2026-09-21'), takeRollCall(contextOf(book), unit, fixed, 'Amina was on a made-up trip'));
  const { record } = await withSession();
  const words = { kind: 'session.recorded', record: { ...record, outcome: 'partial' }, correction: 'made-up words' };
  const log = activityLog([
    ...book.entries,
    entry(book.entries.length, '2026-09-30', { kind: 'session.recorded', record }),
    entry(book.entries.length + 1, '2026-10-01', words as unknown as RecordEvent),
  ]);
  const lines = log.flatMap((day) => day.items.map((item) => item.line));
  assert.deepEqual(
    lines.map((line) => [line.kind, 'reason' in line]),
    [
      ['session-corrected', false],
      ['roll-call-corrected', false],
    ],
  );
  assert.doesNotMatch(JSON.stringify(log), /Amina|made-up words/);
});

test('prints, outputs and signed files taken in are files; other changes are left out', () => {
  const output = { id: 'o1', document: 'journal', period: '2026-09', how: 'pdf' as const };
  const events = [
    { kind: 'setup.finished' },
    {
      kind: 'print.recorded',
      print: { id: 'p1', documents: [{ id: 'texts-book', from: '2026-09-01', to: '2026-09-07' }] },
    },
    { kind: 'output.recorded', output: { ...output, blank: false } },
    { kind: 'calendar.updated', applied: { update: { release: '2026.2' }, key: 'k', file: 'f' } },
    { kind: 'pack.added', added: { update: { pack: { id: 'made-up-pack', release: '2026.2' } }, key: 'k', file: 'f' } },
    { kind: 'layer.added', added: { layer: { title: 'Made-up layer' } } },
  ] as unknown as RecordEvent[];
  const log = activityLog(events.map((event, seq) => entry(seq, '2026-10-01', event)));
  assert.deepEqual(
    log.flatMap((day) => day.items.map((item) => [item.seq, item.category, item.line])),
    [
      [5, 'files', { kind: 'layer-added', title: 'Made-up layer' }],
      [4, 'files', { kind: 'pack-added', pack: 'made-up-pack', release: '2026.2' }],
      [3, 'files', { kind: 'calendar-update', release: '2026.2' }],
      [2, 'files', { kind: 'output', output: { ...output, blank: false } }],
      [1, 'files', { kind: 'printed', documents: ['texts-book'] }],
    ],
  );
});

test('an erasure lists the kinds it removed, and their versions go from the log', async () => {
  const { book, record } = await withSession();
  const corrected = await book.record(d('2026-10-01'), {
    kind: 'session.recorded',
    record: { ...record, outcome: 'partial' },
  });
  const note = await book.record(d('2026-10-01'), {
    kind: 'session.noted',
    note: { sessionKey: record.session.key, note: 'Made-up private note' },
  });
  await book.erase(d('2026-10-04'), [note.id]);
  const first = book.entries.find((one) => one.kind === 'session.recorded');
  assert.ok(first);
  await book.erase(d('2026-10-05'), [first.id, corrected.id]);
  assert.deepEqual(
    items(book).map((item) => [item.day, item.category, item.line]),
    [
      ['2026-10-05', 'erasures', { kind: 'erased', kinds: ['session.recorded'] }],
      ['2026-10-04', 'erasures', { kind: 'erased', kinds: ['session.noted'] }],
    ],
  );
});

test('days go newest first, sorted when the phone’s date goes back; a day’s changes newest first', () => {
  const print = (id: string) => ({ kind: 'print.recorded', print: { id, documents: [] } }) as RecordEvent;
  const log = activityLog([
    entry(0, '2026-10-03', print('a')),
    entry(1, '2026-10-01', print('b')),
    entry(2, '2026-10-03', print('c')),
    entry(3, '2026-10-02', print('d')),
  ]);
  assert.deepEqual(
    log.map((day) => [day.day, day.items.map((item) => item.seq)]),
    [
      ['2026-10-03', [2, 0]],
      ['2026-10-02', [3]],
      ['2026-10-01', [1]],
    ],
  );
});

test('past the trusted entries, a change shows as its kind and day only, and an unreadable row not at all', () => {
  const print = { kind: 'print.recorded', print: { id: 'a', documents: [] } } as RecordEvent;
  const unread = { ...entry(1, '2026-10-02', print), content: null };
  const log = activityLog([entry(0, '2026-10-01', print), unread, null, entry(3, '2026-10-03', print)], 1);
  assert.deepEqual(
    log.map((day) => day.items.map((item) => [item.seq, item.category, item.line])),
    [
      [[3, null, { kind: 'unverified', entryKind: 'print.recorded' }]],
      [[1, null, { kind: 'unverified', entryKind: 'print.recorded' }]],
      [[0, 'files', { kind: 'printed', documents: [] }]],
    ],
  );
});
