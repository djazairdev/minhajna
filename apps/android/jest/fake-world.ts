// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Spec } from '../src/native/NativeMinhajnaWorld';
import { FakeStorage } from './fake-storage';

/**
 * The world module in Node, for Jest: one FakeStorage for each world, by
 * ID, one world open at a time, and the teacher's history shut while one
 * is, as WorldGate shuts it on the phone.
 */
export class FakeWorld {
  readonly worlds = new Map<string, FakeStorage>();
  open: string | null = null;

  constructor(private readonly teacher: FakeStorage) {}

  enterWorld(world: string): Promise<void> {
    if (!/^[0-9A-HJKMNP-TV-Z]{5}$/.test(world)) return Promise.reject(new Error('Bad world'));
    if (this.open !== null && this.open !== world) return Promise.reject(new Error('Another world is open'));
    this.open = world;
    this.teacher.worldOpen = true;
    const history = this.worlds.get(world) ?? new FakeStorage();
    this.worlds.set(world, history);
    return history.openHistory();
  }

  leaveWorld(): Promise<void> {
    this.open = null;
    this.teacher.worldOpen = false;
    return Promise.resolve();
  }

  loadHistory(): Promise<string> {
    return this.#opened().loadHistory();
  }

  appendEntry(entry: string): Promise<void> {
    return this.#opened().appendEntry(entry);
  }

  eraseContent(ids: readonly string[]): Promise<void> {
    return this.#opened().eraseContent(ids);
  }

  async eraseWorld(world: string): Promise<void> {
    if (this.open === world) await this.leaveWorld();
    this.worlds.delete(world);
  }

  #opened(): FakeStorage {
    const history = this.open === null ? undefined : this.worlds.get(this.open);
    if (history === undefined) throw new Error('No world is open');
    return history;
  }

  asSpec(): Spec {
    return this;
  }
}
