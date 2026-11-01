// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's signing key for the tests, as a platform gives it (#556, #608):
// Node's P-256 over a text's UTF-8 bytes, and a world's keys holding one
// made-up pair as its ministry's key, which signs calendars and packs.

import { createHash, createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';
import type { WorldKeys, WorldSigner } from '../src/index.ts';

export const signWith: WorldSigner = (pkcs8, text) => {
  const key = createPrivateKey({ key: Buffer.from(pkcs8, 'base64'), format: 'der', type: 'pkcs8' });
  return Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), key).toString('base64'));
};

/** A world's keys with a fresh made-up pair as its ministry's key. */
export function worldKeys(world: string): WorldKeys {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const der = publicKey.export({ type: 'spki', format: 'der' });
  const trusted = {
    id: 'world-ministry',
    holder: { ar: 'وزارة مختلقة', en: 'A made-up ministry 𝓜' },
    spki: der.toString('base64'),
    fingerprint: createHash('sha256').update(der).digest('hex'),
    signs: ['calendar' as const, 'packs' as const],
  };
  const pkcs8 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
  return { world, kind: 'national', trusted: [trusted], private: { 'world-ministry': pkcs8 } };
}
