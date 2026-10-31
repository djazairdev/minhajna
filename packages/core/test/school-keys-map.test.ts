// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What D-Keys draws of the school key (#571, answer 599): the holder devices,
// this one first whoever made the keyring, the others in its order; a recovery
// apart from them, and two that look like one both listed; the epochs, and the
// fingerprint holders compare. Every school and device is made up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addHolder,
  addRecovery,
  keyringFingerprint,
  keysFacts,
  makeRecoveryParts,
  recoveryHolder,
  removeHolder,
  startKeyring,
} from '../src/index.ts';
import { device, random, recoveryDevice, SCHOOL } from './school-devices.ts';

describe('what D-Keys draws of the school key', () => {
  it('lists this device first, the others in order, and a recovery apart', async () => {
    const [director, deputy, censor] = [await device(), await device(), await device()];
    const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    assert.deepEqual(await keysFacts(one.ring, director.holder.id, director.crypto), {
      own: director.holder.id,
      devices: [director.holder.id],
      recoveries: [],
      epochs: 1,
      fingerprint: keyringFingerprint(one.ring),
    });
    const two = await addHolder(one, deputy.holder, director.holder.id, director.crypto);
    const three = await addHolder(two, censor.holder, director.holder.id, director.crypto);
    const four = await addRecovery(
      three,
      makeRecoveryParts(random),
      director.holder.id,
      director.crypto,
      recoveryDevice,
    );
    const seen = await keysFacts(four.ring, censor.holder.id, censor.crypto);
    assert.deepEqual(seen.devices, [censor.holder.id, director.holder.id, deputy.holder.id]);
    assert.equal(seen.own, censor.holder.id);
    assert.equal(seen.recoveries.length, 1);
    assert.equal(seen.fingerprint, keyringFingerprint(four.ring));
    const five = await removeHolder(four, deputy.holder.id, director.holder.id, director.crypto, random);
    const after = await keysFacts(five.ring, director.holder.id, director.crypto);
    assert.deepEqual(after.devices, [director.holder.id, censor.holder.id]);
    assert.equal(after.epochs, 2);
  });

  it('lists every holder that looks like a recovery, even to a device that holds no key', async () => {
    const director = await device();
    const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
    const made = await recoveryHolder(
      SCHOOL,
      makeRecoveryParts(random),
      director.holder.id,
      director.crypto,
      recoveryDevice,
    );
    const other = await recoveryHolder(
      SCHOOL,
      makeRecoveryParts(random),
      director.holder.id,
      director.crypto,
      recoveryDevice,
    );
    const two = await addHolder(one, made.holder, director.holder.id, director.crypto);
    const three = await addHolder(two, other.holder, director.holder.id, director.crypto);
    const facts = await keysFacts(three.ring, 'not a holder', director.crypto);
    assert.deepEqual(facts.devices, [director.holder.id]);
    assert.equal(facts.own, null);
    assert.deepEqual(facts.recoveries, [made.holder.id, other.holder.id]);
  });
});
