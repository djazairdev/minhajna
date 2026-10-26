// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The storage module on the web, its first part (#250, answer 501): the
// browser's own secure random bytes and SHA-256, and a lock that stands at
// set-up. The encrypted history, the passphrase (answer 502) and erasing
// the PC come in the next parts; until then each of those steps is refused,
// so nothing is ever kept unencrypted.

import type { LockStatus, Spec } from '../../../android/src/native/NativeMinhajnaStorage';
import { notYet } from './not-yet.ts';

/** Lowercase hex of the bytes. */
export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digest(texts: readonly string[]): Promise<string[]> {
  if (texts.some((text) => !text.isWellFormed())) throw new Error('Text that is not well-formed');
  const encoder = new TextEncoder();
  return Promise.all(
    texts.map(async (text) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text))))),
  );
}

const SETUP: LockStatus = {
  state: 'setup',
  biometric: false,
  biometricAvailable: false,
  waitSeconds: 0,
  hasHistory: false,
};

const Storage: Spec = {
  randomBytes(length) {
    return hex(crypto.getRandomValues(new Uint8Array(length)));
  },
  digest,
  openHistory: () => notYet('The history'),
  lockStatus: () => Promise.resolve(SETUP),
  createLock: () => notYet('The lock'),
  unlock: () => notYet('The lock'),
  unlockWithBiometrics: () => Promise.resolve(false),
  enableBiometrics: () => notYet('The lock'),
  disableBiometrics: () => Promise.resolve(),
  changePin: () => notYet('The lock'),
  lockHistory: () => Promise.resolve(),
  loadHistory: () => notYet('The history'),
  appendEntry: () => notYet('The history'),
  restoreHistory: () => notYet('The history'),
  eraseContent: () => notYet('The history'),
  loadTimings: () => Promise.resolve('[]'),
  addTimings: () => notYet('The timings'),
  clearTimings: () => Promise.resolve(),
  eraseDevice: () => notYet('Erasing this PC'),
};

export default Storage;
