// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erasing the data of a pupil who left (#248, answer 473): only once the
// director confirmed the departure; every version of the pupil's own records
// goes; the roll calls and seating plans they shared with the class are
// restated without them, each version keeping its day and place; the
// history keeps one fact and verifies; the activity log shows one line; a
// second pupil's erasure restates what the first restated; and an erasure
// the app stopped in reads in order meanwhile and is finished when the
// history opens again, or when tried again. Made-up pupils only.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  activityLog,
  confirmDeparture,
  eventOf,
  leavePupil,
  MemoryStore,
  pupilEntries,
  RecordBook,
  restatements,
  rollCallUnits,
  setCapture,
  setMark,
  setObservation,
  takeRollCall,
  verifyHistory,
  withoutPupil,
  type Day,
  type HistoryStore,
  type RecordEvent,
  type SeatingPlan,
} from '../src/index.ts';
import { cemEvents, contextOf, d } from './fixtures.ts';
import { deps } from './support.ts';

const ERASED_ON = d('2026-10-15');

const plan = (seats: readonly string[]): RecordEvent => ({
  kind: 'seating.set',
  plan: {
    classId: 'k-1am2',
    groupId: 'g-all',
    rows: 2,
    columns: 3,
    seats: seats.map((pupilId, index) => ({ row: 1, column: index + 1, pupilId })),
  } satisfies SeatingPlan,
});

/** 1AM2 with two roll calls, each corrected, marks, taps, an observation, an appreciation and a seating plan. */
async function classWithRecords(store: HistoryStore = new MemoryStore()) {
  const book = await RecordBook.open(store, deps);
  await book.recordAll(d('2026-09-13'), cemEvents());
  const [sunday] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-20'), d('2026-09-20'));
  const [monday] = rollCallUnits(contextOf(book), 'k-1am2', d('2026-09-21'), d('2026-09-21'));
  assert.ok(sunday && monday);
  const take = (day: Day, unit: typeof sunday, absent: string[], late: string[], reason?: string) =>
    book.record(
      day,
      takeRollCall(
        contextOf(book),
        unit,
        { absent: absent.map((pupilId) => ({ pupilId, justified: pupilId === 'p02' })), late },
        reason,
      ),
    );
  await take(d('2026-09-20'), sunday, ['p01', 'p02'], ['p03']);
  await take(d('2026-09-23'), sunday, ['p02'], ['p03'], 'entry-error');
  await take(d('2026-09-21'), monday, [], ['p02']);
  await take(d('2026-09-22'), monday, [], [], 'arrived-late');
  const session = {
    key: 'c-math/2026-09-20/m1/g-all',
    courseId: 'c-math',
    groupId: 'g-all',
    day: d('2026-09-20'),
    slot: { half: 'morning', index: 1 },
  } as const;
  const exam = (pupilId: string) => ({ courseId: 'c-math', term: 1, target: { kind: 'exam' }, pupilId }) as const;
  await book.recordAll(d('2026-09-24'), [
    setMark(exam('p01'), 12, 20),
    setMark(exam('p02'), 14, 20),
    { kind: 'mark.corrected', fix: { mark: { ...exam('p02'), value: 15 }, before: 14, reason: 'sum-error' } },
    setCapture(session, 'p02', 'participation', 1),
    setObservation({ courseId: 'c-math', term: 1, pupilId: 'p02' }, 'acquired'),
    {
      kind: 'appreciation.set',
      appreciation: {
        courseId: 'c-math',
        term: 1,
        pupilId: 'p02',
        phrase: { id: 'a-1', text: 'عمل جيد', release: 'r1' },
      },
    },
    plan(['p02', 'p03']),
    plan(['p02', 'p03', 'p01']),
  ]);
  await book.record(d('2026-10-11'), leavePupil(contextOf(book), 'p02', d('2026-10-11'), 'transfer'));
  await book.record(d('2026-10-13'), confirmDeparture(contextOf(book), 'p02'));
  return { book, store, sunday, monday };
}

const logLines = (book: RecordBook) =>
  activityLog(book.entries).flatMap((day) => day.items.map((item) => ({ day: item.day, line: item.line })));

const pupilSeq = (book: RecordBook, pupilId: string) =>
  book.entries.find((entry) => {
    const event = eventOf(entry);
    return event?.kind === 'pupil.set' && event.pupil.id === pupilId;
  })?.seq;

