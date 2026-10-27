// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pilot's devices and backups (#247, answer 478), from a made-up class: the
// recovery key kept on the phone and never in an archive, a new sheet's earlier
// keys, the last backup, the changes since it and the first change, the
// reminder's day, and the log's lines.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RECOVERY_ALPHABET,
  activityLog,
  addDays,
  archiveOf,
  archiveText,
  backupReminderDay,
  deviceFacts,
  layerOf,
  type ArchiveOptions,
} from '../src/index.ts';
import { cemEvents, d, languagePack, mathPack, openBook } from './fixtures.ts';

const KEY = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'].join('');
const NEXT = RECOVERY_ALPHABET.slice(0, 24);
const options: ArchiveOptions = {
  made: d('2026-10-24'),
  app: '0.5.0',
  country: 'dz',
  calendarRelease: '2026.1',
  privateNotes: true,
  bundledPacks: [languagePack, mathPack],
};

describe('the devices and backups', () => {
  it('keeps nothing before the first sheet, and counts from the first change', async () => {
    const book = await openBook(cemEvents());
    assert.deepEqual(deviceFacts(book.entries), {
      recovery: null,
      earlierKeys: [],
      lastBackup: null,
      sinceBackup: book.entries.length,
      firstChange: book.entries[0]!.day,
      handedOver: null,
    });
    assert.equal(deviceFacts([]).firstChange, null);
  });

  it('keeps the key on the phone only, and the last backup', async () => {
    const book = await openBook(cemEvents());
    assert.equal(layerOf({ kind: 'recovery.set', recovery: { key: KEY } }), 'device');
    assert.equal(layerOf({ kind: 'backup.saved' }), 'device');
    await book.record(d('2026-10-20'), { kind: 'recovery.set', recovery: { key: KEY } });
    await book.record(d('2026-10-20'), { kind: 'backup.saved' });
    await book.record(d('2026-10-22'), { kind: 'backup.saved' });
    const facts = deviceFacts(book.entries);
    assert.deepEqual(facts.recovery, { key: KEY, day: d('2026-10-20') });
    assert.equal(facts.lastBackup, d('2026-10-22'));
    assert.equal(facts.sinceBackup, 0);
    await book.record(d('2026-10-23'), { kind: 'recovery.set', recovery: { key: NEXT } });
    await book.record(d('2026-10-23'), { kind: 'recovery.set', recovery: { key: KEY } });
    assert.equal(deviceFacts(book.entries).sinceBackup, 2);
    const archive = archiveOf(book.entries, book.state, options);
    assert.equal(archiveText(archive).includes(KEY), false);
    const device = book.entries.filter((entry) => entry.layer === 'device').map((entry) => entry.id);
    assert.ok(device.length >= 3);
    for (const id of device) assert.ok(archive.leftOut.includes(id));
  });

  it('names the earlier keys a new sheet erases, and none once they are erased', async () => {
    const book = await openBook(cemEvents());
    const first = await book.record(d('2026-10-20'), { kind: 'recovery.set', recovery: { key: KEY } });
    await book.record(d('2026-10-24'), { kind: 'recovery.set', recovery: { key: NEXT } });
    let facts = deviceFacts(book.entries);
    assert.deepEqual(facts.recovery, { key: NEXT, day: d('2026-10-24') });
    assert.deepEqual(facts.earlierKeys, [first.id]);
    await book.erase(d('2026-10-24'), facts.earlierKeys);
    facts = deviceFacts(book.entries);
    assert.deepEqual(facts.earlierKeys, []);
    assert.equal(facts.recovery?.key, NEXT);
  });

  it('ignores a key that is not one', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-10-20'), { kind: 'recovery.set', recovery: { key: 'k7qf 3m9t' } });
    assert.equal(deviceFacts(book.entries).recovery, null);
  });

  it('lists backups and sheets under the devices in the log, never the key', async () => {
    const book = await openBook(cemEvents());
    await book.record(d('2026-10-20'), { kind: 'recovery.set', recovery: { key: KEY } });
    await book.record(d('2026-10-20'), { kind: 'backup.saved' });
    const [day] = activityLog(book.entries);
    assert.equal(day?.day, d('2026-10-20'));
    assert.deepEqual(
      day?.items.map((item) => [item.category, item.line.kind]),
      [
        ['devices', 'backup-saved'],
        ['devices', 'recovery-set'],
      ],
    );
    assert.equal(JSON.stringify(day).includes(KEY), false);
  });

  it('reminds 30 days after the last backup or the first change, and not before the day put off to', async () => {
    const book = await openBook(cemEvents());
    const first = book.entries[0]!.day;
    assert.equal(backupReminderDay(deviceFacts([]), null), null);
    assert.equal(backupReminderDay(deviceFacts(book.entries), null), addDays(first, 30));
    await book.record(d('2026-10-20'), { kind: 'backup.saved' });
    const facts = deviceFacts(book.entries);
    assert.equal(backupReminderDay(facts, null), d('2026-11-19'));
    assert.equal(backupReminderDay(facts, d('2026-11-26')), d('2026-11-26'));
    assert.equal(backupReminderDay(facts, d('2026-10-27')), d('2026-11-19'));
  });
});
