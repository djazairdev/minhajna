// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school key's recovery (#551): both parts, the school's and the
// directorate's, open the school's keyring on a new device, and neither
// alone does; the device that recovers adds itself and replaces the parts
// at once, after which the old ones open nothing; removing the device that
// made the parts replaces them too, and a renewal removes every holder that
// looks like the recovery; and the directorate's part sealed for a
// directorate device opens only there. Every school, device and part is made
// up.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  addHolder,
  addRecovery,
  isRecoveryHolder,
  keyringFingerprint,
  latestEpoch,
  madeRecovery,
  makeRecoveryParts,
  openDirectoratePart,
  openKeyring,
  purposeKey,
  recoverKeyring,
  recoveryGroups,
  recoveryOrphaned,
  removeHolder,
  removeDevice,
  renewRecovery,
  sealDirectoratePart,
  startKeyring,
  type OpenedKeyring,
  type Recovered,
} from '../src/index.ts';
import { device, opened, opensRecord, random, recoveryDevice, SCHOOL, sealRecord } from './school-devices.ts';

const fromHexText = (hex: string) => Uint8Array.from(Buffer.from(hex, 'hex'));

function recovered(result: Recovered | string): Recovered {
  assert.notEqual(typeof result, 'string', typeof result === 'string' ? result : '');
  return result as Recovered;
}

async function school() {
  const [director, deputy] = [await device(), await device()];
  const one = await startKeyring(SCHOOL, director.holder, director.crypto, random);
  const two = await addHolder(one, deputy.holder, director.holder.id, director.crypto);
  const parts = makeRecoveryParts(random);
  const three = await addRecovery(two, parts, director.holder.id, director.crypto, recoveryDevice);
  return { director, deputy, parts, rings: [one, two, three] };
}

