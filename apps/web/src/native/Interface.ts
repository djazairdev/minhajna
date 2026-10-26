// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The interface module on the web (#250): the language and the screens'
// settings kept in the browser, a restart that reloads the page so a new
// direction applies, focus by view tag, the screen kept awake while a code
// is shown, where the browser allows it, and the first screen marked for the
// browser's performance tools. Nothing leaves the PC.

import type { Spec } from '../../../android/src/native/NativeMinhajnaInterface';
import { focusTag } from '../view-tags.ts';
import { keptLanguage, readSetting, writeSetting } from './web-settings.ts';

const KEY = /^[a-z0-9-]{1,64}$/u;
let wake: WakeLockSentinel | null = null;
let wanted = false;

/** Keeps the screen awake, or lets it sleep, however the browser's answer and the next call cross. */
function keepAwake(on: boolean) {
  wanted = on;
  if (!on) {
    void wake?.release().catch(() => undefined);
    wake = null;
    return;
  }
  if (wake !== null || !('wakeLock' in navigator)) return;
  navigator.wakeLock.request('screen').then(
    (sentinel) => {
      if (wanted && wake === null) wake = sentinel;
      else void sentinel.release().catch(() => undefined);
    },
    () => undefined,
  );
}

const Interface: Spec = {
  language: keptLanguage,
  setLanguage(code) {
    if (!writeSetting('language', code)) throw new Error('E_SETTING');
  },
  setting(key) {
    return KEY.test(key) ? readSetting(`setting:${key}`) : null;
  },
  setSetting(key, value) {
    if (!KEY.test(key) || value.length > 4096 || !writeSetting(`setting:${key}`, value)) throw new Error('E_SETTING');
  },
  restart() {
    location.reload();
  },
  focusView: focusTag,
  cancelFocusRequest() {
    return;
  },
  reportFullyDrawn() {
    performance.mark('minhajna-fully-drawn');
  },
  keepScreenOn: keepAwake,
};

export default Interface;
