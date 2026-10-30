// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's own history on a PC (#558, part 2, answer 569), on a
// made-up IndexedDB: each world keeps its records sealed in its own
// database under its own key, which the page cannot read back; while one
// is open, the teacher's history is shut and refuses every step, erasing
// the PC among them, and opens again only through its passphrase once the
// world is left; one world is open at a time; erasing content seals the
// world again under a new key; a row changed or a write from another tab is
// refused; and erasing a world or the PC deletes its database. The worlds,
// passphrase and entries are made up.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { closeDatabase } from '../src/native/vault/database.ts';
import { databases, put, raw, readable } from './support/world-db.ts';

Object.assign(globalThis, { localStorage: undefined, sessionStorage: undefined });
const { default: Storage } = await import('../src/native/Storage.ts');
const { default: World } = await import('../src/native/World.ts');

const PASSPHRASE = 'chalk on the green board';
const MARK = 'made-up-pupil-name';

function entry(seq: number, id = `w${seq}`): string {
  return JSON.stringify({ seq, id, day: '2026-10-30', salt: 'aa', body: JSON.stringify({ note: MARK }) });
}

beforeEach(async () => {
  await World.leaveWorld();
  await Storage.lockHistory();
  await closeDatabase();
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
  await Storage.createLock(PASSPHRASE);
  await Storage.appendEntry(JSON.stringify({ seq: 0, id: 't0', day: '2026-10-29', salt: 'bb', body: '{}' }));
});

describe('a demo world on a PC', () => {
  it('keeps its own sealed records while the teacher’s history is shut, then lets the passphrase open it', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    await World.appendEntry(entry(1));
    assert.deepEqual(
      (JSON.parse(await World.loadHistory()) as { id: string }[]).map((row) => row.id),
      ['w0', 'w1'],
    );
    for (const step of [
      Storage.loadHistory(),
      Storage.appendEntry(entry(1)),
      Storage.lockStatus(),
      Storage.unlock(PASSPHRASE),
      Storage.createLock(PASSPHRASE),
      Storage.eraseDevice(),
    ]) {
      await assert.rejects(step, { code: 'E_WORLD' });
    }
    assert.deepEqual(await databases(), ['minhajna', 'minhajna-world-7K3QX']);
    const meta = await raw('minhajna-world-7K3QX', 'meta');
    const { key } = meta.get('key') as { key: CryptoKey };
    assert.equal(key.extractable, false);
    assert.equal(readable((await raw('minhajna-world-7K3QX', 'entries')).values(), MARK), false);
    assert.equal((await raw('minhajna', 'entries')).size, 1);

    await World.leaveWorld();
    await assert.rejects(Storage.loadHistory(), { code: 'E_LOCKED' });
    assert.equal((await Storage.unlock(PASSPHRASE)).opened, true);
    assert.deepEqual(
      (JSON.parse(await Storage.loadHistory()) as { id: string }[]).map((row) => row.id),
      ['t0'],
    );
    await World.enterWorld('7K3QX');
    assert.equal((JSON.parse(await World.loadHistory()) as unknown[]).length, 2);
  });

  it('opens one world at a time, each apart, and refuses calls outside one', async () => {
    await assert.rejects(World.loadHistory(), { code: 'E_WORLD' });
    await assert.rejects(World.enterWorld('7k3qx'), { code: 'E_WORLD' });
    await assert.rejects(World.enterWorld('7K3QU'), { code: 'E_WORLD' });
    await World.enterWorld('7K3QX');
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    await assert.rejects(World.enterWorld('M2ND9'), { code: 'E_WORLD', message: /Another world/u });
    await World.leaveWorld();
    await World.enterWorld('M2ND9');
    assert.equal(await World.loadHistory(), '[]');
    await assert.rejects(World.appendEntry(entry(1)), { code: 'E_WORLD' });
    await assert.rejects(World.appendEntry('{'), { code: 'E_WORLD' });
    await World.appendEntry(entry(0));
    await assert.rejects(World.appendEntry(entry(0)), { code: 'E_WORLD', message: /already kept/u });
  });

  it('erases content under a new key, and refuses a row changed on disk', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    await World.appendEntry(entry(1));
    const before = (await raw('minhajna-world-7K3QX', 'meta')).get('key') as { stamp: string };
    await World.eraseContent(['w0']);
    const after = (await raw('minhajna-world-7K3QX', 'meta')).get('key') as { stamp: string };
    assert.notEqual(after.stamp, before.stamp);
    const rows = JSON.parse(await World.loadHistory()) as { id: string; body: unknown; salt: unknown }[];
    assert.deepEqual(
      rows.map(({ id, body, salt }) => [id, body === null, salt === null]),
      [
        ['w0', true, true],
        ['w1', false, false],
      ],
    );
    const entries = await raw('minhajna-world-7K3QX', 'entries');
    await put('minhajna-world-7K3QX', 'entries', 0, entries.get(1));
    await assert.rejects(World.loadHistory(), { code: 'E_WORLD' });
  });

  it('refuses a write when another tab sealed the world again in between', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    const realGet = Reflect.get(IDBObjectStore.prototype, 'get');
    let swapped = false;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['get']>) {
      const request = realGet.apply(this, args);
      if (!swapped && this.name === 'meta' && args[0] === 'key') {
        swapped = true;
        request.addEventListener('success', () => {
          const kept = request.result as { key: CryptoKey };
          void put('minhajna-world-7K3QX', 'meta', 'key', { key: kept.key, stamp: 'another-tab' });
        });
      }
      return request;
    };
    try {
      await assert.rejects(World.appendEntry(entry(1)), { code: 'E_WORLD', message: /another tab/u });
    } finally {
      IDBObjectStore.prototype.get = realGet;
    }
    assert.equal((JSON.parse(await World.loadHistory()) as unknown[]).length, 1);
  });

  it('refuses a world kept without its key, and leaves it', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    await World.leaveWorld();
    await put('minhajna-world-7K3QX', 'meta', 'key', undefined);
    await assert.rejects(World.enterWorld('7K3QX'), { code: 'E_KEY_LOST' });
    assert.equal((await Storage.lockStatus()).state, 'locked');
  });

  it('erases a world, and every world with the PC', async () => {
    await World.enterWorld('7K3QX');
    await World.appendEntry(entry(0));
    await World.eraseWorld('7K3QX');
    assert.deepEqual(await databases(), ['minhajna']);
    await assert.rejects(World.loadHistory(), { code: 'E_WORLD' });
    assert.equal((await Storage.lockStatus()).state, 'locked');
    for (const world of ['7K3QX', 'M2ND9']) {
      await World.enterWorld(world);
      await World.leaveWorld();
    }
    assert.deepEqual(await databases(), ['minhajna', 'minhajna-world-7K3QX', 'minhajna-world-M2ND9']);
    await Storage.eraseDevice();
    assert.deepEqual(await databases(), []);
  });
});
