// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Where the app lock stands (#210). */
export interface LockStatus {
  /** No PIN yet; a PIN set and the history closed; or the history open. */
  state: 'setup' | 'locked' | 'open';
  /** The phone's fingerprint or face prompt can open the history. */
  biometric: boolean;
  /** The phone can match a strong fingerprint or face, and one is enrolled. */
  biometricAvailable: boolean;
  /** Seconds before another PIN may be tried after repeated wrong ones. */
  waitSeconds: number;
  /** A history is kept on this phone, from before the PIN was set. */
  hasHistory: boolean;
}

/** A PIN tried: whether it was right, and any wait it brought. */
export interface PinResult {
  opened: boolean;
  waitSeconds: number;
}

/**
 * The app's own native module (#19, #75). It wraps the platform's audited
 * primitives and SQLCipher; the project writes no cryptography of its own
 * (PRD §6.5). It stores only the history, entry by entry, so no other code
 * can run SQL against the teacher's records. Once a PIN is set, only the
 * lock opens the history (#210).
 */
export interface Spec extends TurboModule {
  /** Secure random bytes from SecureRandom, as lowercase hex. Synchronous. */
  randomBytes(length: number): string;
  /** SHA-256 of each text's UTF-8 bytes, as lowercase hex. Refuses text that is not well-formed. */
  digest(texts: readonly string[]): Promise<string[]>;
  /**
   * Opens the encrypted history, creating it and its key on first use, while
   * no PIN is set. Once one is, rejects with E_LOCKED until the lock opens it.
   */
  openHistory(): Promise<void>;
  lockStatus(): Promise<LockStatus>;
  /** Sets the first PIN, 4 digits, and opens the history under it. */
  createLock(pin: string): Promise<void>;
  /** Opens the history with the PIN, unless a wait is running. A wrong PIN is counted. */
  unlock(pin: string): Promise<PinResult>;
  /** Shows the phone's prompt. Resolves true once the history is open, false when cancelled. */
  unlockWithBiometrics(title: string, subtitle: string, cancel: string): Promise<boolean>;
  /** Turns the phone's prompt on, after the PIN and a first match. A wrong PIN resolves; a closed prompt rejects with E_CANCELLED. */
  enableBiometrics(pin: string, title: string, subtitle: string, cancel: string): Promise<PinResult>;
  disableBiometrics(): Promise<void>;
  changePin(old: string, next: string): Promise<PinResult>;
  /** Closes the history; only the lock opens it again. */
  lockHistory(): Promise<void>;
  /** Every entry, by sequence, as a JSON array. */
  loadHistory(): Promise<string>;
  /** Adds one entry, given as JSON. Resolves only once the write is committed. */
  appendEntry(entry: string): Promise<void>;
  /** Removes the content and salt of the given entries, in one transaction. */
  eraseContent(ids: readonly string[]): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaStorage');
