// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fixed batches in the core (#541): every piece padded to one size, change
// sets back exactly, and a batch moved, cut short or lying about its length
// refused. The cipher here is Node's AES-GCM; made-up bytes only.

import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { describe, it } from 'node:test';

import {
  BATCH_HEAD_BYTES,
  batchAdditional,
  openBatches,
  pieceRoom,
  sealBatches,
  type BatchCipher,
} from '../src/index.ts';

const key = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);

const seen: number[] = [];
const cipher: BatchCipher = {
  async seal(plain, additionalData) {
    seen.push(plain.length);
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const sealed = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, plain));
    return Uint8Array.from([...iv, ...sealed]);
  },
  async open(bytes, additionalData) {
    const iv = bytes.subarray(0, 12);
    return new Uint8Array(
      await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData }, key, bytes.subarray(12)),
    );
  },
};

function bytes(length: number, fill: number): Uint8Array {
  return new Uint8Array(length).fill(fill);
}

describe('fixed batches', () => {
  it('pads every piece to the batch size, an empty change set included', async () => {
    seen.length = 0;
    const full = await sealBatches(cipher, 'stream-a', 0, bytes(1000, 3), 256);
    const empty = await sealBatches(cipher, 'stream-a', full.length, new Uint8Array(0), 256);
    assert.equal(full.length, Math.ceil(1000 / pieceRoom(256)));
    assert.equal(empty.length, 1);
    assert.ok(seen.every((length) => length === 256));
    assert.equal(new Set([...full, ...empty].map((batch) => batch.bytes.length)).size, 1);
    assert.deepEqual(
      [...full, ...empty].map((batch) => batch.number),
      Array.from({ length: full.length + 1 }, (_, index) => index),
    );
  });

  it('gives back each change set exactly, across batches, and leaves out empty ones', async () => {
    const first = bytes(700, 1);
    const second = bytes(pieceRoom(128) * 2, 2);
    const one = await sealBatches(cipher, 's', 0, first, 128);
    const none = await sealBatches(cipher, 's', one.length, new Uint8Array(0), 128);
    const two = await sealBatches(cipher, 's', one.length + 1, second, 128);
    assert.equal(two.length, 2);
    assert.deepEqual(await openBatches(cipher, 's', [...one, ...none, ...two]), [first, second]);
  });

  it('binds the stream and number into each seal, and refuses a batch moved, swapped or missing', async () => {
    assert.deepEqual(
      batchAdditional('s', 4),
      Uint8Array.from('minhajna/sync/1\ns\n4', (one) => one.charCodeAt(0)),
    );
    assert.throws(() => batchAdditional('ص', 0), RangeError);
    const sealed = await sealBatches(cipher, 's', 0, bytes(300, 5), 128);
    await assert.rejects(openBatches(cipher, 'other', sealed));
    await assert.rejects(openBatches(cipher, 's', [{ ...sealed[0]!, number: 9 }, ...sealed.slice(1)]));
    await assert.rejects(openBatches(cipher, 's', [sealed[0]!, sealed[2]!, sealed[1]!]), /in order/);
    await assert.rejects(openBatches(cipher, 's', [sealed[0]!, sealed[2]!]), /in order/);
    assert.equal((await openBatches(cipher, 's', sealed)).length, 1);
  });

  it('refuses a change set cut short at either end, a piece claiming too much, and a batch too small', async () => {
    const sealed = await sealBatches(cipher, 's', 0, bytes(300, 5), 128);
    await assert.rejects(openBatches(cipher, 's', sealed.slice(0, -1)), /cut short/);
    await assert.rejects(openBatches(cipher, 's', sealed.slice(1)), /missing its start/);
    const next = await sealBatches(cipher, 's', sealed.length - 1, bytes(10, 6), 128);
    await assert.rejects(openBatches(cipher, 's', [...sealed.slice(0, -1), ...next]), /missing its start/);
    const liar: BatchCipher = { seal: cipher.seal, open: () => Promise.resolve(Uint8Array.from([3, 0, 0, 1, 0, 9])) };
    await assert.rejects(openBatches(liar, 's', [sealed[0]!]), /claims more/);
    const odd: BatchCipher = { seal: cipher.seal, open: () => Promise.resolve(Uint8Array.from([7, 0, 0, 0, 0])) };
    await assert.rejects(openBatches(odd, 's', [sealed[0]!]), /flags no batch has/);
    const stub: BatchCipher = { seal: cipher.seal, open: () => Promise.resolve(new Uint8Array(BATCH_HEAD_BYTES - 1)) };
    await assert.rejects(openBatches(stub, 's', [sealed[0]!]), /shorter than its head/);
    await assert.rejects(sealBatches(cipher, 's', 0, bytes(10, 1), BATCH_HEAD_BYTES), RangeError);
  });
});