describe('the school key’s recovery', () => {
  it('opens the school’s keyring with both parts, and with neither alone', async () => {
    const { director, parts, rings } = await school();
    const space = [null, ...rings.map((one) => one.ring)];
    const recover = (tried: typeof parts, of = SCHOOL) =>
      recoverKeyring(of, space, tried, director.crypto, recoveryDevice);
    const back = recovered(await recover(parts));
    assert.deepEqual(back.opened.keys, rings[2]!.keys);
    assert.equal(await isRecoveryHolder(back.recovery.holder, director.crypto), true);
    assert.equal(await isRecoveryHolder(director.holder, director.crypto), false);
    const typed = { school: recoveryGroups(parts.school).join(' ').toLowerCase(), directorate: parts.directorate };
    assert.deepEqual(recovered(await recover(typed)).opened.keys, rings[2]!.keys);

    const other = makeRecoveryParts(random);
    for (const tried of [
      { school: parts.school, directorate: other.directorate },
      { school: other.school, directorate: parts.directorate },
      { school: parts.directorate, directorate: parts.school },
    ]) {
      assert.equal(await recover(tried), 'wrong');
    }
    assert.equal(await recover(parts, 'another-made-up-school'), 'wrong');
    assert.equal(
      await recoverKeyring(
        SCHOOL,
        rings.slice(0, 2).map((one) => one.ring),
        parts,
        director.crypto,
        recoveryDevice,
      ),
      'wrong',
    );
  });

  it('adds a device in the recovery’s name and renews the parts, after which the old ones open nothing', async () => {
    const { director, parts, rings } = await school();
    const space = rings.map((one) => one.ring);
    const back = recovered(await recoverKeyring(SCHOOL, space, parts, director.crypto, recoveryDevice));
    const phone = await device();
    const { recovery } = back;
    const four = await addHolder(back.opened, phone.holder, recovery.holder.id, recovery.crypto);
    assert.equal(four.ring.by, recovery.holder.id);
    const mine = opened(await openKeyring(four.ring, phone.holder.id, phone.crypto));
    const fresh = makeRecoveryParts(random);
    const renewal = await renewRecovery(mine, fresh, phone.holder.id, phone.crypto, recoveryDevice, random);
    assert.equal(renewal.length, 2);
    const [five, six] = renewal as readonly [OpenedKeyring, OpenedKeyring];
    assert.equal(five.ring.holders.length, 5);
    assert.deepEqual(
      six.ring.holders.map((one) => one.id).sort(),
      [...rings[1]!.ring.holders, phone.holder, five.ring.holders[4]!].map((one) => one.id).sort(),
    );

    const later = [...space, four.ring, five.ring, six.ring];
    assert.equal(await recoverKeyring(SCHOOL, later, parts, director.crypto, recoveryDevice), 'replaced');
    const renewed = recovered(await recoverKeyring(SCHOOL, later, fresh, director.crypto, recoveryDevice));
    assert.deepEqual(renewed.opened.keys, six.keys);
    const record = await sealRecord(await purposeKey(six, latestEpoch(six), 'records', phone.crypto));
    const old = opened(await openKeyring(four.ring, recovery.holder.id, recovery.crypto));
    for (const [epoch] of old.keys.entries()) {
      assert.equal(await opensRecord(await purposeKey(old, epoch, 'records', recovery.crypto), record), false);
    }
    assert.equal(
      await opensRecord(
        await purposeKey(renewed.opened, latestEpoch(renewed.opened), 'records', director.crypto),
        record,
      ),
      true,
    );
    await assert.rejects(addRecovery(six, fresh, phone.holder.id, phone.crypto, recoveryDevice), /already/);
    await assert.rejects(
      renewRecovery(rings[1]!, fresh, director.holder.id, director.crypto, recoveryDevice, random),
      /no recovery/,
    );
    await assert.rejects(
      addRecovery(
        rings[1]!,
        { school: 'made up', directorate: fresh.directorate },
        director.holder.id,
        director.crypto,
        recoveryDevice,
      ),
      /not a recovery key/,
    );
  });

  it('renews the recovery when the device that made it is removed, as any later holder reads it', async () => {
    const { director, deputy, parts, rings } = await school();
    const coordinator = await device();
    const four = await addHolder(rings[2]!, coordinator.holder, deputy.holder.id, deputy.crypto);
    const held = opened(await openKeyring(four.ring, coordinator.holder.id, coordinator.crypto));
    const remove = (removed: string, renewal?: { parts: typeof parts; device: typeof recoveryDevice }) =>
      removeDevice(held, removed, coordinator.holder.id, coordinator.crypto, random, renewal);
    assert.equal(await madeRecovery(held.ring, director.holder.id, coordinator.crypto), true);
    assert.equal(await madeRecovery(held.ring, deputy.holder.id, coordinator.crypto), false);
    assert.equal((await remove(deputy.holder.id)).length, 1);
    assert.equal(await recoveryOrphaned(held.ring, coordinator.crypto), false);
    const plain = await removeHolder(held, director.holder.id, coordinator.holder.id, coordinator.crypto, random);
    assert.equal(await recoveryOrphaned(plain.ring, coordinator.crypto), true);
    await assert.rejects(remove(director.holder.id), /new parts are needed/);

    const fresh = makeRecoveryParts(random);
    const changes = await remove(director.holder.id, { parts: fresh, device: recoveryDevice });
    assert.equal(changes.length, 3);
    const later = [...rings.map((one) => one.ring), four.ring, ...changes.map((one) => one.ring)];
    assert.equal(await recoverKeyring(SCHOOL, later, parts, deputy.crypto, recoveryDevice), 'replaced');
    assert.equal(await openKeyring(later.at(-1), director.holder.id, director.crypto), 'removed');
    const renewed = recovered(await recoverKeyring(SCHOOL, later, fresh, deputy.crypto, recoveryDevice));
    assert.deepEqual(renewed.opened.keys, changes.at(-1)!.keys);
    assert.equal(await madeRecovery(changes.at(-1)!.ring, coordinator.holder.id, deputy.crypto), true);
    await assert.rejects(
      renewRecovery(renewed.opened, fresh, renewed.recovery.holder.id, deputy.crypto, recoveryDevice, random),
      /Only a device/,
    );
  });

  it('removes every holder that looks like the recovery when it renews', async () => {
    const { director, deputy, rings } = await school();
    const other = await device();
    const mac = await director.crypto.mac(
      fromHexText(other.holder.publicKey),
      new TextEncoder().encode('minhajna/school-key/recovery-holder'),
    );
    const disguised = { ...other.holder, id: Buffer.from(mac).toString('hex').slice(0, 32) };
    assert.equal(await isRecoveryHolder(disguised, director.crypto), true);
    const four = await addHolder(rings[2]!, disguised, deputy.holder.id, deputy.crypto);
    const changes = await renewRecovery(
      four,
      makeRecoveryParts(random),
      director.holder.id,
      director.crypto,
      recoveryDevice,
      random,
    );
    assert.equal(changes.length, 3);
    const holders = changes.at(-1)!.ring.holders;
    assert.deepEqual(holders.slice(0, 2), [director.holder, deputy.holder]);
    assert.equal(holders.length, 3);
    assert.equal(await isRecoveryHolder(holders[2]!, director.crypto), true);
    const faked = await addHolder(rings[1]!, disguised, deputy.holder.id, deputy.crypto);
    await assert.rejects(
      addRecovery(faked, makeRecoveryParts(random), director.holder.id, director.crypto, recoveryDevice),
      /already/,
    );
    assert.match(keyringFingerprint(changes.at(-1)!.ring), /^7(?:-[0-9a-f]{4}){4}$/u);
  });

  it('seals the directorate’s part for a directorate device, which alone opens it', async () => {
    const { director, parts } = await school();
    const directorate = await device();
    const sealed = await sealDirectoratePart(SCHOOL, parts, directorate.holder.publicKey, director.crypto);
    assert.equal(await openDirectoratePart(SCHOOL, sealed, directorate.crypto), parts.directorate);
    assert.equal(await openDirectoratePart(SCHOOL, sealed, director.crypto), null);
    assert.equal(await openDirectoratePart('another-made-up-school', sealed, directorate.crypto), null);
    assert.equal(await openDirectoratePart(SCHOOL, 'not hex', directorate.crypto), null);
    const text = await director.crypto.seal(
      new Uint8Array([0x41]),
      Uint8Array.from(Buffer.from(directorate.holder.publicKey, 'hex')),
      `minhajna/school-key/directorate-part\n${SCHOOL}`,
    );
    assert.equal(await openDirectoratePart(SCHOOL, Buffer.from(text).toString('hex'), directorate.crypto), null);
    await assert.rejects(sealDirectoratePart(SCHOOL, parts, 'ab'.repeat(31), director.crypto), /public key/);
  });
});
