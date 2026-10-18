// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock's settings module with no native side (#210): it keeps the
// delay and the screenshot choice in memory, refuses the delays the device
// refuses, and records every kind of screen the guard was told.

import type { ScreenKind } from '../src/lock/screen-guard';
import type { LockSettings, Spec } from '../src/native/NativeMinhajnaLock';

export class FakeLock {
  delayMinutes = 5;
  screenshots = false;
  /** Every kind the guard was told, in order; the window starts as for a PIN pad. */
  readonly guarded: ScreenKind[] = [];

  /** Whether the window is secure now, as the native guard would set it. */
  get secure(): boolean {
    const kind = this.guarded.at(-1) ?? 'pin';
    return kind === 'pin' || (kind === 'records' && !this.screenshots);
  }

  settings(): LockSettings {
    return { delayMinutes: this.delayMinutes, screenshots: this.screenshots };
  }

  setDelay(minutes: number): Promise<void> {
    if (![1, 5, 15].includes(minutes)) {
      return Promise.reject(Object.assign(new Error('The lock delay is 1, 5 or 15 minutes'), { code: 'E_SETTING' }));
    }
    this.delayMinutes = minutes;
    return Promise.resolve();
  }

  allowScreenshots(allowed: boolean): Promise<void> {
    this.screenshots = allowed;
    return Promise.resolve();
  }

  showing(kind: string): void {
    this.guarded.push(kind as ScreenKind);
  }

  asSpec(): Spec {
    return this;
  }
}
