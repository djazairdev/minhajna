// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** The lock's choices on this phone, kept outside the history so the lock screen can read them. */
export interface LockSettings {
  /** Minutes unused before the app locks: 1, 5 or 15. */
  delayMinutes: number;
  /** Screenshots are allowed on screens with pupils' records. */
  screenshots: boolean;
}

/**
 * The lock's settings and the screen guard (#210). The window is secure
 * from the start, on every screen with records unless the teacher allowed
 * screenshots (R-6.4-07), and on the PIN pads always.
 */
export interface Spec extends TurboModule {
  /** The kept settings, or the defaults: 5 minutes, no screenshots. Synchronous. */
  settings(): LockSettings;
  /** Keeps the delay, 1, 5 or 15 minutes; rejects with E_SETTING for any other. */
  setDelay(minutes: number): Promise<void>;
  /** Keeps the screenshot choice and applies it to the screen in front. */
  allowScreenshots(allowed: boolean): Promise<void>;
  /**
   * The kind of screen in front: 'open', with no records and no PIN pad;
   * 'records', guarded unless screenshots are allowed; or 'pin', always
   * guarded. Any other kind is guarded like a PIN pad.
   */
  showing(kind: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaLock');
