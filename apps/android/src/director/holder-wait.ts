// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A device of a demo world that comes to hold the school key another device
// holds (#571, answer 600). Waiting, it makes its agreement pair, its ID and a
// one-time secret, keeps them in the world's store (school.waiting), so the
// same code shows after the page closes, and opens the drop space the secret
// names; it answers the code to show, with the device's fingerprint. Reading
// the drop space gives nothing yet, the keyring a holder admitted it to with
// its fingerprint, or 'contested' when two that differ hold, which starts the
// wait over with a new code. Once the person at the device says the
// fingerprint is the holder's, it keeps the keyring as it holds it, which ends
// the wait, and follows the school's stream from there. Giving up ends the
// wait too; either way the secret is never used again, though the store,
// which only adds, keeps it until the world is erased. A wait the store no
// longer keeps is refused with E_SCHOOL_WAITING, and a device that holds a
// school's key already does not wait (E_SCHOOL_HELD).

import {
  holderDrop,
  holderFingerprint,
  holderQr,
  keptWaiting,
  keyringFingerprint,
  latestHeld,
  newHolderSecret,
  newId,
  readAdmitted,
  type OpenedKeyring,
  type SchoolWaiting,
} from '@minhajna/core';
import { newDevicePair, worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { spaceBatches } from '../school/space-read';
import { PUBLIC_KEY_BYTES, type IssueDesk } from './school-desk';
import { followSchool, type Followed } from './keyring-session';
import { inTurn } from './keys-session';

type WaitWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** What the waiting device shows: the code's text and the device's fingerprint. */
export interface Waiting {
  readonly waiting: SchoolWaiting;
  readonly code: string;
  readonly fingerprint: string;
}

/** A keyring the device was admitted to, opened, with its school and fingerprint. */
export interface Admitted {
  readonly school: string;
  readonly opened: OpenedKeyring;
  readonly fingerprint: string;
}

/** Refuses a wait the store no longer keeps, as after giving up or a new code, or once a key is held. */
function checkWaiting(world: WaitWorld, waiting: SchoolWaiting): void {
  if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES) !== null) {
    throw failed('This device holds a school key already', 'E_SCHOOL_HELD');
  }
  if (keptWaiting(world.book.entries, PUBLIC_KEY_BYTES)?.secret !== waiting.secret) {
    throw failed('The store no longer keeps this wait', 'E_SCHOOL_WAITING');
  }
}

const cryptoOf = (kit: WorldKit, waiting: SchoolWaiting) =>
  worldKeyCrypto(kit, { publicKey: waiting.publicKey, pkcs8: waiting.pkcs8 });

/** Starts the wait, or takes the one the store keeps, opens its drop space, and answers what to show. */
export function waitToHold(world: WaitWorld, kit: WorldKit, send: Send = worldRequest): Promise<Waiting> {
  return inTurn(world.world, async () => {
    if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES) !== null) {
      throw failed('This device holds a school key already', 'E_SCHOOL_HELD');
    }
    let waiting = keptWaiting(world.book.entries, PUBLIC_KEY_BYTES);
    if (waiting === null) {
      const pair = await kitStep(() => newDevicePair(kit));
      const made = { device: newId(kit.random), ...pair, secret: newHolderSecret(kit.random) };
      await world.book.record(world.date, { kind: 'school.waiting', waiting: made });
      waiting = keptWaiting(world.book.entries, PUBLIC_KEY_BYTES);
      if (waiting?.secret !== made.secret) throw failed('The world’s store did not keep the wait', 'E_WORLD');
    }
    const kept = waiting;
    const drop = await kitStep(() => holderDrop(kept.secret, kit.mac));
    const opened = await send({
      method: 'PUT',
      path: `/worlds/${world.world}/spaces/${drop.space}`,
      body: { kind: 'school' },
    });
    if (opened.status !== 200 && opened.status !== 201) throw unexpected(opened);
    const holder = { id: kept.device, publicKey: kept.publicKey };
    const fingerprint = await kitStep(() => holderFingerprint(holder, cryptoOf(kit, kept)));
    return { waiting: kept, code: holderQr(holder, kept.secret), fingerprint };
  });
}

/** What the drop space holds for the waiting device. */
export async function readDrop(
  world: WaitWorld,
  waiting: SchoolWaiting,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<Admitted | null | 'contested'> {
  checkWaiting(world, waiting);
  const drop = await kitStep(() => holderDrop(waiting.secret, kit.mac));
  const batches = (await spaceBatches(world.world, drop.space, send)).get(drop.stream) ?? [];
  const crypto = cryptoOf(kit, waiting);
  const read = await kitStep(() => readAdmitted(waiting.secret, batches, waiting.device, crypto, kit.cipher, kit.mac));
  if (read === null || read === 'contested') return read;
  return { ...read, fingerprint: keyringFingerprint(read.opened.ring) };
}

/** Keeps the keyring the device was admitted to, which ends the wait, and follows the school's stream. */
export function keepAdmitted(
  world: WaitWorld,
  waiting: SchoolWaiting,
  admitted: Admitted,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<Followed> {
  return inTurn(world.world, async () => {
    checkWaiting(world, waiting);
    const { device, publicKey, pkcs8 } = waiting;
    const held = { school: admitted.school, device, publicKey, pkcs8, ring: admitted.opened.ring };
    await world.book.record(world.date, { kind: 'school.held', held });
    if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES)?.ring.tag !== held.ring.tag) {
      throw failed('The world’s store did not keep the keyring', 'E_WORLD');
    }
    const desk: IssueDesk = { held, opened: admitted.opened, crypto: cryptoOf(kit, waiting) };
    return followSchool(world, desk, kit, send);
  });
}

/** Gives up the wait; a later one starts with a new code. */
export function giveUp(world: WaitWorld): Promise<void> {
  return inTurn(world.world, async () => {
    await world.book.record(world.date, { kind: 'school.waiting', waiting: null });
  });
}
