// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The platform a seeded world's tests stand in for (#548, answer 625): Node's
// P-256 signing pairs and X25519 agreement pairs, the second made from a seed
// so a test opens what was sealed for it from its PKCS #8 alone, with the
// school devices' crypto; and the seeded national world of the bundled
// reference data. Every key and name is made up.

import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import {
  parseCountryProfile,
  parsePlanPack,
  seedNationalWorld,
  type DemoWorld,
  type KeyCrypto,
  type PlanPack,
  type SeedKit,
} from '../src/index.ts';
import { fromHex } from '../src/school-key-shape.ts';
import { keySigner } from './key-signers.ts';
import { device, random } from './school-devices.ts';
import { cipher, mac } from './world-crypto.ts';
import { signWith } from './world-signing.ts';

/** X25519's PKCS #8 before its 32-byte private key. */
const X25519_PKCS8 = fromHex('302e020100300506032b656e04220420');

/** The crypto of the device whose agreement key's private half a PKCS #8 holds. */
export async function cryptoOf(pkcs8: string): Promise<KeyCrypto> {
  return (await device(new Uint8Array(Buffer.from(pkcs8, 'base64').subarray(X25519_PKCS8.length)))).crypto;
}

export async function seedKit(): Promise<SeedKit> {
  return {
    random,
    mac,
    cipher,
    crypto: (await device()).crypto,
    sign: signWith,
    verify: keySigner().verify,
    newPair: () => {
      const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      const spki = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
      return Promise.resolve({ spki, pkcs8: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64') });
    },
    newAgreement: async () => {
      const seed = random(32);
      const made = await device(seed);
      const pkcs8 = Buffer.from([...X25519_PKCS8, ...seed]).toString('base64');
      return { publicKey: fromHex(made.holder.publicKey), pkcs8 };
    },
  };
}

const data = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../../../data/dz/${path}`, import.meta.url), 'utf8'));

/** The seeded national world of the bundled reference data. */
export function nationalWorld(world: string): DemoWorld {
  const profile = parseCountryProfile(data('profile.json'));
  assert.ok(profile.ok);
  const packs: PlanPack[] = readdirSync(new URL('../../../data/dz/packs/', import.meta.url)).map((file) => {
    const read = parsePlanPack(data(`packs/${file}`));
    assert.ok(read.ok);
    return read.value;
  });
  return seedNationalWorld(world, profile.value.zones ?? [], profile.value.workingDays, packs);
}
