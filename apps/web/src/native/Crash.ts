// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Crash reports on the web (#249, #250): off until the teacher turns them on
// in Help, as on the phone. A crash then keeps, in the browser outside the
// history, what the phone keeps (CrashKeep.kt): its type, its frames, the
// last 10 screens and the version, until the next start shows it. The
// browser's own name and version are left out, so the Android line stays
// empty; turning reports off deletes the report.

import type { Spec } from '../../../android/src/native/NativeMinhajnaCrash';
import { dropSetting, readSetting, writeSetting } from './web-settings.ts';

declare const MINHAJNA_WEB_VERSION: string | undefined;

/** The screens a report names, the last ones opened, as on the phone. */
export const STEPS_KEPT = 10;

let screens: readonly string[] = [];

const Crash: Spec = {
  reportsOn: () => readSetting('crash-reports') === 'on',
  setReports(on) {
    if (!on) dropSetting('crash-report');
    return writeSetting('crash-reports', on ? 'on' : 'off');
  },
  steps(names) {
    screens = names.slice(-STEPS_KEPT);
  },
  keep(type, frames) {
    if (readSetting('crash-reports') !== 'on') return false;
    const version = typeof MINHAJNA_WEB_VERSION === 'string' ? MINHAJNA_WEB_VERSION : '';
    return writeSetting('crash-report', JSON.stringify({ type, frames, steps: screens, version, android: '' }));
  },
  kept: () => readSetting('crash-report'),
  drop() {
    dropSetting('crash-report');
  },
};

export default Crash;
