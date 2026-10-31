// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Adding and removing the devices that hold the school key, on a holder in a
// demo world (#571, answers 555, 558 and 600). Adding takes the new device's
// scanned code: the keyring sealed for it is proposed on the school's stream,
// then put in the new device's drop space with the school's space ID and the
// admission, and the new keyring's fingerprint is answered, for the new device
// to compare. Removing a device makes the next epoch, sealed only for the
// devices that remain; removing the device that made the recovery renews it
// first, and answers its new parts to print. A device no longer there is
// E_KEYRING_CHANGED, and this device does not remove itself (E_REMOVE_SELF).
// Adding a device the keyring holds already, by the same ID and public key,
// puts the admission again for the latest keyring, so a drop space not written
// the first time is written now; the same ID with another key is refused. Both
// go through keys-session.ts's `inTurn`.

import {
  addHolder,
  admission,
  holderDrop,
  keyringFingerprint,
  madeRecovery,
  makeRecoveryParts,
  removeDevice,
  sealAdmitted,
  toBase64Url,
  type Holder,
  type RecoveryParts,
} from '@minhajna/core';
import { recoveryDevice } from '../demo/recovery-device';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import type { IssueDesk } from './school-desk';
import { proposeChanges } from './keyring-session';
import { inTurn } from './keys-session';

type HolderWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** How many times the admission is put again when another record took its number. */
const TRIES = 3;

/** Adds the device a scanned code names; the keyring's fingerprint, and whether it was added or only admitted again. */
export function addDevice(
  world: HolderWorld,
  desk: IssueDesk,
  scanned: { readonly holder: Holder; readonly secret: string },
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<{ readonly fingerprint: string; readonly added: boolean }> {
  return inTurn(world.world, async () => {
    const { holder, secret } = scanned;
    const proposed = await proposeChanges(world, desk, kit, send, async (opened) => {
      const there = opened.ring.holders.find((one) => one.id === holder.id);
      if (there === undefined) return [await addHolder(opened, holder, desk.held.device, desk.crypto)];
      return there.publicKey === holder.publicKey ? [] : null;
    });
    const ring = proposed.desk.opened.ring;
    const admitted = await kitStep(() => admission(ring, secret, desk.crypto));
    const drop = await kitStep(() => holderDrop(secret, kit.mac));
    const path = `/worlds/${world.world}/spaces/${drop.space}`;
    const opened = await send({ method: 'PUT', path, body: { kind: 'school' } });
    if (opened.status !== 200 && opened.status !== 201) throw unexpected(opened);
    for (let tries = 0; tries < TRIES; tries += 1) {
      const there = (await spaceBatches(world.world, drop.space, send)).get(drop.stream) ?? [];
      const first = there.reduce((most, one) => Math.max(most, one.number + 1), 0);
      const sealed = await kitStep(() =>
        sealAdmitted(secret, { ring, admission: admitted }, first, kit.cipher, kit.mac),
      );
      const body = { stream: sealed.stream, first, batches: sealed.batches.map((one) => toBase64Url(one.bytes)) };
      const answer = await send({ method: 'POST', path: `${path}/batches`, body });
      if (answer.status === 201) return { fingerprint: keyringFingerprint(ring), added: proposed.changes.length > 0 };
      if (answer.status !== 409) throw unexpected(answer);
    }
    throw failed('The new device’s drop space kept changing', 'E_WORLD_SERVER');
  });
}

/** Removes a device, renewing the recovery first when it made it; the new parts to print then. */
export function removeHolderDevice(
  world: HolderWorld,
  desk: IssueDesk,
  device: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<{ readonly parts: RecoveryParts | null; readonly fingerprint: string }> {
  if (device === desk.held.device) return Promise.reject(failed('This device does not remove itself', 'E_REMOVE_SELF'));
  return inTurn(world.world, async () => {
    let parts: RecoveryParts | null = null;
    const { crypto } = desk;
    const { changes } = await proposeChanges(world, desk, kit, send, async (opened) => {
      if (!opened.ring.holders.some((one) => one.id === device)) return null;
      parts = (await madeRecovery(opened.ring, device, crypto)) ? makeRecoveryParts(kit.random) : null;
      const renewal = parts === null ? undefined : { parts, device: recoveryDevice(kit) };
      return removeDevice(opened, device, desk.held.device, crypto, kit.random, renewal);
    });
    return { parts, fingerprint: keyringFingerprint(changes.at(-1)!.ring) };
  });
}
