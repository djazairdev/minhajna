// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Erasing this PC (#250, Web-erase, answers 518 to 520), on a made-up
// IndexedDB and made-up browser storages: the database goes whole, with the
// history, the timings and the signing pair, whether the history is open or
// locked; every setting under the app's prefix goes, and nothing else the
// browser keeps; the history's key is forgotten at once, so nothing more is
// read or written; the PC then starts as at first; and the tab that erased
// keeps a mark for itself, read once. Another tab that keeps the database
// open makes the erase answer that it waits, with the settings kept, and the
// erase finishes once that tab lets go. The passphrases and entries are made
// up.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { closeDatabase } from '../src/native/vault/database.ts';

/** A made-up browser storage with the parts the app uses. */
function store() {
  const kept = new Map<string, string>();
  return {
    kept,
    get length() {
      return kept.size;
    },
    key: (at: number) => [...kept.keys()][at] ?? null,
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
}

const local = store();
const session = store();
Object.assign(globalThis, { localStorage: local, sessionStorage: session });

const { default: Storage } = await import('../src/native/Storage.ts');
const { takeErased } = await import('../src/native/web-settings.ts');

const PASSPHRASE = 'chalk on the green board';

function entry(seq: number): string {
  return JSON.stringify({ seq, id: `e${seq}`, day: '2026-10-28', salt: 'aa', body: '{"note":"made-up"}' });
}

async function databases(): Promise<string[]> {
  return (await indexedDB.databases()).map((database) => database.name ?? '');
}

beforeEach(async () => {
  await Storage.lockHistory();
  await closeDatabase();
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
  local.kept.clear();
  session.kept.clear();
});

describe('erasing this PC', () => {
  it('deletes the database and the app’s settings while open, and the PC starts as at first', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await Storage.addTimings(JSON.stringify([{ screen: 'today' }]));
    local.setItem('minhajna:language', 'fr');
    local.setItem('minhajna:setting:today', '{}');
    local.setItem('another-site-key', 'kept');
    assert.deepEqual(await databases(), ['minhajna']);
    await Storage.eraseDevice();
    assert.deepEqual(await databases(), []);
    assert.deepEqual([...local.kept.keys()], ['another-site-key']);
    await assert.rejects(Storage.loadHistory(), { code: 'E_LOCKED' });
    await assert.rejects(Storage.appendEntry(entry(1)), { code: 'E_LOCKED' });
    assert.equal((await Storage.lockStatus()).state, 'setup');
    assert.equal(takeErased(), true);
    assert.equal(takeErased(), false);
    await Storage.createLock(PASSPHRASE);
    assert.equal(await Storage.loadHistory(), '[]');
  });

  it('erases a locked PC, whose passphrase then opens nothing', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await Storage.lockHistory();
    await Storage.eraseDevice();
    assert.deepEqual(await databases(), []);
    assert.equal((await Storage.lockStatus()).state, 'setup');
    await assert.rejects(Storage.unlock(PASSPHRASE), { message: 'No passphrase is set' });
    assert.equal(takeErased(), true);
  });

  it('says it waits while another tab keeps the database open, then finishes once that tab lets go', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const turn = () => new Promise((resolve) => setImmediate(resolve));
    await Storage.createLock(PASSPHRASE);
    local.setItem('minhajna:language', 'fr');
    const held = await new Promise<IDBDatabase>((resolve) => {
      const open = indexedDB.open('minhajna');
      open.onsuccess = () => resolve(open.result);
    });
    let failed: (Error & { code?: string }) | undefined;
    const erasing = Storage.eraseDevice().catch((error: unknown) => {
      failed = error as Error & { code?: string };
    });
    for (let at = 0; at < 100 && failed === undefined; at += 1) {
      await turn();
      t.mock.timers.tick(1000);
    }
    await erasing;
    assert.equal(failed?.code, 'E_ERASE_WAITS');
    assert.deepEqual([...local.kept.keys()], ['minhajna:language']);
    assert.equal(takeErased(), false);
    held.close();
    for (let at = 0; at < 100 && local.kept.size > 0; at += 1) await turn();
    assert.deepEqual(await databases(), []);
    assert.equal(local.kept.size, 0);
    assert.equal(takeErased(), true);
    await assert.rejects(Storage.openHistory(), { code: 'E_LOCKED' });
  });
});
