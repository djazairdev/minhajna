// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The signature module on a PC (#250, part 3, answers 508 and 510), on a
// made-up IndexedDB: the PC's own pair is made once, sealed under the
// passphrase with the history, and signs only while the history is open;
// it survives locking and erasing content; what it signs checks with the
// phone's DER form both ways; anything malformed, on another curve or
// changed does not check; and its QR codes carry the text in UTF-8 with the
// quiet zone the phone draws. The payloads and passphrase are made up.

import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { closeDatabase, transact } from '../src/native/vault/database.ts';
import { isSealed } from '../src/native/vault/seal.ts';
import { decoded } from './support/qr-read.ts';

const { default: Signature } = await import('../src/native/Signature.ts');
const { default: Storage } = await import('../src/native/Storage.ts');

const PASSPHRASE = 'chalk on the green board';

const PAYLOAD = 'statement:made-up-teacher:\u0645\u0639\u0644\u0645';

function phonePair(curve = 'prime256v1') {
  const pair = generateKeyPairSync('ec', { namedCurve: curve });
  return { ...pair, spki: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
}

function keptSigning(): Promise<unknown> {
  return transact(['meta'], 'readonly', (transaction) => {
    const read = transaction.objectStore('meta').get('signing');
    return () => read.result as unknown;
  });
}

function putSigning(row: unknown): Promise<void> {
  return transact(['meta'], 'readwrite', (transaction) => {
    transaction.objectStore('meta').put(row, 'signing');
    return () => undefined;
  });
}

beforeEach(async () => {
  await Storage.createLock(PASSPHRASE);
});
afterEach(async () => {
  await Storage.lockHistory();
  await closeDatabase();
  Object.assign(globalThis, { indexedDB: new IDBFactory() });
});

describe('the signature module on a PC', () => {
  it('makes one pair, sealed under the passphrase, and shows its key and fingerprint', async () => {
    const key = await Signature.teacherKey();
    assert.equal(await Signature.teacherKey(), key);
    const kept = await keptSigning();
    assert.ok(isSealed(kept));
    assert.ok(!new TextDecoder('latin1').decode(kept.data).includes('pkcs8'));
    const bytes = Buffer.from(key, 'base64');
    assert.equal(
      createPublicKey({ key: bytes, format: 'der', type: 'spki' }).asymmetricKeyDetails?.namedCurve,
      'prime256v1',
    );
    assert.equal(await Signature.keyFingerprint(key), createHash('sha256').update(bytes).digest('hex'));
    await assert.rejects(Signature.keyFingerprint('not base64!'), { code: 'E_SIGNING' });
    await assert.rejects(Signature.keyFingerprint(''), { code: 'E_SIGNING' });
  });

  it('signs only while the history is open, with the same pair after locking and erasing content', async () => {
    const key = await Signature.teacherKey();
    await Storage.appendEntry(JSON.stringify({ seq: 0, id: 'e0', day: '2026-10-27', salt: 'aa', body: '{}' }));
    await Storage.lockHistory();
    await assert.rejects(Signature.sign(PAYLOAD), { code: 'E_LOCKED' });
    await assert.rejects(Signature.teacherKey(), { code: 'E_LOCKED' });
    assert.deepEqual(await Storage.unlock(PASSPHRASE), { opened: true, waitSeconds: 0 });
    const before = await keptSigning();
    await Storage.eraseContent(['e0']);
    assert.notDeepEqual(await keptSigning(), before);
    assert.equal(await Signature.teacherKey(), key);
    assert.ok(await Signature.verify(key, PAYLOAD, await Signature.sign(PAYLOAD)));
  });

  it('refuses a pair changed on disk once it is opened again, rather than making another', async () => {
    await Signature.teacherKey();
    const kept = await keptSigning();
    assert.ok(isSealed(kept));
    const data = new Uint8Array(kept.data.slice(0));
    data[0] = (data[0] ?? 0) ^ 1;
    await putSigning({ nonce: kept.nonce, data: data.buffer });
    await Storage.lockHistory();
    assert.deepEqual(await Storage.unlock(PASSPHRASE), { opened: true, waitSeconds: 0 });
    await assert.rejects(Signature.teacherKey(), { code: 'E_SIGNING' });
    await assert.rejects(Signature.sign(PAYLOAD), { code: 'E_SIGNING' });
  });

  it("uses another tab's pair when both make one at once", async () => {
    const key = await Signature.teacherKey();
    const theirs = await keptSigning();
    await transact(['meta'], 'readwrite', (transaction) => {
      transaction.objectStore('meta').delete('signing');
      return () => undefined;
    });
    await Storage.lockHistory();
    assert.deepEqual(await Storage.unlock(PASSPHRASE), { opened: true, waitSeconds: 0 });
    const realAdd = Reflect.get(IDBObjectStore.prototype, 'add');
    IDBObjectStore.prototype.add = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      if (args[1] === 'signing') this.put(theirs, 'signing');
      return realAdd.apply(this, args);
    };
    try {
      assert.equal(await Signature.teacherKey(), key);
    } finally {
      IDBObjectStore.prototype.add = realAdd;
    }
    assert.ok(await Signature.verify(key, PAYLOAD, await Signature.sign(PAYLOAD)));
  });

  it('refuses to erase content when another tab made the pair in between', async () => {
    await Storage.appendEntry(JSON.stringify({ seq: 0, id: 'e0', day: '2026-10-27', salt: 'aa', body: '{}' }));
    const realGet = Reflect.get(IDBObjectStore.prototype, 'get');
    let swapped = false;
    IDBObjectStore.prototype.get = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['get']>) {
      const request = realGet.apply(this, args);
      if (!swapped && this.name === 'meta' && args[0] === 'signing') {
        swapped = true;
        const row = { nonce: crypto.getRandomValues(new Uint8Array(12)), data: new ArrayBuffer(64) };
        request.addEventListener('success', () => void putSigning(row));
      }
      return request;
    };
    try {
      await assert.rejects(Storage.eraseContent(['e0']), { code: 'E_HISTORY', message: /another tab/u });
    } finally {
      IDBObjectStore.prototype.get = realGet;
    }
  });

  it("checks with the phone's DER signatures both ways", async () => {
    const signed = await Signature.sign(PAYLOAD);
    const key = createPublicKey({
      key: Buffer.from(await Signature.teacherKey(), 'base64'),
      format: 'der',
      type: 'spki',
    });
    assert.ok(verify('sha256', Buffer.from(PAYLOAD), key, Buffer.from(signed, 'base64')));
    assert.ok(await Signature.verify(await Signature.teacherKey(), PAYLOAD, signed));
    const phone = phonePair();
    const der = sign('sha256', Buffer.from(PAYLOAD), phone.privateKey).toString('base64');
    assert.ok(await Signature.verify(phone.spki, PAYLOAD, der));
    assert.equal(await Signature.verify(phone.spki, `${PAYLOAD}.`, der), false);
    assert.equal(await Signature.verify(phonePair().spki, PAYLOAD, der), false);
  });

  it('finds anything malformed or on another curve a signature that does not check', async () => {
    const phone = phonePair();
    const der = sign('sha256', Buffer.from(PAYLOAD), phone.privateKey);
    const padded = Buffer.concat([der, Buffer.from([0])]).toString('base64');
    const raw = sign('sha256', Buffer.from(PAYLOAD), { key: phone.privateKey, dsaEncoding: 'ieee-p1363' });
    const other = phonePair('secp384r1');
    const checks: [string, string, string][] = [
      [phone.spki, PAYLOAD, padded],
      [phone.spki, PAYLOAD, raw.toString('base64')],
      [phone.spki, PAYLOAD, `${der.toString('base64')}!`],
      [phone.spki, PAYLOAD, ''],
      [phone.spki, '\ud800', der.toString('base64')],
      ['', PAYLOAD, der.toString('base64')],
      ['A'.repeat(201), PAYLOAD, der.toString('base64')],
      [other.spki, PAYLOAD, sign('sha384', Buffer.from(PAYLOAD), other.privateKey).toString('base64')],
    ];
    for (const [spki, payload, signature] of checks) {
      assert.equal(await Signature.verify(spki, payload, signature), false);
    }
  });

  it('refuses to sign empty, broken or too long text', async () => {
    for (const payload of ['', '\ud800', 'a'.repeat(65_537), '\u0645'.repeat(40_000)]) {
      await assert.rejects(Signature.sign(payload), { code: 'E_SIGNING' });
    }
  });

  it("draws a statement's code in UTF-8 with its four-cell quiet zone, up to 996 bytes in version 25", async () => {
    const small = await Signature.qrMatrix(PAYLOAD);
    assert.equal(small.rows.length, small.size);
    assert.ok(small.rows.every((row) => row.length === small.size));
    for (const edge of [0, 1, 2, 3, small.size - 1]) {
      assert.equal(small.rows[edge], '0'.repeat(small.size));
      assert.ok(small.rows.every((row) => row[edge] === '0'));
    }
    assert.equal(decoded(small.rows), PAYLOAD);
    for (const text of ['x'.repeat(996), '\u0645'.repeat(498), '\ud83d\ude00'.repeat(249)]) {
      const full = await Signature.qrMatrix(text);
      assert.equal(full.size, 125);
      assert.equal(decoded(full.rows), text);
    }
    for (const text of ['', '\ud800', '\udc00', 'x'.repeat(997), `${'\u0645'.repeat(498)}x`]) {
      await assert.rejects(Signature.qrMatrix(text), { code: 'E_QR' });
    }
  });
});
