// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The storage module on the web (#250): the browser's own secure random
// bytes and SHA-256, and the history sealed under the teacher's passphrase
// in this browser's IndexedDB (part 2, answer 502). The PIN steps take the
// passphrase. A PC has no fingerprint, so that prompt never shows. Each
// step that touches the vault runs after the one before. Erasing the PC
// comes in part 4; until then it is refused.

import type { Spec } from '../../../android/src/native/NativeMinhajnaStorage';
import { notYet } from './not-yet.ts';
import * as history from './vault/history.ts';
import {
  changePassphrase,
  coded,
  createLock,
  lockHistory,
  lockStatus,
  openedKey,
  serial,
  unlock,
} from './vault/lock.ts';

/** Lowercase hex of the bytes. */
export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(texts: readonly string[]): Promise<string[]> {
  if (texts.some((text) => !text.isWellFormed())) throw coded('Text that is not well-formed', 'E_NOT_WELL_FORMED');
  const encoder = new TextEncoder();
  return Promise.all(
    texts.map(async (text) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))))),
  );
}

const Storage: Spec = {
  randomBytes(length) {
    return hex(crypto.getRandomValues(new Uint8Array(length)));
  },
  digest,
  openHistory: () =>
    serial(() => {
      openedKey();
      return Promise.resolve();
    }),
  lockStatus,
  createLock,
  unlock,
  unlockWithBiometrics: () => Promise.resolve(false),
  enableBiometrics: () => Promise.reject(coded('A PC has no fingerprint prompt', 'E_CANCELLED')),
  disableBiometrics: () => Promise.resolve(),
  changePin: changePassphrase,
  lockHistory,
  loadHistory: () => serial(history.loadHistory),
  appendEntry: (entry) => serial(() => history.appendEntry(entry)),
  appendEntries: (entries) => serial(() => history.appendEntries(entries)),
  restoreHistory: (entries) => serial(() => history.restoreHistory(entries)),
  eraseContent: (ids) => serial(() => history.eraseContent(ids)),
  loadTimings: () => serial(history.loadTimings),
  addTimings: (timings) => serial(() => history.addTimings(timings)),
  clearTimings: () => serial(history.clearTimings),
  eraseDevice: () => notYet('Erasing this PC'),
};

export default Storage;
