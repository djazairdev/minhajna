// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Entry, HistoryStore } from './history.ts';

/** A store that keeps the history in memory, for tests and previews. */
export class MemoryStore implements HistoryStore {
  #entries: Entry[] = [];

  load(): Promise<readonly Entry[]> {
    return Promise.resolve([...this.#entries]);
  }

  append(entry: Entry): Promise<void> {
    this.#entries.push(entry);
    return Promise.resolve();
  }

  eraseContent(ids: readonly string[]): Promise<void> {
    const erased = new Set(ids);
    this.#entries = this.#entries.map((entry) => (erased.has(entry.id) ? { ...entry, content: null } : entry));
    return Promise.resolve();
  }
}
