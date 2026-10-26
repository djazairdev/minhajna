// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The PC vault's rules that need no database (#250, part 2, answer 502): a
// passphrase of 12 to 1024 characters in any Unicode form, the phone's
// waits after wrong tries, and a browser out of room read as the phone's
// full disk. The vault itself is tested in vault.test.ts.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readAttempts, waitFor, waitLeft } from '../src/native/vault/attempts.ts';
import { noSpace } from '../src/native/vault/lock.ts';
import { passphraseFits } from '../src/native/vault/seal.ts';

describe('the passphrase and wait rules', () => {
  it('says a browser out of room as the phone does', () => {
    assert.equal((noSpace(new DOMException('full', 'QuotaExceededError')) as { code?: string }).code, 'E_NO_SPACE');
    const other = new Error('other');
    assert.equal(noSpace(other), other);
  });

  it('takes 12 characters or more, in any Unicode form', () => {
    assert.equal(passphraseFits('eleven char'), false);
    assert.equal(passphraseFits('twelve chars'), true);
    assert.equal(passphraseFits(String.fromCodePoint(0x645).repeat(12)), true);
    assert.equal(passphraseFits('\ud800'.repeat(12)), false);
    assert.equal(passphraseFits('x'.repeat(1025)), false);
  });

  it('waits as the phone does, and reads an unreadable count as the longest wait', () => {
    assert.deepEqual([4, 5, 6, 7, 12, 13, 40].map(waitFor), [0, 30, 60, 120, 3600, 3600, 3600]);
    const unreadable = readAttempts('nonsense', 1000);
    assert.equal(unreadable.carried, true);
    assert.equal(waitLeft(unreadable.attempts, 1000), 3600);
    assert.equal(waitLeft(readAttempts({ failures: 5, last: 0, until: 9e15 }, 1000).attempts, 1000), 30);
  });
});
