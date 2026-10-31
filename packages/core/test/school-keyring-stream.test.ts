// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The keyring's stream and a new device's drop space (#571, answer 600): a
// keyring of many holders goes over several batches and comes back whole,
// past batches that do not open, a keyring of another school and a cut one;
// a holder follows the stream, adopting each next keyring and skipping the
// ones that lost, until one removes it; a keyring too long to travel is
// refused; and a new device's drop space, named by its secret alone, gives
// the keyring only when the admission holds, refuses two that differ, and
// skips records of another shape. Every school and device is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ADMITTED_FORMAT,
  addHolder,
  admission,
  followKeyrings,
  holderDrop,
  holderFingerprint,
  keyedCipher,
  KEYRING_BATCHES,
  keyringStream,
  newHolderSecret,
  openKeyring,
  readAdmitted,
  readKeyrings,
  removeHolder,
  sealAdmitted,
  sealBatches,
  sealKeyring,
  startKeyring,
  SYNC_BATCH_BYTES,
  type SealedBatch,
} from '../src/index.ts';
import { ascii, fromHex, SCHOOL as SPACE } from '../src/school-key-shape.ts';
import { device, opened, random, SCHOOL } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';

const BYTES = 32;

/** A record sealed in a new device's drop space as anyone with its secret could. */
async function dropped(secret: string, record: unknown, first: number): Promise<SealedBatch[]> {
  const key = fromHex(secret);
  const stream = (await holderDrop(secret, mac)).stream;
  const sealer = keyedCipher(await mac(key, ascii('minhajna/holder-drop/seal')), cipher);
  const bytes =
    typeof record === 'string' ? Uint8Array.from(record, (one) => one.charCodeAt(0)) : ascii(JSON.stringify(record));
  return sealBatches(sealer, stream, first, bytes, SYNC_BATCH_BYTES);
}

async function started() {
  const director = await device();
  return { director, ring: await startKeyring(SCHOOL, director.holder, director.crypto, random) };
}

describe('the keyring stream', () => {
  it('carries a keyring over several batches, past what does not open as one of the school', async () => {
    const { director, ring } = await started();
    let big = ring;
    for (let count = 0; count < 24; count++) {
      big = await addHolder(big, (await device()).holder, director.holder.id, director.crypto);
    }
    const first = await sealKeyring(ring.ring, 0, cipher, mac);
    assert.equal(first.stream, await keyringStream(SCHOOL, mac));
    const junk: SealedBatch = { number: 1, bytes: random(4124) };
    const many = await sealKeyring(big.ring, 2, cipher, mac);
    assert.ok(many.batches.length > 1);
    const other = await startKeyring('another-made-up-school', director.holder, director.crypto, random);
    const elsewhere = (await sealKeyring(other.ring, 2 + many.batches.length, cipher, mac)).batches;
    const cut = (await sealKeyring(big.ring, 3 + many.batches.length, cipher, mac)).batches.slice(0, 1);
    const all = [...cut, ...elsewhere, ...many.batches, junk, ...first.batches];
    const read = await readKeyrings(SCHOOL, all, BYTES, cipher, mac);
    assert.deepEqual(
      read.map((one) => one.tag),
      [ring.ring.tag, big.ring.tag],
    );
    assert.deepEqual(await readKeyrings(SCHOOL, [], BYTES, cipher, mac), []);
    await assert.rejects(sealKeyring(ring.ring, -1, cipher, mac), /numbered from 0/);
  });

  it('is followed from the keyring held, skipping what lost, until one removes the device', async () => {
    const { director, ring } = await started();
    const deputy = await device();
    const two = await addHolder(ring, deputy.holder, director.holder.id, director.crypto);
    const lost = await addHolder(ring, (await device()).holder, director.holder.id, director.crypto);
    const third = await device();
    const three = await addHolder(two, third.holder, deputy.holder.id, director.crypto);
    const mine = await startKeyring(SCHOOL, deputy.holder, deputy.crypto, random);
    const followed = await followKeyrings(
      opened(await openKeyring(two.ring, deputy.holder.id, deputy.crypto)),
      [ring.ring, two.ring, lost.ring, mine.ring, three.ring, three.ring, 'not a keyring'],
      deputy.holder.id,
      deputy.crypto,
    );
    assert.notEqual(followed, 'removed');
    if (followed === 'removed') return;
    assert.deepEqual(
      followed.adopted.map((one) => one.ring.tag),
      [three.ring.tag],
    );
    assert.equal(followed.latest.ring.tag, three.ring.tag);
    const removed = await removeHolder(three, deputy.holder.id, director.holder.id, director.crypto, random);
    const after = await followKeyrings(followed.latest, [removed.ring], deputy.holder.id, deputy.crypto);
    assert.equal(after, 'removed');
  });
});

