// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the server keeps of the pack desk (#612, R-6.7-02, answer 767): a
// world's pack-editor accounts, one for each role, as their tokens' hashes, and
// each release's steps, at most MAX_PACK_STEPS a world, erased with the world.
// A step names no person. A step taken again at a revision replaces what was
// there and those after it; this is a log, and the sealed stream of releases
// decides which of two steps at once counts. In memory here, and in PostgreSQL
// in prisma-packs.ts.

import type { PackRole, PackStep } from './pack-rules.js';

export const MAX_PACK_STEPS = 5000;
export const PACK_STORE = Symbol('PackStore');

export interface PackStore {
  /** Keeps the role's account as this token's hash, replacing any before it; false without the world. */
  setAccount(world: string, role: PackRole, tokenHash: string): Promise<boolean>;
  /** The role of the world's account with this token's hash. */
  accountRole(world: string, tokenHash: string): Promise<PackRole | undefined>;
  /** Keeps a step, replacing it and any later ones of its release; refused past the cap or without the world. */
  putStep(world: string, step: PackStep): Promise<'kept' | 'full' | 'no-world'>;
  /** Each release's latest step, in order of pack and release. */
  latestSteps(world: string): Promise<PackStep[]>;
  /** Forgets what erased worlds kept; PostgreSQL erases it with the world. */
  forget(worlds: readonly string[]): Promise<void>;
}

export class MemoryPackStore implements PackStore {
  private readonly accounts = new Map<string, Map<PackRole, string>>();
  private readonly kept = new Map<string, PackStep[]>();

  constructor(private readonly exists: (world: string) => Promise<boolean> = () => Promise.resolve(true)) {}

  async setAccount(world: string, role: PackRole, tokenHash: string): Promise<boolean> {
    if (!(await this.exists(world))) return false;
    const held = this.accounts.get(world) ?? new Map<PackRole, string>();
    this.accounts.set(world, held.set(role, tokenHash));
    return true;
  }

  accountRole(world: string, tokenHash: string): Promise<PackRole | undefined> {
    const found = [...(this.accounts.get(world) ?? [])].find(([, hash]) => hash === tokenHash);
    return Promise.resolve(found?.[0]);
  }

  async putStep(world: string, step: PackStep): Promise<'kept' | 'full' | 'no-world'> {
    if (!(await this.exists(world))) return 'no-world';
    const others = (this.kept.get(world) ?? []).filter(
      (one) => one.id !== step.id || one.release !== step.release || one.revision < step.revision,
    );
    if (others.length >= MAX_PACK_STEPS) return 'full';
    this.kept.set(world, [...others, step]);
    return 'kept';
  }

  latestSteps(world: string): Promise<PackStep[]> {
    const latest = new Map<string, PackStep>();
    for (const step of this.kept.get(world) ?? []) {
      const key = `${step.id}@${step.release}`;
      const known = latest.get(key);
      if (known === undefined || known.revision < step.revision) latest.set(key, step);
    }
    const byName = (a: PackStep, b: PackStep) => a.id.localeCompare(b.id) || a.release.localeCompare(b.release);
    return Promise.resolve([...latest.values()].sort(byName));
  }

  forget(worlds: readonly string[]): Promise<void> {
    for (const world of worlds) {
      this.accounts.delete(world);
      this.kept.delete(world);
    }
    return Promise.resolve();
  }
}
