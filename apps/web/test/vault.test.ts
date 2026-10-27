// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC's vault (#250, part 2, answer 502), on a made-up IndexedDB: the
// passphrase sets, opens, locks and changes the history's key; wrong ones
// are counted and bring the phone's waits; rows are sealed, so nothing
// readable is kept, and a row changed, moved or dropped from the end
// refuses to open; erasing content seals everything under a new key; and
// each step, adding a copy taken back among them, is all or none. The
// passphrases and entries are made up.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { closeDatabase } from '../src/native/vault/database.ts';

const { default: Storage } = await import('../src/native/Storage.ts');

const PASSPHRASE = 'chalk on the green board';
const NEXT = 'another long passphrase';
const MARK = 'made-up-pupil-name';

function entry(seq: number, id = `e${seq}`): string {
  return JSON.stringify({ seq, id, day: '2026-10-26', salt: 'aa', body: JSON.stringify({ note: MARK }) });
}

function raw(store: string): Promise<{ keys: IDBValidKey[]; values: unknown[] }> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('minhajna');
    open.onsuccess = () => {
      const transaction = open.result.transaction(store, 'readonly');
      const keys = transaction.objectStore(store).getAllKeys();
      const values = transaction.objectStore(store).getAll();
      transaction.oncomplete = () => {
        open.result.close();
        resolve({ keys: keys.result, values: values.result });
      };
    };
    open.onerror = () => reject(open.error ?? new Error('open'));
  });
}

function put(store: string, value: unknown, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('minhajna');
    open.onsuccess = () => {
      const transaction = open.result.transaction(store, 'readwrite');
      if (value === undefined) transaction.objectStore(store).delete(key);
      else transaction.objectStore(store).put(value, key);
      transaction.oncomplete = () => {
        open.result.close();
        resolve();
      };
      transaction.onabort = () => reject(transaction.error ?? new Error('abort'));
    };
  });
}

/** Erases e0 while, as another tab would, a timings row is written just after the erase has read everything. */
async function eraseWhileAnotherTabWrites(timings: unknown) {
  const realGetAll = Reflect.get(IDBObjectStore.prototype, 'getAll');
  let swapped = false;
  IDBObjectStore.prototype.getAll = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['getAll']>) {
    const request = realGetAll.apply(this, args);
    if (!swapped && this.name === 'entries') {
      swapped = true;
      request.addEventListener('success', () => void put('timings', timings, 'all'));
    }
    return request;
  };
  try {
    await assert.rejects(Storage.eraseContent(['e0']), { code: 'E_HISTORY', message: /another tab/u });
  } finally {
    IDBObjectStore.prototype.getAll = realGetAll;
  }
}

let now = Date.UTC(2026, 9, 26, 8);
const realNow = Date.now;

beforeEach(async () => {
  await Storage.lockHistory();
  await closeDatabase();
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
  Date.now = () => now;
});

afterEach(() => {
  Date.now = realNow;
});