describe('erasing the data of a pupil who left', () => {
  it('erases their own records, restates the shared ones, and keeps one fact and their place', async () => {
    const { book, store, sunday, monday } = await classWithRecords();
    const place = pupilSeq(book, 'p02');
    const order = book.state.rollCallOrders?.get(sunday.key);
    const fact = await book.erasePupil(ERASED_ON, 'p02');

    assert.doesNotMatch(JSON.stringify(book.entries), /p02|محمد الأمين|Mohamed/);
    assert.equal(book.state.pupils.has('p02'), false);
    assert.deepEqual(book.state.erasedPupils, [{ classId: 'k-1am2', place, day: ERASED_ON, left: d('2026-10-11') }]);
    const versions = book.state.rollCalls.get(sunday.key) ?? [];
    assert.deepEqual(
      versions.map((one) => [one.day, one.value.absent.map((absence) => absence.pupilId), one.value.late, one.reason]),
      [
        ['2026-09-20', ['p01'], ['p03'], undefined],
        ['2026-09-23', [], ['p03'], 'entry-error'],
      ],
    );
    assert.equal(book.state.rollCallOrders?.get(sunday.key), order);
    assert.deepEqual(
      book.state.rollCalls.get(monday.key)?.map((one) => [one.day, one.value.late]),
      [
        ['2026-09-21', []],
        ['2026-09-22', []],
      ],
    );
    assert.deepEqual(
      book.state.seating.get('k-1am2/g-all')?.seats.map((seat) => seat.pupilId),
      ['p03', 'p01'],
    );
    assert.deepEqual(
      [...book.state.marks.values()].map((mark) => [mark.pupilId, mark.value]),
      [['p01', 12]],
    );
    assert.deepEqual(
      [book.state.captures.size, book.state.observations.size, book.state.appreciations.size, book.state.markFixes],
      [0, 0, 0, []],
    );
    assert.deepEqual(eventOf(fact)?.kind, 'pupil.erased');
    assert.deepEqual(await verifyHistory(deps.digest, book.entries), []);

    const lines = logLines(book);
    assert.deepEqual(
      lines.filter((one) => one.line.kind === 'pupil-erased' || one.line.kind === 'erased'),
      [{ day: ERASED_ON, line: { kind: 'pupil-erased' } }],
    );
    const corrected = lines.flatMap((one) =>
      one.line.kind === 'roll-call-corrected' ? [[one.day, one.line.changes.map((change) => change.pupilId)]] : [],
    );
    assert.deepEqual(corrected, [['2026-09-23', ['p01']]]);

    const reopened = await RecordBook.open(store, deps);
    assert.deepEqual(reopened.entries.length, book.entries.length);
    assert.deepEqual(reopened.state.rollCalls, book.state.rollCalls);
  });

  it('refuses a pupil still on the list, a departure not confirmed, and an unknown pupil', async () => {
    const { book } = await classWithRecords();
    const count = book.entries.length;
    await assert.rejects(book.erasePupil(ERASED_ON, 'p01'), /confirmed/);
    await book.record(d('2026-10-12'), leavePupil(contextOf(book), 'p01', d('2026-10-12'), 'transfer'));
    await assert.rejects(book.erasePupil(ERASED_ON, 'p01'), /confirmed/);
    await assert.rejects(book.erasePupil(ERASED_ON, 'p99'), /Unknown pupil/);
    assert.equal(book.entries.length, count + 1);
  });

  it('erases a second pupil from what the first erasure restated, keeping every day and place', async () => {
    const { book, sunday } = await classWithRecords();
    await book.erasePupil(ERASED_ON, 'p02');
    await book.record(d('2026-10-16'), leavePupil(contextOf(book), 'p01', d('2026-10-16'), 'transfer'));
    await book.record(d('2026-10-17'), confirmDeparture(contextOf(book), 'p01'));
    await book.erasePupil(d('2026-10-18'), 'p01');

    assert.doesNotMatch(JSON.stringify(book.entries), /p01|p02|أمينة|Amina/);
    assert.deepEqual(
      book.state.rollCalls.get(sunday.key)?.map((one) => [one.day, one.value.absent, one.value.late]),
      [
        ['2026-09-20', [], ['p03']],
        ['2026-09-23', [], ['p03']],
      ],
    );
    assert.deepEqual(
      book.state.erasedPupils?.map((one) => one.day),
      [ERASED_ON, '2026-10-18'],
    );
    assert.deepEqual(
      book.state.seating.get('k-1am2/g-all')?.seats.map((seat) => seat.pupilId),
      ['p03'],
    );
    assert.deepEqual(
      logLines(book).flatMap((one) => (one.line.kind.endsWith('erased') ? [[one.day, one.line.kind]] : [])),
      [
        ['2026-10-18', 'pupil-erased'],
        [ERASED_ON, 'pupil-erased'],
      ],
    );
    assert.deepEqual(await verifyHistory(deps.digest, book.entries), []);
  });

  it('finishes an erasure the app stopped in when the history opens again', async () => {
    const { book, store, sunday } = await classWithRecords();
    const order = book.state.rollCallOrders?.get(sunday.key);
    const entries = pupilEntries(book.entries, restatements(book.entries), 'p02');
    await book.record(ERASED_ON, { kind: 'pupil.erased', erased: { classId: 'k-1am2', entries } });
    const [first] = book.state.rollCalls.get(sunday.key) ?? [];
    const original = book.entries.find((entry) => entry.id === first?.entry);
    const event = original === undefined ? null : eventOf(original);
    const restated = event === null || original === undefined ? null : withoutPupil(event, 'p02', original.id);
    assert.ok(restated);
    await book.record(ERASED_ON, restated);
    assert.deepEqual(
      book.state.rollCalls.get(sunday.key)?.map((one) => [one.day, one.reason]),
      [
        ['2026-09-20', undefined],
        ['2026-09-23', 'entry-error'],
      ],
    );
    assert.equal(book.state.rollCallOrders?.get(sunday.key), order);
    assert.equal(book.state.pupils.has('p02'), true);
    assert.deepEqual(book.state.erasedPupils, []);

    const reopened = await RecordBook.open(store, deps);
    assert.equal(reopened.state.pupils.has('p02'), false);
    assert.doesNotMatch(JSON.stringify(reopened.entries), /p02/);
    assert.deepEqual(
      reopened.state.rollCalls.get(sunday.key)?.map((one) => [one.day, one.value.late]),
      [
        ['2026-09-20', ['p03']],
        ['2026-09-23', ['p03']],
      ],
    );
    assert.equal(reopened.state.erasedPupils?.length, 1);
    assert.deepEqual(await verifyHistory(deps.digest, reopened.entries), []);
  });

  it('tried again after a failure, finishes the first fact with what came after it, not another', async () => {
    const kept = new MemoryStore();
    let failIn = -1;
    const flaky: HistoryStore = {
      load: () => kept.load(),
      eraseContent: (ids) => kept.eraseContent(ids),
      append: (entry) => {
        failIn -= 1;
        return failIn === 0 ? Promise.reject(new Error('Made-up failure')) : kept.append(entry);
      },
    };
    const { book, sunday } = await classWithRecords(flaky);
    const place = pupilSeq(book, 'p02');
    failIn = 2;
    await assert.rejects(book.erasePupil(ERASED_ON, 'p02'), /Made-up failure/);
    assert.equal(book.state.pupils.has('p02'), true);
    await book.recordAll(ERASED_ON, [
      takeRollCall(contextOf(book), sunday, { absent: [{ pupilId: 'p02', justified: false }], late: [] }, 'other'),
      setMark({ courseId: 'c-math', term: 1, target: { kind: 'exam' }, pupilId: 'p02' }, 16, 20),
    ]);
    await book.erasePupil(ERASED_ON, 'p02');
    assert.equal(book.entries.filter((entry) => entry.kind === 'pupil.erased').length, 1);
    assert.deepEqual(book.state.erasedPupils, [{ classId: 'k-1am2', place, day: ERASED_ON, left: d('2026-10-11') }]);
    assert.deepEqual(
      logLines(book).filter((one) => one.line.kind.endsWith('erased')),
      [{ day: ERASED_ON, line: { kind: 'pupil-erased' } }],
    );
    assert.doesNotMatch(JSON.stringify(book.entries), /p02/);
    assert.deepEqual(
      book.state.rollCalls.get(sunday.key)?.map((one) => [one.day, one.value.absent, one.value.late]),
      [
        ['2026-09-20', [{ pupilId: 'p01', justified: false }], ['p03']],
        ['2026-09-23', [], ['p03']],
        [ERASED_ON, [], []],
      ],
    );
    assert.deepEqual(await verifyHistory(deps.digest, book.entries), []);
  });

  it('takes no restatement of another kind of record or of another roll call', async () => {
    const { book, sunday, monday } = await classWithRecords();
    const [taken] = book.state.rollCalls.get(sunday.key) ?? [];
    const [other] = book.state.rollCalls.get(monday.key) ?? [];
    assert.ok(taken && other);
    await book.recordAll(ERASED_ON, [
      { ...plan(['p03']), restates: taken.entry } as RecordEvent,
      { kind: 'roll-call.taken', rollCall: other.value, restates: taken.entry },
    ]);
    assert.equal(restatements(book.entries).of.size, 0);
    assert.equal(book.state.rollCalls.get(sunday.key)?.length, 2);
  });
});
