// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The app lock's rules that need no phone (#210): how long a wait reads,
// when the app has gone unused long enough to lock, and how long a PC's
// passphrase must be (#250). The PIN itself, its count of wrong tries and
// its waits are kept by the native module, never here, so that a reload of
// the JavaScript cannot reset them.

/** A PIN is exactly this many digits (answer 227). */
export const PIN_LENGTH = 4;

/** A PC's passphrase is at least this many characters (answer 502), and at most this many. */
export const PASSPHRASE_MIN = 12;
export const PASSPHRASE_MAX = 1024;

/** A passphrase's length in characters, in the one Unicode form the PC compares it in. */
export function passphraseLength(passphrase: string): number {
  return [...passphrase.normalize('NFC')].length;
}

/** The automatic lock's delays the teacher can choose, in minutes; 5 by default (R-6.4-05). */
export const LOCK_DELAYS = [1, 5, 15] as const;
export type LockDelay = (typeof LOCK_DELAYS)[number];
export const DEFAULT_LOCK_DELAY: LockDelay = 5;

/** A wait shown in whole seconds under a minute, else in minutes rounded up, so it never reads shorter than it is. */
export function waitWording(seconds: number): { key: 'lock.waitSeconds' | 'lock.waitMinutes'; count: number } {
  if (seconds < 60) return { key: 'lock.waitSeconds', count: Math.max(1, Math.ceil(seconds)) };
  return { key: 'lock.waitMinutes', count: Math.ceil(seconds / 60) };
}

/** Whether the app has gone unused for the whole delay. A clock that went back counts as unused, so it locks. */
export function idleLongEnough(lastUsed: number, now: number, minutes: number): boolean {
  return now < lastUsed || now - lastUsed >= minutes * 60_000;
}

/** Adds a digit to a PIN being typed, up to its length. */
export function typed(pin: string, digit: string): string {
  return pin.length < PIN_LENGTH && /^[0-9]$/.test(digit) ? pin + digit : pin;
}

/** The native module's error code, such as E_KEY_LOST, or undefined for any other failure. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}
