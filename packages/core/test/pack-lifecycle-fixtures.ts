// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up source packs and ephemeral P-256 signatures for #612. The key
// stays in makeTestKey's closure: its synthetic handle is never key material.

import {
  preparePackRelease,
  signPackRelease,
  type PackChange,
  type PackPublisher,
  type PackRelease,
  type WorldKeys,
  type WorldSigner,
} from '../src/index.ts';
import { d, mathPack } from './fixtures.ts';
import { makeTestKey } from './signed-fixtures.ts';

export const source = {
  ...mathPack,
  status: 'community' as const,
  provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition' },
  items: mathPack.items.map((item, at) => (at === 0 ? { ...item, title: 'درس مختلق للتجربة' } : item)),
};
export const day = d('2026-11-01');
export const world = 'ABCDE';

export function fixture() {
  const key = makeTestKey('world-ministry');
  const keys: WorldKeys = {
    world,
    kind: 'national',
    trusted: [key.trusted],
    private: { 'world-ministry': 'synthetic-handle' },
  };
  const sign: WorldSigner = (_half, text) => Promise.resolve(key.sign(text));
  const records: string[] = [];
  async function change(
    current: PackRelease | null,
    action: PackChange,
    actor: PackPublisher = 'curator',
    successor: PackRelease | null = null,
  ) {
    const prepared = preparePackRelease(
      current,
      action,
      { world, day, actor, expected: current?.revision ?? 0 },
      successor,
    );
    const signed = await signPackRelease(prepared, keys, sign);
    records.push(signed.file);
    return signed.release;
  }
  async function published(release = '2026.1', actor: PackPublisher = 'curator') {
    const draft = await change(null, { stage: 'draft', pack: { ...source, release } });
    const review = await change(draft, { stage: 'under-review' });
    return change(review, { stage: 'published' }, actor);
  }
  return { keys, key, sign, records, change, published };
}
