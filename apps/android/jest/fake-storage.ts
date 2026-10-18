// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash, randomBytes } from 'node:crypto';
import type { LockStatus, PinResult, Spec } from '../src/native/NativeMinhajnaStorage';

interface Row {
  seq: number;
  id: string;
  day: string;
  layer: string;
  kind: string;
  digest: string;
  previous: string;
  hash: string;
  salt: string | null;
  body: string | null;
}

const PIN = /^[0-9]{4}$/;

/** The wait after the given count of wrong PINs in a row, as LockAttempts.kt counts it. */
export function waitFor(failures: number): number {
  if (failures <= 4) return 0;
  return Math.min(30 * 2 ** Math.min(failures - 5, 7), 3600);
}

function failure(code: string, message = code): Error {
  return Object.assign(new Error(message), { code });
}

/**
 * The native module's behaviour in Node, for Jest: Node's SHA-256 and random
 * bytes, the database's rules (entries added in order, only content erased)
 * and the lock's (#210). The device tests check the real module against the
 * same rules. Errors carry the native module's codes.
 */
export class FakeStorage {
  rows: Row[] = [];
  opened = false;
  /** Set to make `openHistory` fail, as when the key is gone. */
  keyLost = false;
  created = false;
  /** The lock's PIN once set; the fake keeps it plain, the device never does. */
  pin: string | null = null;
  biometric = false;
  biometricAvailable = false;
  /** What the phone's prompt does when shown. */
  prompt: 'match' | 'cancel' = 'match';
  failures = 0;
  waitUntil = 0;
  now: () => number = () => Date.now();

  /** A fake whose PIN is set and whose history is open, as after an unlock. */
  static unlocked(pin = '1234'): FakeStorage {
    const storage = new FakeStorage();
    storage.pin = pin;
    storage.opened = true;
    storage.created = true;
    return storage;
  }

  randomBytes(length: number): string {
    return randomBytes(length).toString('hex');
  }

  /** Refuses text with a lone surrogate, which does not survive UTF-8 and back, as on the device. */
  digest(texts: readonly string[]): Promise<string[]> {
    const wellFormed = (text: string) => Buffer.from(text, 'utf8').toString('utf8') === text;
    if (!texts.every(wellFormed)) return Promise.reject(new Error('E_NOT_WELL_FORMED'));
    return Promise.resolve(texts.map((text) => createHash('sha256').update(text, 'utf8').digest('hex')));
  }

  openHistory(): Promise<void> {
    if (this.pin !== null) return this.opened ? Promise.resolve() : Promise.reject(failure('E_LOCKED'));
    if (this.keyLost) return Promise.reject(failure('E_KEY_LOST'));
    this.opened = true;
    this.created = true;
    return Promise.resolve();
  }

  lockStatus(): Promise<LockStatus> {
    return Promise.resolve({
      state: this.pin === null ? 'setup' : this.opened ? 'open' : 'locked',
      biometric: this.biometric,
      biometricAvailable: this.biometricAvailable,
      waitSeconds: this.#wait(),
      hasHistory: this.created,
    });
  }

  createLock(pin: string): Promise<void> {
    if (this.pin !== null || !PIN.test(pin)) return Promise.reject(failure('E_HISTORY'));
    if (this.keyLost) return Promise.reject(failure('E_KEY_LOST'));
    this.pin = pin;
    this.opened = true;
    this.created = true;
    return Promise.resolve();
  }

  unlock(pin: string): Promise<PinResult> {
    if (this.pin === null) return Promise.reject(failure('E_HISTORY'));
    if (this.keyLost) return Promise.reject(failure('E_KEY_LOST'));
    const result = this.#try(pin);
    if (result.opened) this.opened = true;
    return Promise.resolve(result);
  }

  unlockWithBiometrics(title: string, _subtitle: string, cancel: string): Promise<boolean> {
    if (!title.trim() || !cancel.trim()) return Promise.reject(failure('E_HISTORY'));
    if (!this.biometric || this.prompt === 'cancel') return Promise.resolve(false);
    this.opened = true;
    this.failures = 0;
    this.waitUntil = 0;
    return Promise.resolve(true);
  }

  enableBiometrics(pin: string, title: string, _subtitle: string, cancel: string): Promise<PinResult> {
    if (!this.opened || this.pin === null) return Promise.reject(failure('E_LOCKED'));
    if (!title.trim() || !cancel.trim()) return Promise.reject(failure('E_HISTORY'));
    if (!this.biometricAvailable) return Promise.reject(failure('E_HISTORY'));
    const result = this.#try(pin);
    if (!result.opened) return Promise.resolve(result);
    this.biometric = this.prompt === 'match';
    if (!this.biometric) return Promise.reject(failure('E_CANCELLED'));
    return Promise.resolve({ opened: true, waitSeconds: 0 });
  }

  disableBiometrics(): Promise<void> {
    if (!this.opened || this.pin === null) return Promise.reject(failure('E_LOCKED'));
    this.biometric = false;
    return Promise.resolve();
  }

  changePin(old: string, next: string): Promise<PinResult> {
    if (!this.opened || this.pin === null) return Promise.reject(failure('E_LOCKED'));
    if (!PIN.test(next)) return Promise.reject(failure('E_HISTORY'));
    const result = this.#try(old);
    if (result.opened) this.pin = next;
    return Promise.resolve(result);
  }

  lockHistory(): Promise<void> {
    if (this.pin !== null) this.opened = false;
    return Promise.resolve();
  }

  loadHistory(): Promise<string> {
    return this.#whenOpen(() => JSON.stringify(this.rows));
  }

  appendEntry(entry: string): Promise<void> {
    return this.#whenOpen(() => {
      const row = JSON.parse(entry) as Row;
      if (row.seq !== this.rows.length) throw new Error('entries are added in order');
      this.rows.push(row);
    });
  }

  eraseContent(ids: readonly string[]): Promise<void> {
    return this.#whenOpen(() => {
      for (const row of this.rows) {
        if (ids.includes(row.id)) {
          row.salt = null;
          row.body = null;
        }
      }
    });
  }

  asSpec(): Spec {
    return this;
  }

  #wait(): number {
    return Math.max(0, Math.ceil((this.waitUntil - this.now()) / 1000));
  }

  #try(pin: string): PinResult {
    const wait = this.#wait();
    if (wait > 0) return { opened: false, waitSeconds: wait };
    if (pin === this.pin) {
      this.failures = 0;
      this.waitUntil = 0;
      return { opened: true, waitSeconds: 0 };
    }
    this.failures = Math.min(this.failures + 1, 64);
    const next = waitFor(this.failures);
    this.waitUntil = this.now() + next * 1000;
    return { opened: false, waitSeconds: next };
  }

  #whenOpen<T>(task: () => T): Promise<T> {
    if (!this.opened) return Promise.reject(failure('E_HISTORY', 'The history is not open'));
    try {
      return Promise.resolve(task());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
