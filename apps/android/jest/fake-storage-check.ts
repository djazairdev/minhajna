// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Spec } from '../src/native/NativeMinhajnaStorageCheck';
import { FakeStorage } from './fake-storage';

/**
 * The debug-only check module in Node, for Jest: one FakeStorage for each
 * throwaway history, by name, with the native module's name rule.
 */
export class FakeStorageCheck {
  readonly histories = new Map<string, FakeStorage>();
  /** Every name ever opened, deleted or not. */
  readonly opened: string[] = [];

  constructor(private readonly make: () => FakeStorage = () => new FakeStorage()) {}

  openHistory(name: string): Promise<void> {
    if (!/^[a-z0-9-]{1,40}$/.test(name)) return Promise.reject(new Error('Bad name'));
    let history = this.histories.get(name);
    if (!history) {
      history = this.make();
      this.histories.set(name, history);
      this.opened.push(name);
    }
    return history.openHistory();
  }

  loadHistory(name: string): Promise<string> {
    return this.#history(name).loadHistory();
  }

  appendEntry(name: string, entry: string): Promise<void> {
    return this.#history(name).appendEntry(entry);
  }

  eraseContent(name: string, ids: readonly string[]): Promise<void> {
    return this.#history(name).eraseContent(ids);
  }

  readCommitted(name: string): Promise<string> {
    return Promise.resolve(JSON.stringify(this.#history(name).rows));
  }

  deleteHistory(name: string): Promise<void> {
    this.histories.delete(name);
    return Promise.resolve();
  }

  asSpec(): Spec {
    return this;
  }

  #history(name: string): FakeStorage {
    const history = this.histories.get(name);
    if (!history) throw new Error('The history is not open');
    return history;
  }
}
