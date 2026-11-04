// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MemoryStore,
  RecordBook,
  archiveOf,
  archiveText,
  backupReminderDay,
  deviceFacts,
  eventOf,
  readArchive,
  restoredHistory,
  verifyHistory,
} from '../src/index.ts';
import { cemEvents, d, languagePack, mathPack, openBook } from './fixtures.ts';
import { deps } from './support.ts';

const MADE = d('2026-10-20');
const RESTORED = d('2026-10-31');

async function source() {
  const book = await openBook(cemEvents());
  await book.record(MADE, { kind: 'session.noted', note: { sessionKey: 'invented', note: 'Private example' } });
  const archive = archiveOf(book.entries, book.state, {
    made: MADE,
    app: '0.6.2',
    country: 'dz',
    calendarRelease: '2026.1',
    privateNotes: false,
    bundledPacks: [mathPack, languagePack],
  });
  const opened = await readArchive(archiveText(archive), deps.digest);
  assert.ok(opened.ok);
  return { book, opened, last: book.entries.at(-1)!.hash };
}

test('a backup counts changes made while its file was saving, not just after its saved fact', async () => {
  const book = await openBook(cemEvents());
  const last = book.entries.at(-1)!.hash;
  await book.record(MADE, { kind: 'setup.finished' });
  await book.record(MADE, { kind: 'backup.saved', backup: { last, made: MADE } });
  assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  await book.record(RESTORED, { kind: 'setup.finished' });
  assert.equal(deviceFacts(book.entries).sinceCopy, 2);
});

test('a backup keeps the file creation day even when saving finishes on a later day', async () => {
  const book = await openBook(cemEvents());
  await book.record(RESTORED, {
    kind: 'backup.saved',
    backup: { last: book.entries.at(-1)!.hash, made: MADE },
  });
  assert.equal(deviceFacts(book.entries).lastBackup, RESTORED);
  assert.equal(deviceFacts(book.entries).backupMade, MADE);
  assert.equal(deviceFacts(book.entries).sinceCopy, 0);
});

test('old backup facts still read without rewriting the history', async () => {
  const book = await openBook(cemEvents());
  await book.record(MADE, { kind: 'backup.saved' });
  assert.equal(deviceFacts(book.entries).lastBackup, MADE);
  assert.equal(deviceFacts(book.entries).sinceCopy, 0);
});

test('an unknown or malformed backup boundary grants no coverage', async () => {
  for (const backup of [
    { last: 'f'.repeat(64), made: MADE },
    { last: '', made: MADE },
    { last: 42, made: MADE },
    { last: 'a'.repeat(64), made: '2026-10-20T12:00:00Z' },
    null,
  ]) {
    const book = await openBook(cemEvents());
    await book.record(MADE, { kind: 'backup.saved', backup: backup as never });
    const facts = deviceFacts(book.entries);
    assert.equal(facts.lastBackup, null);
    assert.equal(facts.sinceCopy, book.entries.length);
  }
  const book = await openBook(cemEvents());
  await book.record(MADE, {
    kind: 'backup.saved',
    backup: { last: book.entries.at(-1)!.hash, made: RESTORED },
  });
  assert.equal(deviceFacts(book.entries).lastBackup, null);
});

test('a restore atomically records its route, file day and covered last entry', async () => {
  const { opened, last } = await source();
  const entries = await restoredHistory(opened, RESTORED, deps, 'backup');
  assert.deepEqual(await verifyHistory(deps.digest, entries), []);
  assert.deepEqual(eventOf(entries.at(-1)!), {
    kind: 'copy.received',
    received: { from: 'backup', file: { made: MADE, last } },
  });
  assert.equal(entries.at(-1)!.layer, 'device');
  assert.equal(entries.at(-1)!.day, RESTORED);
  assert.deepEqual(deviceFacts(entries).restoredFile, { from: 'backup', day: MADE });
  assert.equal(backupReminderDay(deviceFacts(entries), null), d('2026-11-19'));
  assert.equal(backupReminderDay(deviceFacts(entries), d('2026-11-30')), d('2026-11-30'));
});

test('archive and backup restores count only changes after the atomic restore', async () => {
  for (const from of ['backup', 'archive'] as const) {
    const { opened } = await source();
    const entries = await restoredHistory(opened, RESTORED, deps, from);
    const store = new MemoryStore();
    for (const entry of entries) await store.append(entry);
    const book = await RecordBook.open(store, deps);
    assert.deepEqual(deviceFacts(book.entries).restoredFile, { from, day: MADE });
    await book.record(RESTORED, { kind: 'setup.finished' });
    const facts = deviceFacts(book.entries);
    assert.deepEqual(facts.restoredFile, { from, day: MADE });
    assert.deepEqual(facts.lastCopy, { from: from === 'backup' ? 'restored-backup' : 'archive', day: MADE });
    assert.equal(facts.sinceCopy, 1);
    await book.record(RESTORED, {
      kind: 'backup.saved',
      backup: { last: book.entries.at(-1)!.hash, made: RESTORED },
    });
    assert.equal(deviceFacts(book.entries).restoredFile, null);
    assert.equal(deviceFacts(book.entries).sinceCopy, 0);
  }
});

