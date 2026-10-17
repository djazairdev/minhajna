// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Finishing setup is recorded once in the history (#183), so the app opens
// on Today after a restart, an update or a restore. The fact is private: it
// goes to the teacher's own devices and full export, never out.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MemoryStore, RecordBook, buildState, forRoute, layerOf, recordsForRoute } from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { deps } from './support.ts';

test('a history starts with setup not finished, even with classes and a week', async () => {
  const book = await openBook(cemEvents());
  assert.equal(book.state.setupFinished, false);
  assert.equal(buildState([]).setupFinished, false);
});

test('finishing setup is kept in the history, and survives reopening', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-09-13'), { kind: 'setup.finished' });
  await book.record(d('2026-09-14'), { kind: 'setup.finished' });
  assert.equal(book.state.setupFinished, true);
  const store = new MemoryStore();
  for (const entry of book.entries) await store.append(JSON.parse(JSON.stringify(entry)) as typeof entry);
  assert.equal((await RecordBook.open(store, deps)).state.setupFinished, true);
});

test('the fact stays with the teacher', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-09-13'), { kind: 'setup.finished' });
  assert.equal(layerOf({ kind: 'setup.finished' }), 'private');
  const entry = book.entries.at(-1)!;
  assert.ok(forRoute(book.entries, 'own-devices').includes(entry));
  assert.ok(forRoute(book.entries, 'full-export').includes(entry));
  for (const route of ['documents', 'statement', 'handover', 'school-space'] as const) {
    assert.equal(
      recordsForRoute(book.state, route).some((record) => record.kind === 'setup.finished'),
      false,
      route,
    );
  }
});
