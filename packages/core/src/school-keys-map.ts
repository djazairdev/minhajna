// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What D-Keys draws of the school key (#571, §6.5, answer 599), from the
// latest keyring a device holds: the holder devices, this one first and the
// others in the keyring's order; the holders that look like a recovery, apart
// from them, since more than one is a warning; how many epochs it has; and its
// fingerprint, which holders compare after a recovery. A keyring names no
// one, so neither does this.

import type { KeyCrypto, SchoolKeyring } from './school-key-shape.ts';
import { isRecoveryHolder, keyringFingerprint } from './school-recovery.ts';

export interface KeysFacts {
  /** This device's ID when it holds the key as a device, or null. */
  readonly own: string | null;
  /** The holder devices' IDs, this device first when it holds the key. */
  readonly devices: readonly string[];
  /** The holders that look like a recovery; more than one is a warning. */
  readonly recoveries: readonly string[];
  readonly epochs: number;
  readonly fingerprint: string;
}

/** The facts D-Keys draws of a keyring, as the device `device` sees it. */
export async function keysFacts(ring: SchoolKeyring, device: string, crypto: KeyCrypto): Promise<KeysFacts> {
  const devices: string[] = [];
  const recoveries: string[] = [];
  for (const holder of ring.holders) {
    if (await isRecoveryHolder(holder, crypto)) recoveries.push(holder.id);
    else if (holder.id === device) devices.unshift(holder.id);
    else devices.push(holder.id);
  }
  const own = devices[0] === device ? device : null;
  return { own, devices, recoveries, epochs: ring.epochs.length, fingerprint: keyringFingerprint(ring) };
}
