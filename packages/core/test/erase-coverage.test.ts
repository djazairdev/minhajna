// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erasing a device after a confirmed direct transfer (#494): its exact
// boundary, later changes, an ended handover, backups before and after it,
// and invalid or erased confirmations. The backup reminder stays separate.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { backupReminderDay, deviceFacts, type RecordBook } from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';

async function change(book: RecordBook, id = 'made-up') {
  return book.record(d('2026-10-22'), { kind: 'session.noted', note: { sessionKey: id, note: 'Made-up note' } });
}

async function confirm(book: RecordBook, last = book.entries.at(-1)!.hash) {
  return book.record(d('2026-10-23'), { kind: 'handover.sent', handover: { last } });
}

describe('the copy counted before erasing', () => {
  it('counts every change before a backup or confirmed transfer', async () => {
    const book = await openBook(cemEvents());
    assert.equal(deviceFacts(book.entries).lastCopy, null);
    assert.equal(deviceFacts(book.entries).sinceCopy, book.entries.length);
    assert.equal(deviceFacts([]).sinceCopy, 0);
  });

  it('counts a confirmed transfer without calling it a backup or postponing its reminder', async () => {
    const book = await openBook(cemEvents());
    const before = deviceFacts(book.entries);
    await confirm(book);
    const facts = deviceFacts(book.entries);
    assert.deepEqual(facts.lastCopy, { from: 'transfer', day: d('2026-10-23') });
    assert.equal(facts.sinceCopy, 0);
    assert.equal(facts.lastBackup, null);
    assert.equal(facts.sinceBackup, before.sinceBackup + 1);
    assert.equal(backupReminderDay(facts, null), backupReminderDay(before, null));
    await change(book);
    assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  });

  it('keeps changes between making and confirming the file uncovered', async () => {
    const book = await openBook(cemEvents());
    const last = book.entries.at(-1)!.hash;
    await change(book);
    await confirm(book, last);
    assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  });

  it('keeps the reached copy after work is taken back here', async () => {
    for (const how of ['taken', 'back'] as const) {
      const book = await openBook(cemEvents());
      await confirm(book);
      await book.record(d('2026-10-24'), { kind: 'handover.ended', handover: { how } });
      await change(book);
      const facts = deviceFacts(book.entries);
      assert.equal(facts.handedOver, null);
      assert.deepEqual(facts.lastCopy, { from: 'transfer', day: d('2026-10-23') });
      assert.equal(facts.sinceCopy, 2);
    }
  });

  it('uses a later transfer after a backup, without resetting the backup facts', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-10-20'), { kind: 'backup.saved' });
    await change(book);
    const before = deviceFacts(book.entries);
    await confirm(book);
    const facts = deviceFacts(book.entries);
    assert.deepEqual(facts.lastCopy, { from: 'transfer', day: d('2026-10-23') });
    assert.equal(facts.sinceCopy, 0);
    assert.equal(facts.lastBackup, d('2026-10-20'));
    assert.equal(facts.sinceBackup, 2);
    assert.equal(backupReminderDay(facts, null), backupReminderDay(before, null));
  });

  it('uses a later backup after a transfer', async () => {
    const book = await openBook(cemEvents());
    await confirm(book);
    await book.record(d('2026-10-24'), { kind: 'backup.saved' });
    assert.deepEqual(deviceFacts(book.entries).lastCopy, { from: 'backup', day: d('2026-10-24') });
    assert.equal(deviceFacts(book.entries).sinceCopy, 0);
    await change(book);
    assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  });

  it('does not replace better coverage when an older file is confirmed later', async () => {
    const book = await openBook(cemEvents());
    const old = book.entries.at(-1)!.hash;
    await change(book);
    await book.record(d('2026-10-22'), { kind: 'backup.saved' });
    await confirm(book, old);
    assert.deepEqual(deviceFacts(book.entries).lastCopy, { from: 'backup', day: d('2026-10-22') });
    assert.equal(deviceFacts(book.entries).sinceCopy, 0);
    await change(book, 'later');
    assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  });

  it('uses history order for repeated transfers on the same day', async () => {
    const book = await openBook(cemEvents());
    await confirm(book);
    await change(book);
    await confirm(book);
    assert.equal(deviceFacts(book.entries).sinceCopy, 0);
    await change(book, 'later');
    assert.equal(deviceFacts(book.entries).sinceCopy, 1);
  });

  it('retains a newer transfer when an older file or an invalid confirmation follows', async () => {
    const book = await openBook(cemEvents());
    const old = book.entries.at(-1)!.hash;
    await change(book);
    await confirm(book);
    await change(book, 'later');
    await book.record(d('2026-10-24'), { kind: 'handover.sent', handover: { last: old } });
    assert.deepEqual(deviceFacts(book.entries).lastCopy, { from: 'transfer', day: d('2026-10-23') });
    assert.equal(deviceFacts(book.entries).sinceCopy, 1);
    await confirm(book, 'a'.repeat(64));
    assert.deepEqual(deviceFacts(book.entries).lastCopy, { from: 'transfer', day: d('2026-10-23') });
    assert.equal(deviceFacts(book.entries).sinceCopy, 2);
  });

  it('grants no coverage for a malformed, unknown, future or erased confirmation', async () => {
    for (const last of ['', 'made-up', 'a'.repeat(64)]) {
      const book = await openBook(cemEvents());
      await confirm(book, last);
      assert.equal(deviceFacts(book.entries).lastCopy, null);
      assert.equal(deviceFacts(book.entries).sinceCopy, book.entries.length);
    }
    const book = await openBook(cemEvents());
    const sent = await confirm(book);
    const future = await change(book);
    const altered = book.entries.map((entry) =>
      entry.id === sent.id
        ? { ...entry, content: { ...entry.content!, body: { kind: 'handover.sent', handover: { last: future.hash } } } }
        : entry,
    );
    assert.equal(deviceFacts(altered).lastCopy, null);
    assert.equal(deviceFacts(altered).sinceCopy, altered.length);
    await book.erase(d('2026-10-24'), [sent.id]);
    assert.equal(deviceFacts(book.entries).lastCopy, null);
    assert.equal(deviceFacts(book.entries).sinceCopy, book.entries.length);
  });
});