test('a transfer records its source but is not a backup and does not reset the reminder', async () => {
  const { opened } = await source();
  const entries = await restoredHistory(opened, RESTORED, deps, 'phone');
  const facts = deviceFacts(entries);
  assert.equal(facts.lastBackup, null);
  assert.deepEqual(facts.restoredFile, { from: 'phone', day: MADE });
  assert.deepEqual(facts.received, { from: 'phone', day: RESTORED });
  assert.equal(backupReminderDay(facts, null), backupReminderDay({ ...facts, restoredFile: null }, null));
  assert.equal(facts.lastCopy, null);
  assert.equal(facts.sinceCopy, 0);
});

test('a phone copy counts from its arrival until it goes and comes back', async () => {
  const { opened } = await source();
  const entries = await restoredHistory(opened, RESTORED, deps, 'phone');
  const store = new MemoryStore();
  for (const entry of entries) await store.append(entry);
  const book = await RecordBook.open(store, deps);
  const on = RESTORED;
  const note = { kind: 'session.noted', note: { sessionKey: 'made-up', note: 'Made up' } } as const;
  await book.record(on, note);
  assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  const last = book.entries.at(-1)!.hash;
  await book.record(on, { kind: 'handover.sent', handover: { last } });
  assert.deepEqual(deviceFacts(book.entries).lastCopy, { from: 'transfer', day: on });
  assert.equal(deviceFacts(book.entries).sinceCopy, 0);
  await book.record(on, { kind: 'handover.ended', handover: { how: 'taken' } });
  assert.equal(deviceFacts(book.entries).lastCopy, null);
  assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  await book.record(on, { kind: 'handover.sent', handover: { last: book.entries.at(-1)!.hash } });
  await book.record(on, { kind: 'handover.ended', handover: { how: 'back' } });
  const back = deviceFacts(book.entries);
  assert.equal(back.lastCopy, null);
  assert.deepEqual(back.received, { from: 'back', day: on });
  const copyMoves = ['copy.received', 'handover.sent', 'handover.ended'];
  assert.equal(back.sinceCopy, book.entries.filter((entry) => !copyMoves.includes(entry.kind)).length);
});

test('restore metadata stays on the device, outside the next archive', async () => {
  const { opened, book } = await source();
  const entries = await restoredHistory(opened, RESTORED, deps, 'backup');
  const text = archiveText(
    archiveOf(entries, book.state, {
      made: RESTORED,
      app: '0.6.2',
      country: 'dz',
      calendarRelease: '2026.1',
      privateNotes: false,
      bundledPacks: [mathPack, languagePack],
    }),
  );
  assert.equal(text.includes('"received"'), false);
  assert.equal(text.includes('"file"'), false);
});

test('legacy restore routes remain readable but cannot invent a covered file', async () => {
  const book = await openBook(cemEvents());
  await book.record(RESTORED, { kind: 'copy.received', received: { from: 'backup' } });
  assert.deepEqual(deviceFacts(book.entries).received, { from: 'backup', day: RESTORED });
  assert.equal(deviceFacts(book.entries).restoredFile, null);
});

test('malformed restore metadata preserves the route without claiming a recoverable file', async () => {
  for (const file of [
    { last: 'f'.repeat(64), made: MADE },
    { last: 'a'.repeat(64), made: '2026-02-30' },
    { last: null, made: MADE },
  ]) {
    const book = await openBook(cemEvents());
    await book.record(RESTORED, { kind: 'copy.received', received: { from: 'backup', file: file as never } });
    assert.equal(deviceFacts(book.entries).restoredFile, null);
  }
  const book = await openBook(cemEvents());
  const last = book.entries.at(-1)!.hash;
  await book.record(RESTORED, { kind: 'setup.finished' });
  await book.record(RESTORED, { kind: 'copy.received', received: { from: 'backup', file: { made: MADE, last } } });
  assert.equal(deviceFacts(book.entries).restoredFile, null);
});

test('a trusted restore boundary still counts when the source device was a day ahead', async () => {
  const { opened } = await source();
  const before = d('2026-10-19');
  const facts = deviceFacts(await restoredHistory(opened, before, deps, 'backup'));
  assert.deepEqual(facts.restoredFile, { from: 'backup', day: MADE });
  assert.equal(backupReminderDay(facts, null), d('2026-11-18'));
});