describe('a new device’s drop space', () => {
  it('is named by the secret alone, as a space the relay takes', async () => {
    const secret = newHolderSecret(random);
    const drop = await holderDrop(secret, mac);
    assert.deepEqual(await holderDrop(secret, mac), drop);
    assert.match(drop.space, SPACE);
    assert.notEqual((await holderDrop(newHolderSecret(random), mac)).space, drop.space);
  });

  it('gives the keyring only when the admission holds under the secret', async () => {
    const { director, ring } = await started();
    const fresh = await device();
    const secret = newHolderSecret(random);
    const two = await addHolder(ring, fresh.holder, director.holder.id, director.crypto);
    const admitted = await admission(two.ring, secret, director.crypto);
    const wrong = await admission(two.ring, newHolderSecret(random), director.crypto);
    const forged = await sealAdmitted(secret, { ring: two.ring, admission: wrong }, 0, cipher, mac);
    const sealed = await sealAdmitted(secret, { ring: two.ring, admission: admitted }, 1, cipher, mac);
    assert.equal(sealed.space, (await holderDrop(secret, mac)).space);
    const got = await readAdmitted(
      secret,
      [...forged.batches, ...sealed.batches],
      fresh.holder.id,
      fresh.crypto,
      cipher,
      mac,
    );
    assert.ok(got !== null && got !== 'contested');
    assert.equal(got.school, SCHOOL);
    assert.equal(got.opened.ring.tag, two.ring.tag);
    assert.equal(await readAdmitted(secret, forged.batches, fresh.holder.id, fresh.crypto, cipher, mac), null);
    const other = newHolderSecret(random);
    assert.equal(await readAdmitted(other, sealed.batches, fresh.holder.id, fresh.crypto, cipher, mac), null);
    const stranger = await device();
    assert.equal(await readAdmitted(secret, sealed.batches, stranger.holder.id, stranger.crypto, cipher, mac), null);
  });

  it('refuses two admitted keyrings that differ, and skips records of another shape', async () => {
    const { director, ring } = await started();
    const fresh = await device();
    const secret = newHolderSecret(random);
    const two = await addHolder(ring, fresh.holder, director.holder.id, director.crypto);
    const theirs = await startKeyring(SCHOOL, fresh.holder, fresh.crypto, random);
    const admitted = await admission(two.ring, secret, director.crypto);
    const record = { format: ADMITTED_FORMAT, school: SCHOOL, ring: two.ring, admission: admitted };
    const shapes = [
      { ...record, extra: 1 },
      { ...record, format: 'minhajna/holder-admitted/2' },
      { ...record, school: 'another-made-up-school' },
      `{"format":"${ADMITTED_FORMAT}","school":"\u00e9"}\u00e9`,
    ];
    let next = 0;
    const batches: SealedBatch[] = [];
    for (const one of shapes) {
      const sealed = await dropped(secret, one, next);
      batches.push(...sealed);
      next += sealed.length;
    }
    const read = (all: readonly SealedBatch[]) => readAdmitted(secret, all, fresh.holder.id, fresh.crypto, cipher, mac);
    assert.equal(await read(batches), null);
    const good = (await sealAdmitted(secret, { ring: two.ring, admission: admitted }, next, cipher, mac)).batches;
    const again = (await sealAdmitted(secret, { ring: two.ring, admission: admitted }, next + 1, cipher, mac)).batches;
    const both = await read([...batches, ...good, ...again]);
    assert.equal(both !== null && both !== 'contested' ? both.opened.ring.tag : null, two.ring.tag);
    const other = await admission(theirs.ring, secret, fresh.crypto);
    const rival = (await sealAdmitted(secret, { ring: theirs.ring, admission: other }, next + 2, cipher, mac)).batches;
    assert.equal(await read([...batches, ...good, ...again, ...rival]), 'contested');
    await assert.rejects(holderDrop('not a secret', mac), /one-time secret/);
  });

  it('shows the same fingerprint for the same device on both screens', async () => {
    const one = await device();
    const print = await holderFingerprint(one.holder, one.crypto);
    assert.match(print, /^[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}$/u);
    assert.equal(await holderFingerprint(one.holder, (await device()).crypto), print);
    const other = await device();
    assert.notEqual(await holderFingerprint({ ...one.holder, publicKey: other.holder.publicKey }, one.crypto), print);
  });
});

describe('the keyring stream’s limits', () => {
  it('refuses a keyring too long to travel, and drops gaps, repeats and sets never ended', async () => {
    const { director, ring } = await started();
    let big = ring;
    while ((await sealKeyring(big.ring, 0, cipher, mac)).batches.length < 3) {
      big = await addHolder(big, (await device()).holder, director.holder.id, director.crypto);
    }
    const three = (await sealKeyring(big.ring, 0, cipher, mac)).batches;
    const read = (all: readonly SealedBatch[]) => readKeyrings(SCHOOL, all, BYTES, cipher, mac);
    assert.deepEqual(await read([three[0]!, three[2]!]), []);
    assert.deepEqual(await read([three[0]!, three[1]!]), []);
    const shifted = (await sealKeyring(big.ring, 3, cipher, mac)).batches;
    assert.equal((await read([three[0]!, three[1]!, ...shifted])).length, 1);
    assert.equal((await read([...three, ...three])).length, 1);
    let huge = big;
    while ((await sealKeyring(huge.ring, 0, cipher, mac).catch(() => null)) !== null) {
      for (let count = 0; count < 20; count++) {
        huge = await addHolder(huge, (await device()).holder, director.holder.id, director.crypto);
      }
    }
    await assert.rejects(sealKeyring(huge.ring, 0, cipher, mac), /cannot travel/);
    assert.ok(KEYRING_BATCHES >= 32);
  });
});
