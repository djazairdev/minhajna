// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the teacher has printed (#215, R-3.8-55): each print of the week's
// set is kept in the history with its documents and the days each covered;
// a document's last print and the last day printed, never moved back by a
// reprint, nor counted beyond the day of a print made ahead; and the record
// stays with the teacher. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MemoryStore,
  RecordBook,
  buildState,
  forRoute,
  lastPrinted,
  printedTo,
  layerOf,
  recordsForRoute,
  type RecordEvent,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const print = (id: string, ...documents: [string, string, string][]): RecordEvent => ({
  kind: 'print.recorded',
  print: { id, documents: documents.map(([doc, from, to]) => ({ id: doc, from: d(from), to: d(to) })) },
});

test('a history starts with nothing printed', async () => {
  const book = await openBook(cemEvents());
  assert.deepEqual(book.state.prints, []);
  assert.equal(lastPrinted(book.state, 'journal'), null);
  assert.deepEqual(buildState([]).prints, []);
});

test('each print keeps its documents and days, and a reprint of older days never moves the last day back', async () => {
  const book = await openBook(cemEvents());
  await book.record(
    d('2026-10-08'),
    print('p-1', ['journal', '2026-10-04', '2026-10-08'], ['roll', '2026-10-01', '2026-10-31']),
  );
  await book.record(d('2026-10-15'), print('p-2', ['journal', '2026-10-11', '2026-10-15']));
  await book.record(d('2026-10-16'), print('p-3', ['journal', '2026-10-04', '2026-10-05']));
  assert.equal(book.state.prints.length, 3);
  assert.deepEqual(lastPrinted(book.state, 'journal'), {
    day: d('2026-10-16'),
    through: d('2026-10-15'),
    reached: d('2026-10-15'),
  });
  assert.deepEqual(lastPrinted(book.state, 'roll'), {
    day: d('2026-10-08'),
    through: d('2026-10-08'),
    reached: d('2026-10-31'),
  });
  assert.equal(lastPrinted(book.state, 'texts'), null);
  const store = new MemoryStore();
  for (const entry of book.entries) await store.append(JSON.parse(JSON.stringify(entry)) as typeof entry);
  const reopened = await RecordBook.open(store, deps);
  assert.deepEqual(lastPrinted(reopened.state, 'journal'), {
    day: d('2026-10-16'),
    through: d('2026-10-15'),
    reached: d('2026-10-15'),
  });
});

test('whether a print held a document up to exactly a day', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-20'), print('p-1', ['timetable', '2026-10-25', '2026-10-25']));
  assert.equal(printedTo(book.state, 'timetable', d('2026-10-25')), true);
  assert.equal(printedTo(book.state, 'timetable', d('2026-10-21')), false);
  assert.equal(printedTo(book.state, 'journal', d('2026-10-25')), false);
});

test('a print made ahead counts only up to its own day', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-23'), print('p-1', ['journal', '2026-10-20', '2027-06-30']));
  assert.deepEqual(lastPrinted(book.state, 'journal'), {
    day: d('2026-10-23'),
    through: d('2026-10-23'),
    reached: d('2027-06-30'),
  });
  await book.record(d('2026-11-05'), print('p-2', ['journal', '2026-10-24', '2026-11-05']));
  assert.deepEqual(lastPrinted(book.state, 'journal'), {
    day: d('2026-11-05'),
    through: d('2026-11-05'),
    reached: d('2027-06-30'),
  });
});

test('the record stays with the teacher', async () => {
  const book = await openBook(cemEvents());
  const event = print('p-1', ['journal', '2026-10-04', '2026-10-08']);
  await book.record(d('2026-10-08'), event);
  assert.equal(layerOf(event), 'private');
  const entry = book.entries.at(-1)!;
  assert.ok(forRoute(book.entries, 'own-devices').includes(entry));
  assert.ok(forRoute(book.entries, 'full-export').includes(entry));
  for (const route of ['documents', 'statement', 'handover', 'handover-direct', 'school-space'] as const) {
    assert.equal(
      recordsForRoute(book.state, route).some((record) => record.kind === 'print.recorded'),
      false,
      route,
    );
  }
});
