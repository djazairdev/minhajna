// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash, randomBytes } from 'node:crypto';
import type { Spec } from '../src/native/NativeMinhajnaStorage';

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

/**
 * The native module's behaviour in Node, for Jest: Node's SHA-256 and random
 * bytes, and the database's rules (entries added in order, only content
 * erased). The device tests check the real module against the same rules.
 */
export class FakeStorage {
  rows: Row[] = [];
  opened = false;
  /** Set to make `openHistory` fail, as when the key is gone. */
  keyLost = false;

  randomBytes(length: number): string {
    return randomBytes(length).toString('hex');
  }

  digest(texts: readonly string[]): Promise<string[]> {
    // A lone surrogate does not survive UTF-8 and back, as on the device.
    const wellFormed = (text: string) => Buffer.from(text, 'utf8').toString('utf8') === text;
    if (!texts.every(wellFormed)) return Promise.reject(new Error('E_NOT_WELL_FORMED'));
    return Promise.resolve(texts.map((text) => createHash('sha256').update(text, 'utf8').digest('hex')));
  }

  openHistory(): Promise<void> {
    if (this.keyLost) return Promise.reject(new Error('E_KEY_LOST'));
    this.opened = true;
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

  #whenOpen<T>(task: () => T): Promise<T> {
    if (!this.opened) return Promise.reject(new Error('The history is not open'));
    try {
      return Promise.resolve(task());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
