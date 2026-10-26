// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The lock's settings on the web (#250): the delay, 1, 5 or 15 minutes, and
// the screenshot choice, kept in the browser like the phone's. A browser
// cannot stop screenshots, so `showing` guards nothing here.

import type { LockSettings, Spec } from '../../../android/src/native/NativeMinhajnaLock';
import { readSetting, writeSetting } from './web-settings.ts';

const DELAYS = new Set([1, 5, 15]);

function refused(): Promise<void> {
  return Promise.reject(Object.assign(new Error('The setting was not kept'), { code: 'E_SETTING' }));
}

const Lock: Spec = {
  settings(): LockSettings {
    const delay = Number(readSetting('lock-delay'));
    return { delayMinutes: DELAYS.has(delay) ? delay : 5, screenshots: readSetting('lock-screenshots') === 'true' };
  },
  setDelay(minutes) {
    return DELAYS.has(minutes) && writeSetting('lock-delay', String(minutes)) ? Promise.resolve() : refused();
  },
  allowScreenshots(allowed) {
    return writeSetting('lock-screenshots', String(allowed)) ? Promise.resolve() : refused();
  },
  showing() {
    return;
  },
};

export default Lock;
