// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Made-up source packs and ephemeral P-256 signatures for #612. The key
// stays in makeTestKey's closure: its synthetic handle is never key material.
// `attest` gives a release the signature an account's step gets from the
// server.

import {
  packDigest,
  packStepText,
  preparePackRelease,
  signPackRelease,
  type PackChange,
  type PackPublisher,
  type PackRelease,
  type PackReview,
  type ReviewRole,
  type ReviewVerdict,
  type WorldKeys,
  type WorldSigner,
} from '../src/index.ts';
import { d, mathPack } from './fixtures.ts';
import { makeTestKey, nodeVerifier } from './signed-fixtures.ts';
import { mac } from './world-crypto.ts';

export const source = {
  ...mathPack,
  status: 'community' as const,
  provenance: { issuer: 'Made-up issuer', edition: 'Made-up edition' },
  items: mathPack.items.map((item, at) => (at === 0 ? { ...item, title: 'درس مختلق للتجربة' } : item)),
};
export const day = d('2026-11-01');
export const world = 'ABCDE';

const SEALING = new Uint8Array(32).fill(7);

export const approval = (role: ReviewRole, name: string | null, verdict: ReviewVerdict = 'approved'): PackReview => ({
  role,
  verdict,
  name,
  note: '',
  day,
});

export function fixture() {
  const key = makeTestKey('world-ministry');
  const ca = makeTestKey('world-ca');
  const authority = { caKey: ca.trusted.spki, sealing: SEALING, mac, verify: nodeVerifier };
  const attest = async (release: PackRelease): Promise<PackRelease> => ({
    ...release,
    attested: ca.sign(packStepText(release, await packDigest(release, SEALING, mac))),
  });
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
    const signed = await signPackRelease(await attest(prepared), keys, sign);
    records.push(signed.file);
    return signed.release;
  }
  async function approved(review: PackRelease) {
    const first = await change(review, { stage: 'under-review', review: approval('curator', 'Made-up Curator') });
    return change(first, { stage: 'under-review', review: approval('maintainer', 'Made-up Maintainer') });
  }
  async function published(release = '2026.1', actor: PackPublisher = 'curator') {
    const draft = await change(null, { stage: 'draft', pack: { ...source, release } });
    const review = await change(draft, { stage: 'under-review' });
    return change(await approved(review), { stage: 'published' }, actor);
  }
  return {
    approved,
    keys,
    key,
    sign,
    records,
    change,
    published,
    authority,
    attest,
    ca,
  };
}
