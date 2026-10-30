// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sets the network guard (guard.ts) as the app starts, on the phone and on a
// PC, with the demo server open only while the world's client
// (world-network.ts) is open to a world (#559, answer 570).

import { guardNetwork } from './guard';
import { DEMO_SERVER, worldNetworkOpen } from './world-network';

/** Guards the app's connections: `own` is a PC page's origin, `others` keeps Metro in Android's debug builds. */
export function installNetworkGuard(own: string | null, others: boolean): void {
  guardNetwork({ server: DEMO_SERVER, inWorld: () => worldNetworkOpen() !== null, own, others });
}

/** The phone's guard: Metro stays open in debug builds alone. */
export function guardPhone(): void {
  installNetworkGuard(null, __DEV__);
}
