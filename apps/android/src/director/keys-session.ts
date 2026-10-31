// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// D-Keys' changes on the director's device (#571, answers 556 to 558 and 599):
// making the school key's recovery from two new parts, or, when the keyring
// already holds one, renewing it, which also removes every holder that looked
// like one. Each change starts from the latest keyring the world's store holds,
// opened again on this device, and every keyring it makes is kept there in
// order, as the device holds it, so the chain a recovery follows has no gap;
// they travel to other holders with part 3. The parts are given back once, to
// be printed, and kept nowhere, with the new keyring's fingerprint to print
// beside them. The director says whether to make or to renew, and a keyring
// that holds a recovery, or none, against that is refused with
// E_KEYRING_CHANGED, so a renewal never happens unasked. Every change to the
// keyring goes through `inTurn`, one at a time in a world; E_SCHOOL_KEY when
// the key no longer opens here, and E_WORLD when the store did not keep the new
// keyring, which, if only some of a renewal's keyrings were kept, may hold a
// recovery whose parts are gone: the warning of many recoveries then shows, and
// renewing again clears it.

import {
  addRecovery,
  keyringFingerprint,
  keysFacts,
  latestHeld,
  makeRecoveryParts,
  openKeyring,
  renewRecovery,
  type OpenedKeyring,
  type RecoveryParts,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { recoveryDevice } from '../demo/recovery-device';
import { failed, kitStep, type WorldKit } from '../demo/world-session';
import { PUBLIC_KEY_BYTES, type IssueDesk } from './issue-session';

/** A recovery just made: its two parts, and the fingerprint of the keyring that holds it. */
export interface MadeRecovery {
  readonly parts: RecoveryParts;
  readonly fingerprint: string;
}

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

/** Whether the director makes the first recovery or renews the one the keyring holds. */
export type RecoveryChoice = 'make' | 'renew';

/** Makes the school key's recovery, or renews it, as the director chose, and answers the parts to print. */
export function makeRecovery(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  desk: IssueDesk,
  kit: WorldKit,
  choice: RecoveryChoice,
): Promise<MadeRecovery> {
  return inTurn(world.world, () => makeOnce(world, desk, kit, choice));
}

async function makeOnce(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  desk: IssueDesk,
  kit: WorldKit,
  choice: RecoveryChoice,
): Promise<MadeRecovery> {
  const held = latestHeld(world.book.entries, PUBLIC_KEY_BYTES);
  if (held === null || held.device !== desk.held.device) throw failed('No school key held here', 'E_SCHOOL_KEY');
  const { device } = held;
  const { crypto } = desk;
  const opened = await kitStep(() => openKeyring(held.ring, device, crypto));
  if (typeof opened === 'string') throw failed(`The school key does not open here: ${opened}`, 'E_SCHOOL_KEY');
  const facts = await kitStep(() => keysFacts(opened.ring, device, crypto));
  if ((facts.recoveries.length > 0 ? 'renew' : 'make') !== choice) {
    throw failed('The keyring changed since the page read it', 'E_KEYRING_CHANGED');
  }
  const parts = makeRecoveryParts(kit.random);
  const changes: readonly OpenedKeyring[] = await kitStep(async () =>
    choice === 'make'
      ? [await addRecovery(opened, parts, device, crypto, recoveryDevice(kit))]
      : renewRecovery(opened, parts, device, crypto, recoveryDevice(kit), kit.random),
  );
  for (const change of changes) {
    await world.book.record(world.date, { kind: 'school.held', held: { ...held, ring: change.ring } });
  }
  const made = changes.at(-1)!;
  if (latestHeld(world.book.entries, PUBLIC_KEY_BYTES)?.ring.tag !== made.ring.tag) {
    throw failed('The world’s store did not keep the keyring', 'E_WORLD');
  }
  return { parts, fingerprint: keyringFingerprint(made.ring) };
}
