// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the lock's screens take (#210), in a file of their own, so the PC's
// passphrase screens (#250) take the same as the phone's PIN screens they
// stand in for.

import type { Spec as Storage } from '../native/NativeMinhajnaStorage';

export type CreatePinProps = {
  readonly storage: Storage;
  /** A history from before the lock is already on this phone. */
  readonly upgrade: boolean;
  readonly lockMinutes: number;
  /** The history is open under the new PIN, which the fingerprint question may need once. */
  readonly onCreated: (pin: string) => void;
  readonly onRefused: (error: unknown) => void;
  /** The PIN did not save, but the native module may have kept it: shows the lock if so. */
  readonly onFailed?: () => void;
  /** Android's Back from the first step, back to the welcome; Back from the second step starts again. */
  readonly onBack?: () => void;
};

export type UnlockProps = {
  readonly storage: Storage;
  readonly biometric: boolean;
  /** A wait already running when the screen opens, in seconds. */
  readonly waitSeconds: number;
  readonly lockMinutes: number;
  readonly onOpened: () => void;
  /** The history cannot be opened: its key is gone, or the module failed. */
  readonly onRefused: (error: unknown) => void;
};

export type LockPinMode = 'change' | 'biometric';

export type LockPinProps = {
  readonly storage: Storage;
  readonly mode: LockPinMode;
  /** The PIN changed, or the phone's prompt was turned on. */
  readonly onDone: () => void;
  readonly onCancel: () => void;
};
