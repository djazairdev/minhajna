// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Disposable invented phrases only; every key and salt is generated at runtime.

import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { type Entry } from '../../core/src/index.ts';
import { makeDemoYear } from '../../core/test/demo-year.ts';
import { demoReference } from '../../core/test/demo-year-support.ts';
import { historyDeps, seal, testKey, unseal, type RunBinding, type SealedEntry } from '../src/crypto.ts';

describe('The synthetic AES-GCM envelope', () => {
  let key: CryptoKey;
  let entries: readonly Entry[];
  let rows: SealedEntry[];
  let run: RunBinding;
  const runId = '1'.repeat(32);
  before(async () => {
    key = await testKey('Synthetic disposable phrase only', crypto.getRandomValues(new Uint8Array(16)));
    entries = (await makeDemoYear(demoReference(), historyDeps)).entries;
    run = { runId, level: 'cem', count: entries.length };
    rows = await seal(entries, key, run);
  });

  it('round-trips the complete demo year without storing a key or plaintext body', async () => {
    assert.equal(key.extractable, false);
    assert.equal(entries.length, 397);
    assert.deepEqual(await unseal(rows, key, run), entries);
    assert.equal(new Set(rows.map((row) => Buffer.from(row.iv).toString('hex'))).size, rows.length);
    for (const row of rows) {
      assert.deepEqual(Object.keys(row).sort(), ['ciphertext', 'iv', 'seq']);
      assert.equal(row.iv.length, 12);
      assert.equal(row.ciphertext.byteLength, new TextEncoder().encode(JSON.stringify(entries[row.seq])).length + 16);
    }
  });

  it('rejects a different key without returning decrypted records', async () => {
    const other = await testKey('Another synthetic phrase only', crypto.getRandomValues(new Uint8Array(16)));
    await assert.rejects(unseal(rows, other, run));
  });

  it('authenticates the ciphertext, IV, run identity and workload', async () => {
    const first = rows[0];
    assert.ok(first !== undefined);
    const bytes = new Uint8Array(first.ciphertext.slice(0));
    bytes[0] = (bytes[0] ?? 0) ^ 1;
    await assert.rejects(unseal([{ ...first, ciphertext: bytes.buffer }, ...rows.slice(1)], key, run));
    await assert.rejects(
      unseal([{ ...first, iv: crypto.getRandomValues(new Uint8Array(12)) }, ...rows.slice(1)], key, run),
    );
    await assert.rejects(unseal(rows, key, { ...run, runId: '2'.repeat(32) }));
    await assert.rejects(unseal(rows, key, { ...run, level: 'primary' }));
  });

  it('rejects missing or reordered rows', async () => {
    await assert.rejects(unseal(rows.slice(1), key, run), /count/);
    await assert.rejects(unseal(rows.slice(1), key, { ...run, count: run.count - 1 }), /row-order/);
    await assert.rejects(unseal([...rows].reverse(), key, run), /row-order/);
  });

  it('rejects a truncated run even with its count lowered to match', async () => {
    await assert.rejects(unseal(rows.slice(0, -5), key, { ...run, count: run.count - 5 }));
  });

  it('derives the same key again from the disposable phrase and saved salt', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const phrase = 'Repeatable synthetic phrase only';
    const original = await testKey(phrase, salt);
    const rederived = await testKey(phrase, salt);
    assert.deepEqual(
      await unseal(await seal(entries.slice(0, 2), original, { ...run, count: 2 }), rederived, { ...run, count: 2 }),
      entries.slice(0, 2),
    );
    await assert.rejects(testKey('short', salt), /test-passphrase/);
  });
});
