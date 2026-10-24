// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The recovery key and the transfer file's one-time key (#247, answer 478):
// 24 characters from 32, read as typed, and the QR code that carries one.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  RECOVERY_ALPHABET,
  RECOVERY_LENGTH,
  makeRecoveryKey,
  readRecoveryKey,
  readTransferQr,
  recoveryGroups,
  transferQr,
} from '../src/index.ts';
import { deps } from './support.ts';

const GROUPS = ['K7QF', '3M9T', 'WX2R', '8HDN', 'P4VC', '6JYE'];
const KEY = GROUPS.join('');
const HEAD = KEY.slice(0, 23);

describe('the recovery key', () => {
  it('draws 24 characters from the 32 that cannot be misread, every one used', () => {
    assert.equal(RECOVERY_ALPHABET.length, 32);
    assert.equal(/[ILOU]/.test(RECOVERY_ALPHABET), false);
    const seen = new Set<string>();
    for (let round = 0; round < 200; round++) {
      const key = makeRecoveryKey(deps.random);
      assert.equal(key.length, RECOVERY_LENGTH);
      assert.equal(readRecoveryKey(key), key);
      for (const one of key) seen.add(one);
    }
    assert.equal(seen.size, 32);
  });

  it('turns 15 bytes into 24 characters, five bits each, in order', () => {
    assert.equal(
      makeRecoveryKey(() => new Uint8Array(15)),
      '0'.repeat(24),
    );
    assert.equal(
      makeRecoveryKey(() => new Uint8Array(15).fill(255)),
      'Z'.repeat(24),
    );
    const first = new Uint8Array(15);
    first[0] = 0b00001_000;
    assert.equal(
      makeRecoveryKey(() => first),
      `1${'0'.repeat(23)}`,
    );
    assert.throws(() => makeRecoveryKey(() => new Uint8Array(14)), RangeError);
  });

  it('reads a key as the teacher types it', () => {
    assert.equal(readRecoveryKey('k7qf 3m9t wx2r 8hdn p4vc 6jye'), KEY);
    assert.equal(readRecoveryKey('K7QF-3M9T-WX2R-8HDN-P4VC-6JYE'), KEY);
    assert.equal(readRecoveryKey(' K7QF\n3M9T\tWX2R 8HDN P4VC 6JYE '), KEY);
    assert.equal(readRecoveryKey(`${HEAD}O`), `${HEAD}0`);
    assert.equal(readRecoveryKey(`${HEAD}I`), `${HEAD}1`);
    assert.equal(readRecoveryKey(`${HEAD}l`), `${HEAD}1`);
    assert.equal(readRecoveryKey('K٧QF ٣M۹T WX٢R ۸HDN P٤VC ٦JYE'), KEY);
  });

  it('refuses what is not a key', () => {
    for (const text of ['', KEY.slice(1), `${KEY}0`, `${HEAD}U`, `${HEAD}!`]) {
      assert.equal(readRecoveryKey(text), null, text);
    }
  });

  it('shows the key in six groups of four', () => {
    assert.deepEqual(recoveryGroups(KEY), GROUPS);
  });

  it('reads back the one-time key a transfer QR code carries, and nothing else', () => {
    assert.equal(transferQr(KEY), `minhajna-key:1:${KEY}`);
    assert.equal(readTransferQr(transferQr(KEY)), KEY);
    for (const text of [KEY, `minhajna-key:2:${KEY}`, `minhajna-key:1:${KEY.toLowerCase()}`, 'minhajna-key:1:']) {
      assert.equal(readTransferQr(text), null, text);
    }
  });
});
