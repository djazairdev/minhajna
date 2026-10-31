// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// My log in a demo world (#573, answer 603): the school key started on this
// device; devices added and removed, counted without the recovery, and the
// recovery made and renewed, only in keyrings this device made, never one
// another holder made and this device followed, the old recovery's removal and
// a device's removal with a renewal each said once; a device another holder
// added says it was added, and again when the device holds the key under a new
// ID; codes issued, replaced, by a code or a key, and issued again after the
// key changed, and security keys issued and replacing an earlier one, each by
// its day and school and in the history's order, an issue kept twice once and a
// record that does not read never. Every school, device and teacher is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addHolder,
  addRecovery,
  makeRecoveryParts,
  removeDevice,
  renewRecovery,
  staffLog,
  startKeyring,
  type Holder,
  type KeyCrypto,
  type OpenedKeyring,
  type SchoolHeld,
  type SchoolIssued,
} from '../src/index.ts';
import { cemEvents, d, openBook } from './fixtures.ts';
import { device, random, recoveryDevice, SCHOOL } from './school-devices.ts';

const PKCS8 = 'TWFkZS11cCBwcml2YXRlIGhhbGYgb2YgYW4gYWdyZWVtZW50IGtleQ==';

const held = (holder: Holder, opened: OpenedKeyring): SchoolHeld => ({
  school: SCHOOL,
  device: holder.id,
  publicKey: holder.publicKey,
  pkcs8: PKCS8,
  ring: opened.ring,
});

const issued = (assignment: string, issue: number, epoch: number, keyNumber: string | null = null): SchoolIssued => ({
  school: SCHOOL,
  assignment,
  issue,
  epoch,
  access: keyNumber === null ? 'phone' : 'key',
  keyNumber,
});

const [X, Y, Z] = ['a1'.repeat(16), 'b2'.repeat(16), 'c3'.repeat(16)];

describe('the log of a director’s own actions', () => {
  it('lists the key’s changes this device made, the recovery apart, never those it followed', async () => {
    const [mine, other, later] = [await device(), await device(), await device()];
    const crypto: KeyCrypto = mine.crypto;
    const by = mine.holder.id;
    const started = await startKeyring(SCHOOL, mine.holder, crypto, random);
    const added = await addHolder(started, other.holder, by, crypto);
    const recovered = await addRecovery(added, makeRecoveryParts(random), by, crypto, recoveryDevice);
    const followed = await renewRecovery(
      recovered,
      makeRecoveryParts(random),
      other.holder.id,
      crypto,
      recoveryDevice,
      random,
    );
    const renewal = { parts: makeRecoveryParts(random), device: recoveryDevice };
    const removed = await removeDevice(followed.at(-1)!, other.holder.id, by, crypto, random, renewal);
    const steps = [[started], [added], [recovered], followed, removed] as const;
    const book = await openBook(cemEvents());
    for (const [at, rings] of steps.entries()) {
      for (const ring of rings)
        await book.record(d(`2026-10-2${at}`), { kind: 'school.held', held: held(mine.holder, ring) });
    }
    const last = removed.at(-1)!;
    await book.record(d('2026-10-25'), { kind: 'school.held', held: held(mine.holder, last) });
    await book.record(d('2026-10-25'), { kind: 'school.held', held: { ...held(mine.holder, last), pkcs8: '!' } });
    const again = await addHolder(last, later.holder, by, crypto);
    await book.record(d('2026-10-26'), { kind: 'school.held', held: held(later.holder, again) });
    const at = (day: string) => ({ day: d(day), school: SCHOOL });
    assert.deepEqual(await staffLog(book.entries, crypto), [
      { kind: 'key-started', ...at('2026-10-20') },
      { kind: 'holders-added', ...at('2026-10-21'), count: 1 },
      { kind: 'recovery-made', ...at('2026-10-22') },
      { kind: 'recovery-renewed', ...at('2026-10-24') },
      { kind: 'holders-removed', ...at('2026-10-24'), count: 1 },
      { kind: 'key-admitted', ...at('2026-10-26') },
    ]);
    const theirs = await openBook(cemEvents());
    for (const ring of [added, recovered, ...followed]) {
      await theirs.record(d('2026-10-23'), { kind: 'school.held', held: held(other.holder, ring) });
    }
    assert.deepEqual(await staffLog(theirs.entries, other.crypto), [
      { kind: 'key-admitted', ...at('2026-10-23') },
      { kind: 'recovery-renewed', ...at('2026-10-23') },
    ]);
  });

  it('lists codes and keys issued, replaced and issued again, each once', async () => {
    const book = await openBook(cemEvents());
    const records: [string, SchoolIssued | Record<string, unknown>][] = [
      ['2026-10-20', issued(X, 1, 0)],
      ['2026-10-20', issued(X, 1, 0)],
      ['2026-10-21', issued(X, 2, 0)],
      ['2026-10-22', issued(X, 3, 1)],
      ['2026-10-22', issued(Y, 1, 0, '0042')],
      ['2026-10-23', issued(Y, 2, 1, '0043')],
      ['2026-10-23', issued(Z, 1, 1, '0044')],
      ['2026-10-24', issued(Z, 2, 1)],
      ['2026-10-24', { ...issued(Z, 3, 1), access: 'paper' }],
    ];
    for (const [day, one] of records) await book.record(d(day), { kind: 'school.issued', issued: one as SchoolIssued });
    const at = (day: string) => ({ day: d(day), school: SCHOOL });
    assert.deepEqual(await staffLog(book.entries, (await device()).crypto), [
      { kind: 'code-issued', ...at('2026-10-20'), assignment: X },
      { kind: 'code-replaced', ...at('2026-10-21'), assignment: X },
      { kind: 'code-reissued', ...at('2026-10-22'), assignment: X },
      { kind: 'key-issued', ...at('2026-10-22'), assignment: Y, number: '0042' },
      { kind: 'key-replaced', ...at('2026-10-23'), assignment: Y, number: '0043' },
      { kind: 'key-issued', ...at('2026-10-23'), assignment: Z, number: '0044' },
      { kind: 'code-replaced', ...at('2026-10-24'), assignment: Z },
    ]);
  });
});
