// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Spec } from '../src/native/NativeMinhajnaCrash';

/**
 * The crash report module for Jest, in memory, as the native one behaves:
 * the switch, off at first, which may fail to save; the screens last given;
 * and the kept report, kept only while the switch is on and deleted when it
 * is turned off.
 */
export class FakeCrash {
  on = false;
  saves = true;
  steps: string[] = [];
  report: string | null = null;

  reset(): void {
    this.on = false;
    this.saves = true;
    this.steps = [];
    this.report = null;
  }

  asSpec(): Spec {
    return {
      reportsOn: () => this.on,
      setReports: (on) => {
        if (!this.saves) return false;
        this.on = on;
        if (!on) this.report = null;
        return true;
      },
      steps: (names) => {
        this.steps = [...names];
      },
      keep: (type, frames) => {
        if (!this.on) return false;
        this.report = JSON.stringify({ type, frames, steps: this.steps, version: '0.5.0', android: '15' });
        return true;
      },
      kept: () => this.report,
      drop: () => {
        this.report = null;
      },
    };
  }
}

export const fakeCrash = new FakeCrash();
