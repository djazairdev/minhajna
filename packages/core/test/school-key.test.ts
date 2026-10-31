// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key (#550): made on the director's device, sealed for each
// holder, a device added by its one-time QR code and admitted under its
// secret, and a device removed by any holder, which opens nothing added
// after and is told it was removed only by the holder's proof, never by a
// copy that drops it; records are sealed under a key derived for their
// purpose. Every school and device is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptKeyring,
  addHolder,
  admission,
  holderQr,
  latestEpoch,
  newHolderSecret,
  openAdmitted,
  openKeyring,
  purposeKey,
  readHolderQr,
  removeHolder,
  startKeyring,
} from '../src/index.ts';
import { device, opened, opensRecord, random, SCHOOL, sealRecord } from './school-devices.ts';

const TAG = 'ab'.repeat(32);

describe('the school key', () => {
  it('is made on the director’s device, which alone opens it', async () => {
    const director = await device();
    const other = await device();
    const started = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    assert.deepEqual([started.ring.version, started.ring.previous, started.ring.by], [1, '', director.holder.id]);
    assert.equal(started.keys[0]!.length, 32);
    assert.deepEqual(opened(await openKeyring(started.ring, director.holder.id, director.crypto)).keys, started.keys);
    assert.equal(await openKeyring(started.ring, other.holder.id, other.crypto), 'removed');
    await assert.rejects(startKeyring('short', director.holder, director.crypto, random), /space ID/);
    const wrong = { ...director.holder, publicKey: 'ab'.repeat(33) };
    await assert.rejects(startKeyring(SCHOOL, wrong, director.crypto, random), /hold the key/);
  });

  it('adds a device by its one-time QR code, which opens only a keyring it was admitted to', async () => {
    const director = await device();
    const deputy = await device();
    const started = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const secret = newHolderSecret(random);
    const scanned = readHolderQr(holderQr(deputy.holder, secret));
    assert.deepEqual(scanned, { holder: deputy.holder, secret });
    const added = await addHolder(started, scanned.holder, director.holder.id, director.crypto);
    assert.deepEqual([added.ring.version, added.ring.previous], [2, started.ring.tag]);
    const admitted = await admission(added.ring, secret, director.crypto);
    const mine = opened(await openAdmitted(added.ring, admitted, deputy.holder.id, secret, deputy.crypto));
    assert.deepEqual(mine.keys, added.keys);
    const guessed = newHolderSecret(random);
    assert.equal(await openAdmitted(added.ring, admitted, deputy.holder.id, guessed, deputy.crypto), 'forged');

    const server = await device();
    const own = await startKeyring(SCHOOL, server.holder, server.crypto, random);
    const offered = await addHolder(own, deputy.holder, server.holder.id, server.crypto);
    assert.equal(await openAdmitted(offered.ring, admitted, deputy.holder.id, secret, deputy.crypto), 'forged');
    assert.equal(await openAdmitted({ made: 'up' }, admitted, deputy.holder.id, secret, deputy.crypto), 'forged');
    await assert.rejects(addHolder(added, deputy.holder, director.holder.id, director.crypto), /already holds/);
    await assert.rejects(addHolder(started, deputy.holder, server.holder.id, director.crypto), /Only a holder/);
  });

  it('reads only a QR code a new device made', () => {
    const holder = { id: 'a'.repeat(32), publicKey: 'b'.repeat(64) };
    const secret = 'c'.repeat(32);
    for (const text of [
      `minhajna-key:1:${holder.id}:${holder.publicKey}:${secret}`,
      holderQr(holder, secret.slice(2)),
      holderQr({ ...holder, id: 'A'.repeat(32) }, secret),
      `${holderQr(holder, secret)}:more`,
      holderQr({ ...holder, publicKey: 'b'.repeat(63) }, secret),
    ]) {
      assert.equal(readHolderQr(text), null, text);
    }
  });

  it('removes a device by any holder, and the removed device opens nothing added after', async () => {
    const [director, deputy, phone] = [await device(), await device(), await device()];
    let ring = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    ring = await addHolder(ring, deputy.holder, director.holder.id, director.crypto);
    ring = await addHolder(ring, phone.holder, director.holder.id, director.crypto);
    const lost = opened(await openKeyring(ring.ring, phone.holder.id, phone.crypto));
    const earlier = await purposeKey(ring, latestEpoch(ring), 'records', director.crypto);
    const before = await sealRecord(earlier);

    const after = await removeHolder(ring, phone.holder.id, deputy.holder.id, deputy.crypto, random);
    assert.deepEqual(after.ring.holders, [director.holder, deputy.holder]);
    assert.deepEqual([after.ring.by, latestEpoch(after)], [deputy.holder.id, 1]);
    const record = await sealRecord(await purposeKey(after, 1, 'records', deputy.crypto));
    assert.equal(await openKeyring(after.ring, phone.holder.id, phone.crypto), 'removed');
    for (const [epoch, key] of lost.keys.entries()) {
      assert.equal(await opensRecord(key, record), false);
      assert.equal(await opensRecord(await purposeKey(lost, epoch, 'records', phone.crypto), record), false);
    }
    assert.equal(await opensRecord(await purposeKey(lost, 0, 'records', phone.crypto), before), true);

    const kept = opened(await openKeyring(after.ring, director.holder.id, director.crypto));
    assert.equal(await opensRecord(await purposeKey(kept, 1, 'records', director.crypto), record), true);
    assert.equal(await opensRecord(await purposeKey(kept, 0, 'records', director.crypto), before), true);
    assert.notDeepEqual(await purposeKey(kept, 1, 'timetable', director.crypto), kept.keys[1]);
    await assert.rejects(purposeKey(kept, 2, 'records', director.crypto), /No such epoch/);
    await assert.rejects(removeHolder(after, phone.holder.id, director.holder.id, director.crypto, random), /does not/);
    await assert.rejects(removeHolder(after, deputy.holder.id, phone.holder.id, director.crypto, random), /Only a/);
  });

  it('tells a device it was removed only by a holder, never by a copy that drops it', async () => {
    const [director, phone] = [await device(), await device()];
    const ring = await addHolder(
      await startKeyring(SCHOOL, director.holder, director.crypto, random),
      phone.holder,
      director.holder.id,
      director.crypto,
    );
    const held = opened(await openKeyring(ring.ring, phone.holder.id, phone.crypto));
    const after = await removeHolder(ring, phone.holder.id, director.holder.id, director.crypto, random);
    assert.match(after.ring.removal ?? '', /^[0-9a-f]{64}$/u);
    assert.equal(await acceptKeyring(held, after.ring, phone.holder.id, phone.crypto), 'removed');
    const unproved: Record<string, unknown> = { ...after.ring };
    delete unproved.removal;
    assert.equal(await acceptKeyring(held, unproved, phone.holder.id, phone.crypto), 'forged');
    assert.equal(await acceptKeyring(held, { ...after.ring, removal: TAG }, phone.holder.id, phone.crypto), 'forged');
    const dropped = Object.fromEntries(
      Object.entries(ring.ring.epochs[0]!.sealed).filter(([id]) => id !== phone.holder.id),
    );
    const copy = {
      ...ring.ring,
      version: ring.ring.version + 1,
      previous: ring.ring.tag,
      holders: [director.holder],
      epochs: [{ ...ring.ring.epochs[0]!, sealed: dropped }],
      tag: TAG,
    };
    assert.equal(await acceptKeyring(held, copy, phone.holder.id, phone.crypto), 'forged');
    const junk = {
      ...ring.ring.epochs[0]!,
      sealed: { ...ring.ring.epochs[0]!.sealed, [phone.holder.id]: 'ab'.repeat(80) },
    };
    const kept = { ...copy, holders: ring.ring.holders, epochs: [junk] };
    assert.equal(await acceptKeyring(held, kept, phone.holder.id, phone.crypto), 'forged');
    const third = await device();
    const three = await addHolder(ring, third.holder, director.holder.id, director.crypto);
    const fromThree = opened(await openKeyring(three.ring, phone.holder.id, phone.crypto));
    const genuine = await removeHolder(three, third.holder.id, director.holder.id, director.crypto, random);
    assert.notEqual(await acceptKeyring(fromThree, genuine.ring, phone.holder.id, phone.crypto), 'removed');
    const grafted = {
      ...copy,
      version: three.ring.version + 1,
      previous: three.ring.tag,
      removal: genuine.ring.removal,
    };
    assert.equal(await acceptKeyring(fromThree, grafted, phone.holder.id, phone.crypto), 'forged');
    assert.equal(three.ring.removal, undefined);
  });
});
