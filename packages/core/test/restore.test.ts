// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A history restored from a Minhajna archive (#247, answer 478), from a
// made-up class with the teacher's personal fields and a private note: the
// entries as they were, an erasure on the day of the restore for each layer
// left out, a history that opens again, and an archive that does not hold
// refused.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ERASURE,
  HistoryError,
  HistoryLog,
  MemoryStore,
  archiveOf,
  archiveText,
  buildState,
  readArchive,
  restoredHistory,
  verifyHistory,
  type ArchiveOptions,
  type Entry,
} from '../src/index.ts';
import { cemEvents, d, languagePack, mathPack, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.5.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: false,
  bundledPacks: [languagePack, mathPack],
};
const DAY = d('2026-10-25');

async function opened(privateNotes: boolean, eraseDevice = false) {
  const book = await openBook(cemEvents());
  await book.record(d('2026-09-14'), {
    kind: 'teacher.personal.set',
    personal: { name: 'Made-up Teacher', signatureOn: false },
  });
  await book.record(d('2026-09-20'), {
    kind: 'session.noted',
    note: { sessionKey: 'made-up-session', note: 'Made-up private note' },
  });
  const device = book.entries.filter((entry) => entry.layer === 'device' && entry.content !== null);
  if (eraseDevice)
    await book.erase(
      d('2026-09-21'),
      device.map((entry) => entry.id),
    );
  const archive = archiveOf(book.entries, book.state, { ...options, privateNotes });
  const read = await readArchive(archiveText(archive), deps.digest);
  assert.ok(read.ok);
  return { book, read };
}

async function reopened(entries: readonly Entry[]): Promise<HistoryLog> {
  const store = new MemoryStore();
  for (const entry of entries) await store.append(entry);
  return HistoryLog.open(store, deps);
}

describe('a restored history', () => {
  it('keeps every entry, and erases what was left out, one layer at a time, on the day of the restore', async () => {
    const { book, read } = await opened(false);
    const restored = await restoredHistory(read, DAY, deps);
    assert.deepEqual(restored.slice(0, read.entries.length), read.entries);
    const erasures = restored.slice(read.entries.length);
    assert.deepEqual(
      erasures.map((entry) => [entry.kind, entry.layer, entry.day]),
      [
        [ERASURE, 'device', DAY],
        [ERASURE, 'private', DAY],
      ],
    );
    const named = erasures.flatMap((entry) => (entry.content!.body as { entries: string[] }).entries);
    assert.deepEqual([...named].sort(), [...read.archive.leftOut].sort());
    assert.deepEqual(await verifyHistory(deps.digest, restored), []);
    const log = await reopened(restored);
    const state = buildState(log.entries);
    assert.equal(state.classes.size, book.state.classes.size);
    assert.equal(state.pupils.size, book.state.pupils.size);
    assert.equal(state.personal, null);
  });

  it('carries the private notes when the archive holds them, and erases only the personal fields', async () => {
    const { read } = await opened(true);
    const restored = await restoredHistory(read, DAY, deps);
    assert.deepEqual(
      restored.slice(read.entries.length).map((entry) => entry.layer),
      ['device'],
    );
    const note = restored.find((entry) => entry.kind === 'session.noted')!;
    assert.deepEqual(note.content!.body, {
      kind: 'session.noted',
      note: { sessionKey: 'made-up-session', note: 'Made-up private note' },
    });
  });

  it('adds nothing when nothing was left out', async () => {
    const { read } = await opened(true, true);
    assert.deepEqual(read.archive.leftOut, []);
    assert.deepEqual(await restoredHistory(read, DAY, deps), read.entries);
  });

  it('refuses content missing without being left out, and a day that is not one', async () => {
    const { read } = await opened(false);
    const lying = { ...read, archive: { ...read.archive, leftOut: read.archive.leftOut.slice(1) } };
    await assert.rejects(restoredHistory(lying, DAY, deps), HistoryError);
    await assert.rejects(restoredHistory(read, '2026-10-25T08:00' as typeof DAY, deps), RangeError);
  });
});