describe('the PC vault', () => {
  it('sets a passphrase of 12 characters or more, then opens, locks and opens again', async () => {
    assert.equal((await Storage.lockStatus()).state, 'setup');
    await assert.rejects(Storage.createLock('short words'), { code: 'E_PASSPHRASE' });
    await assert.rejects(Storage.openHistory(), { code: 'E_LOCKED' });
    await Storage.createLock(PASSPHRASE);
    await assert.rejects(Storage.createLock(NEXT));
    assert.equal((await Storage.lockStatus()).state, 'open');
    await Storage.openHistory();
    await Storage.appendEntry(entry(0));
    await Storage.appendEntry(entry(1));
    await assert.rejects(Storage.appendEntry(entry(1, 'again')));
    await Storage.lockHistory();
    assert.deepEqual(await Storage.lockStatus(), {
      state: 'locked',
      biometric: false,
      biometricAvailable: false,
      waitSeconds: 0,
      hasHistory: false,
    });
    await assert.rejects(Storage.loadHistory(), { code: 'E_LOCKED' });
    await assert.rejects(Storage.appendEntry(entry(2)), { code: 'E_LOCKED' });
    assert.deepEqual(await Storage.unlock('chalk on the green boar'), { opened: false, waitSeconds: 0 });
    assert.deepEqual(await Storage.unlock(PASSPHRASE.normalize('NFD')), { opened: true, waitSeconds: 0 });
    const rows = JSON.parse(await Storage.loadHistory()) as { seq: number; id: string }[];
    assert.deepEqual(
      rows.map(({ seq, id }) => [seq, id]),
      [
        [0, 'e0'],
        [1, 'e1'],
      ],
    );
  });

  it('keeps nothing readable, and refuses a row changed or moved on disk', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await Storage.appendEntry(entry(1));
    await Storage.addTimings(JSON.stringify([{ screen: MARK }]));
    for (const store of ['meta', 'entries', 'timings']) {
      const text = JSON.stringify((await raw(store)).values, (_, value: unknown) =>
        value instanceof ArrayBuffer || value instanceof Uint8Array
          ? Buffer.from(value as ArrayBuffer).toString()
          : value,
      );
      assert.ok(!text.includes(MARK) && !text.includes(PASSPHRASE), store);
    }
    const { values } = await raw('entries');
    await put('entries', values[1], 0);
    await assert.rejects(Storage.loadHistory(), { code: 'E_HISTORY' });
    const changed = values[0] as { nonce: Uint8Array; data: ArrayBuffer };
    const data = new Uint8Array(changed.data.slice(0));
    data[0] = (data[0] ?? 0) ^ 1;
    await put('entries', { nonce: changed.nonce, data: data.buffer }, 0);
    await assert.rejects(Storage.loadHistory(), { code: 'E_HISTORY' });
    await put('entries', values[0], 0);
    assert.equal((JSON.parse(await Storage.loadHistory()) as unknown[]).length, 2);
    await put('entries', undefined, 1);
    await assert.rejects(Storage.loadHistory(), { code: 'E_HISTORY' }, 'the last entry dropped');
    await put('entries', values[1], 1);
    await put('meta', undefined, 'head');
    await assert.rejects(Storage.loadHistory(), { code: 'E_HISTORY' }, 'the end dropped');
  });

  it('counts wrong passphrases as the phone counts wrong PINs, and waits without trying', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.lockHistory();
    for (let i = 1; i <= 4; i++)
      assert.deepEqual(await Storage.unlock(`wrong passphrase ${i}`), { opened: false, waitSeconds: 0 });
    assert.deepEqual(await Storage.unlock('wrong passphrase 5'), { opened: false, waitSeconds: 30 });
    assert.equal((await Storage.lockStatus()).waitSeconds, 30);
    now += 10_000;
    assert.deepEqual(await Storage.unlock(PASSPHRASE), { opened: false, waitSeconds: 20 });
    now -= 60_000;
    assert.equal((await Storage.lockStatus()).waitSeconds, 30, 'a clock moved back waits again in full');
    now += 30_000;
    assert.deepEqual(await Storage.unlock(PASSPHRASE), { opened: true, waitSeconds: 0 });
    await Storage.lockHistory();
    assert.deepEqual(await Storage.unlock('wrong passphrase 6'), { opened: false, waitSeconds: 0 });
  });

  it('changes the passphrase once the current one is right, keeping the history', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await assert.rejects(Storage.appendEntry(entry(0, 'again')), { code: 'E_HISTORY' });
    await Storage.lockHistory();
    await assert.rejects(Storage.changePin(PASSPHRASE, NEXT), { code: 'E_LOCKED' });
    await Storage.unlock(PASSPHRASE);
    await assert.rejects(Storage.changePin(PASSPHRASE, 'too short'), { code: 'E_PASSPHRASE' });
    assert.deepEqual(await Storage.changePin('not the passphrase', NEXT), { opened: false, waitSeconds: 0 });
    assert.deepEqual(await Storage.changePin(PASSPHRASE, NEXT), { opened: true, waitSeconds: 0 });
    await Storage.lockHistory();
    assert.equal((await Storage.unlock(PASSPHRASE)).opened, false);
    assert.equal((await Storage.unlock(NEXT)).opened, true);
    assert.equal((JSON.parse(await Storage.loadHistory()) as unknown[]).length, 1);
  });

  it('erases content under a new key, restores only into an empty history, and keeps timings', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.restoreHistory(JSON.stringify([0, 1, 2].map((seq) => JSON.parse(entry(seq)) as unknown)));
    await assert.rejects(Storage.restoreHistory(JSON.stringify([JSON.parse(entry(3)) as unknown])), {
      code: 'E_HISTORY',
    });
    await Storage.addTimings('[1]');
    const before = await raw('meta');
    await Storage.eraseContent(['nobody']);
    assert.deepEqual(await raw('meta'), before, 'nothing to erase changes nothing');
    await Storage.eraseContent(['e1']);
    const sealedKey = (meta: { keys: IDBValidKey[]; values: unknown[] }) =>
      Buffer.from((meta.values[meta.keys.indexOf('key')] as { sealed: ArrayBuffer }).sealed).toString('hex');
    assert.notEqual(sealedKey(await raw('meta')), sealedKey(before), 'a new key is sealed');
    await Storage.lockHistory();
    assert.equal((await Storage.unlock(PASSPHRASE)).opened, true);
    assert.equal(await Storage.loadTimings(), '[1]');
    await Storage.clearTimings();
    const rows = JSON.parse(await Storage.loadHistory()) as { id: string; salt: unknown; body: unknown }[];
    assert.deepEqual(
      rows.map(({ id, salt, body }) => [id, salt === null, body === null]),
      [
        ['e0', false, false],
        ['e1', true, true],
        ['e2', false, false],
      ],
    );
    await Storage.addTimings('[1,2]');
    assert.equal((await raw('timings')).keys.length, 1);
    await Storage.addTimings('[3]');
    assert.equal(await Storage.loadTimings(), '[1,2,3]');
    await Storage.clearTimings();
    assert.equal(await Storage.loadTimings(), '[]');
  });

  it('refuses every write once another tab has sealed the key again, keeping nothing', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    const meta = await raw('meta');
    const sealed = meta.values[meta.keys.indexOf('key')] as { nonce: Uint8Array };
    const nonce = new Uint8Array(sealed.nonce);
    nonce[0] = (nonce[0] ?? 0) ^ 1;
    await put('meta', { ...sealed, nonce }, 'key');
    const before = await raw('entries');
    await assert.rejects(Storage.appendEntry(entry(1)), { code: 'E_HISTORY', message: /another tab/u });
    await assert.rejects(Storage.addTimings('[1]'), { code: 'E_HISTORY', message: /another tab/u });
    await assert.rejects(Storage.eraseContent(['e0']), { code: 'E_HISTORY', message: /another tab/u });
    assert.deepEqual(await raw('entries'), before);
    assert.equal((await raw('timings')).keys.length, 0);
  });

  it('refuses an erase over timings another tab wrote between its reading and its writing', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await Storage.addTimings('[1]');
    const theirs = (await raw('timings')).values[0];
    await Storage.addTimings('[2]');
    const ours = (await raw('timings')).values[0];
    await eraseWhileAnotherTabWrites(theirs);
    await put('timings', ours, 'all');
    assert.equal(await Storage.loadTimings(), '[1,2]');
    assert.equal((JSON.parse(await Storage.loadHistory()) as { body: unknown }[])[0]?.body === null, false);
  });

  it('refuses an erase when another tab wrote the first timings in between', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await Storage.addTimings('[1]');
    const theirs = (await raw('timings')).values[0];
    await Storage.clearTimings();
    await eraseWhileAnotherTabWrites(theirs);
    assert.equal(await Storage.loadTimings(), '[1]');
    assert.equal((JSON.parse(await Storage.loadHistory()) as unknown[]).length, 1);
  });

  it('refuses a restore with a sequence number twice, keeping none of it', async () => {
    await Storage.createLock(PASSPHRASE);
    await assert.rejects(Storage.restoreHistory(JSON.stringify([JSON.parse(entry(0)), JSON.parse(entry(0, 'x'))])));
    assert.equal(await Storage.loadHistory(), '[]');
  });

  it('adds entries after the last all at once, or none of them', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    const list = (...rows: string[]) => `[${rows.join(',')}]`;
    await assert.rejects(Storage.appendEntries(list(entry(1), entry(3))), { code: 'E_HISTORY' });
    await assert.rejects(Storage.appendEntries(list(entry(0, 'x'), entry(1))), { code: 'E_HISTORY' });
    await assert.rejects(Storage.appendEntries('{}'), { code: 'E_HISTORY' });
    await assert.rejects(Storage.appendEntries(list(entry(2))), { code: 'E_HISTORY' });
    assert.equal((JSON.parse(await Storage.loadHistory()) as unknown[]).length, 1);
    await Storage.appendEntries(list(entry(1), entry(2)));
    await Storage.appendEntries('[]');
    const rows = JSON.parse(await Storage.loadHistory()) as { seq: number }[];
    assert.deepEqual(
      rows.map((row) => row.seq),
      [0, 1, 2],
    );
  });

  it('refuses a new passphrase over rows whose key is gone', async () => {
    await Storage.createLock(PASSPHRASE);
    await Storage.appendEntry(entry(0));
    await Storage.lockHistory();
    await put('meta', undefined, 'key');
    assert.equal((await Storage.lockStatus()).state, 'setup');
    await assert.rejects(Storage.createLock(NEXT), { code: 'E_KEY_LOST' });
  });
});
