// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Crash reports, off by default (#249, answer 483): a crash that stops the
// app keeps only the error's type, where it happened in the code and the last
// screens, in one file outside the history, until the next start shows it.
export interface Spec extends TurboModule {
  /** Whether the teacher turned crash reports on in Help. Synchronous. */
  reportsOn(): boolean;
  /** Turns crash reports on or off; off also deletes a kept report. False when it did not save. Synchronous. */
  setReports(on: boolean): boolean;
  /** The screens opened since the app started, by route name, kept in memory for a native crash. */
  steps(names: ReadonlyArray<string>): void;
  /** Keeps a JavaScript crash before the app stops, if the switch is on; true when kept. Synchronous. */
  keep(type: string, frames: ReadonlyArray<string>): boolean;
  /** The kept report as JSON, or null. Synchronous. */
  kept(): string | null;
  /** Deletes the kept report, sent or not. */
  drop(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaCrash');
