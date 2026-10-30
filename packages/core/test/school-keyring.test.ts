// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school keyring as it comes through the server (#550): a device adopts
// only the next keyring of the school's space, one version up from the one
// it holds, made by one of its holders; and refuses one the server or a
// removed device changed, one that is not shaped as a keyring, an older one,
// and one that skips ahead or forks, so of two changes made at once only the
// first in the space is kept. Every school and device is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  acceptKeyring,
  addHolder,
  openKeyring,
  removeHolder,
  sealInfo,
  startKeyring,
  toHex,
  type SchoolKeyring,
} from '../src/index.ts';
import { device, opened, random, SCHOOL } from './school-devices.ts';

async function school() {
  const [director, deputy, phone] = [await device(), await device(), await device()];
  const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const two = await addHolder(one, deputy.holder, director.holder.id, director.crypto);
  const three = await addHolder(two, phone.holder, director.holder.id, director.crypto);
  const four = await removeHolder(three, phone.holder.id, director.holder.id, director.crypto, random);
  return { director, deputy, phone, one, two, three, four };
}

describe('the school keyring through the server', () => {
  it('is adopted one change at a time, in the order of the school’s space', async () => {
    const { deputy, two, three, four } = await school();
    const held = opened(await openKeyring(two.ring, deputy.holder.id, deputy.crypto));
    const accept = (from: typeof held, ring: unknown) => acceptKeyring(from, ring, deputy.holder.id, deputy.crypto);
    assert.equal(await accept(held, four.ring), 'forked');
    const next = opened(await accept(held, three.ring));
    assert.equal(await accept(next, three.ring), next);
    assert.equal(await accept(next, two.ring), 'older');
    assert.deepEqual(opened(await accept(next, four.ring)).keys, four.keys);
  });

  it('keeps the first of two changes made at once, and takes the other made again on top', async () => {
    const { director, deputy, phone, three } = await school();
    const added = await addHolder(three, (await device()).holder, director.holder.id, director.crypto);
    const removed = await removeHolder(three, phone.holder.id, deputy.holder.id, deputy.crypto, random);
    for (const one of [director, deputy, phone]) {
      const held = opened(await openKeyring(three.ring, one.holder.id, one.crypto));
      const next = opened(await acceptKeyring(held, added.ring, one.holder.id, one.crypto));
      assert.equal(await acceptKeyring(next, removed.ring, one.holder.id, one.crypto), 'forked');
    }
    const held = opened(await openKeyring(added.ring, deputy.holder.id, deputy.crypto));
    const again = await removeHolder(held, phone.holder.id, deputy.holder.id, deputy.crypto, random);
    const kept = opened(await openKeyring(added.ring, director.holder.id, director.crypto));
    assert.deepEqual(
      opened(await acceptKeyring(kept, again.ring, director.holder.id, director.crypto)).keys,
      again.keys,
    );
  });

  it('refuses a fork made by a removed device once its removal is held', async () => {
    const { deputy, phone, three, four } = await school();
    const held = opened(await openKeyring(four.ring, deputy.holder.id, deputy.crypto));
    const other = await device();
    const back = await addHolder(three, other.holder, phone.holder.id, phone.crypto);
    assert.equal(await acceptKeyring(held, back.ring, deputy.holder.id, deputy.crypto), 'forked');
    const ahead = await addHolder(back, (await device()).holder, phone.holder.id, phone.crypto);
    assert.equal(await acceptKeyring(held, ahead.ring, deputy.holder.id, deputy.crypto), 'forked');
    const before = opened(await openKeyring(three.ring, phone.holder.id, phone.crypto));
    assert.equal(await acceptKeyring(before, four.ring, phone.holder.id, phone.crypto), 'removed');
  });

  it('refuses a keyring the server changed, or one not shaped as a keyring', async () => {
    const { deputy, phone, three, four } = await school();
    const held = opened(await openKeyring(three.ring, deputy.holder.id, deputy.crypto));
    const accept = (ring: unknown) => acceptKeyring(held, ring, deputy.holder.id, deputy.crypto);
    const ring: SchoolKeyring = four.ring;
    const shifted = [...ring.holders[0]!.publicKey].map((one, index) =>
      index === 0 ? String.fromCharCode(one.charCodeAt(0) + 0x100) : one,
    );
    const changes: unknown[] = [
      { ...ring, holders: [...ring.holders, phone.holder] },
      { ...ring, holders: [{ ...ring.holders[0]!, publicKey: shifted.join('') }, ring.holders[1]] },
      { ...ring, by: phone.holder.id },
      { ...ring, school: 'another-made-up-school' },
      { ...ring, extra: 'made up' },
      { ...ring, epochs: 'not a list' },
      { ...ring, epochs: [] },
      null,
      'made up',
    ];
    for (const change of changes) assert.equal(await accept(change), 'forged', JSON.stringify(change)?.slice(0, 60));
    assert.equal(await accept({ ...ring, version: ring.version + 1 }), 'forked');
    assert.equal(await accept({ ...ring, previous: four.ring.tag }), 'forked');

    const swapped = await device();
    const epoch = ring.epochs[1]!;
    const publicKey = Uint8Array.from(deputy.holder.publicKey.match(/../gu)!, (pair) => parseInt(pair, 16));
    const reseal = await swapped.crypto.seal(random(32), publicKey, sealInfo(SCHOOL, 1, deputy.holder.id));
    const resealed = { ...epoch, sealed: { ...epoch.sealed, [deputy.holder.id]: toHex(reseal) } };
    assert.equal(await accept({ ...ring, epochs: [ring.epochs[0], resealed] }), 'forged');
    const dropped = Object.fromEntries(Object.entries(epoch.sealed).filter(([id]) => id !== deputy.holder.id));
    assert.equal(await accept({ ...ring, epochs: [ring.epochs[0], { ...epoch, sealed: dropped }] }), 'forged');
    assert.deepEqual(opened(await accept(ring)).keys, four.keys);
  });
});
