// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' changes on the director's device (#571, answers 556 to 558, 599 and
// 600): making the school key's recovery from two new parts, or, when the
// keyring already holds one, renewing it, which also removes every holder that
// looked like one. Each change follows the school's stream and is proposed
// there, then kept in the world's store once the relay took it
// (keyring-session.ts); when another change came first it is made again on
// top, with new parts, while what the director chose still applies. The
// director says whether to make or to renew, and a keyring that holds a
// recovery, or none, against that is refused with E_KEYRING_CHANGED, so a
// renewal never happens unasked. The parts are given back once, to be printed,
// and kept nowhere, with the new keyring's fingerprint to print beside them.
// Every change to the keyring goes through `inTurn`, one at a time in a world.

import {
  addRecovery,
  keyringFingerprint,
  keysFacts,
  makeRecoveryParts,
  renewRecovery,
  type RecoveryParts,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { recoveryDevice } from '../demo/recovery-device';
import type { Send, WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import type { IssueDesk } from './school-desk';
import { proposeChanges } from './keyring-session';

/** A recovery just made: its two parts, and the fingerprint of the keyring that holds it. */
export interface MadeRecovery {
  readonly parts: RecoveryParts;
  readonly fingerprint: string;
}

/** Whether the director makes the first recovery or renews the one the keyring holds. */
export type RecoveryChoice = 'make' | 'renew';

/** The changes on their way, by world, so the next waits for them. */
const changing = new Map<string, Promise<unknown>>();

/** Runs a change to a world's keyring once the changes before it are done. */
export function inTurn<T>(world: string, change: () => Promise<T>): Promise<T> {
  const next = (changing.get(world) ?? Promise.resolve()).catch(() => undefined).then(change);
  changing.set(world, next);
  return next.finally(() => {
    if (changing.get(world) === next) changing.delete(world);
  });
}

/** Makes the school key's recovery, or renews it, as the director chose, and answers the parts to print. */
export function makeRecovery(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  desk: IssueDesk,
  kit: WorldKit,
  choice: RecoveryChoice,
  send: Send = worldRequest,
): Promise<MadeRecovery> {
  return inTurn(world.world, async () => {
    const { device } = desk.held;
    const { crypto } = desk;
    let parts: RecoveryParts | null = null;
    const { changes } = await proposeChanges(world, desk, kit, send, async (opened) => {
      const facts = await keysFacts(opened.ring, device, crypto);
      if ((facts.recoveries.length > 0 ? 'renew' : 'make') !== choice) return null;
      parts = makeRecoveryParts(kit.random);
      if (choice === 'make') return [await addRecovery(opened, parts, device, crypto, recoveryDevice(kit))];
      return renewRecovery(opened, parts, device, crypto, recoveryDevice(kit), kit.random);
    });
    return { parts: parts!, fingerprint: keyringFingerprint(changes.at(-1)!.ring) };
  });
}
