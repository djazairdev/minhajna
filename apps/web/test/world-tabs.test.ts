// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world on a PC beside the app's other tabs (#558, part 2, answer 569),
// on a made-up IndexedDB and a made-up local storage: a teacher's step asked
// before entering a world finishes, and one asked once it is entered is
// refused; a world another tab deletes refuses every call, the teacher's
// history staying shut until the world is left; a write another tab overtakes
// keeps nothing; erasing the PC deletes every world, found in the settings
// where the browser cannot list its databases, which enters no world when it
// cannot keep the list either, and waits for a tab that holds a world open. The
// worlds, passphrase and entries are made up.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { closeDatabase } from '../src/native/vault/database.ts';
import { databases, opened, put, raw } from './support/world-db.ts';

const kept = new Map<string, string>();
const local = {
  get length() {
    return kept.size;
  },
  key: (at: number) => [...kept.keys()][at] ?? null,
  getItem: (key: string) => kept.get(key) ?? null,
  setItem: (key: string, value: string) => void kept.set(key, value),
  removeItem: (key: string) => void kept.delete(key),
};
Object.assign(globalThis, { localStorage: local, sessionStorage: { ...local, setItem: () => undefined } });
const { default: Storage } = await import('../src/native/Storage.ts');
const { default: World } = await import('../src/native/World.ts');

const PASSPHRASE = 'chalk on the green board';
const WORLD = 'minhajna-world-7K3QX';

function entry(seq: number): string {
  return JSON.stringify({ seq, id: `w${seq}`, day: '2026-10-30', salt: 'aa', body: '{"note":"made-up"}' });
}

/** Has the next read of the world's end in `meta` run `meanwhile`, as another tab would. */
function onNextHeadRead(meanwhile: (head: unknown) => Promise<void>): () => void {
  const realGet = Reflect.get(IDBObjectStore.prototype, 'get');
  let done = false;
  IDBObjectStore.prototype.get = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['get']>) {
    const request = realGet.apply(this, args);
    if (!done && this.name === 'meta' && args[0] === 'head') {
      done = true;
      request.addEventListener('success', () => void meanwhile(request.result));
    }
    return request;
  };
  return () => {
    IDBObjectStore.prototype.get = realGet;
  };
}

beforeEach(async () => {
  await World.leaveWorld();
  await Storage.lockHistory();
  await closeDatabase();
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
  kept.clear();
  await Storage.createLock(PASSPHRASE);
});

describe('a demo world beside the app’s other tabs', () => {
  it('lets a teacher’s step asked before entering finish, and refuses one asked once entered', async () => {
    const before = Storage.appendEntry(JSON.stringify({ seq: 0, id: 't0', day: '2026-10-29', salt: 'b', body: '{}' }));
    await World.enterWorld('7K3QX');
    await before;
    await assert.rejects(Storage.loadHistory(), { code: 'E_WORLD' });
    assert.equal((await raw('minhajna', 'entries')).size, 1);
  });

  it('refuses every call in a world another tab deleted, and keeps the teacher’s history shut', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    await new Promise<void>((resolve) => {
      indexedDB.deleteDatabase(WORLD).onsuccess = () => resolve();
    });
    await assert.rejects(World.loadHistory(), { code: 'E_WORLD' });
    await assert.rejects(World.appendEntry(entry(1)), { code: 'E_WORLD' });
    await assert.rejects(Storage.lockStatus(), { code: 'E_WORLD' });
    await World.leaveWorld();
    await World.enterWorld('7K3QX');
    assert.equal(await World.loadHistory(), '[]');
  });

  it('keeps nothing when another tab changes the end or adds an entry between reading and writing', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    let restore = onNextHeadRead(async (head) => {
      const { data } = head as { data: ArrayBuffer };
      await put(WORLD, 'meta', 'head', { nonce: new Uint8Array(12).fill(7), data });
    });
    try {
      await assert.rejects(World.appendEntry(entry(1)), { code: 'E_WORLD', message: /another tab/u });
    } finally {
      restore();
    }
    assert.equal((await raw(WORLD, 'entries')).size, 1);

    await World.leaveWorld();
    await World.eraseWorld('7K3QX');
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    const row = (await raw(WORLD, 'entries')).get(0);
    restore = onNextHeadRead(() => put(WORLD, 'entries', 1, row));
    try {
      await assert.rejects(World.appendEntry(entry(1)), { code: 'E_WORLD', message: /another tab/u });
    } finally {
      restore();
    }
  });

  it('erases every world with the PC where the browser cannot list its databases', async () => {
    for (const world of ['7K3QX', 'M2ND9']) {
      await World.enterWorld(world);
      await World.leaveWorld();
    }
    assert.equal(kept.get('minhajna:worlds'), '7K3QX M2ND9');
    await World.eraseWorld('M2ND9');
    assert.equal(kept.get('minhajna:worlds'), '7K3QX');
    const listing = Reflect.get(indexedDB, 'databases');
    Object.assign(indexedDB, { databases: undefined });
    try {
      await Storage.eraseDevice();
    } finally {
      Object.assign(indexedDB, { databases: listing });
    }
    assert.deepEqual(await databases(), []);
    assert.equal(kept.size, 0);
  });

  it('enters no world where the browser can neither list its databases nor keep the list', async () => {
    kept.set('minhajna:worlds', 'not-a-world 7K3QX');
    const listing = Reflect.get(indexedDB, 'databases');
    const write = local.setItem;
    Object.assign(indexedDB, { databases: undefined });
    local.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      await assert.rejects(World.enterWorld('M2ND9'), { code: 'E_WORLD', message: /no list/u });
      assert.equal((await Storage.lockStatus()).state, 'locked');
    } finally {
      Object.assign(indexedDB, { databases: listing });
      local.setItem = write;
    }
    await World.enterWorld('M2ND9');
    assert.equal(kept.get('minhajna:worlds'), '7K3QX M2ND9');
  });

  it('waits for a tab that holds a world open, then deletes the world and the history', async (t) => {
    await World.enterWorld('7K3QX');
    await World.leaveWorld();
    const held = await opened(WORLD);
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const turn = () => new Promise((resolve) => setImmediate(resolve));
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
    assert.deepEqual(await databases(), ['minhajna', WORLD]);
    held.close();
    for (let at = 0; at < 100 && kept.size > 0; at += 1) await turn();
    assert.deepEqual(await databases(), []);
  });
});
