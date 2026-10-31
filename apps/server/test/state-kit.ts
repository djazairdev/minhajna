// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the stand-in receiving system's tests send (#590, answer 618): a made-up
// device's signing key, sealing for a receiving key step by step as
// apps/android's world-key-crypto.ts seals a key to a device, and a made-up
// term export of two pupils' marks. Every pupil and mark here is made up.

import {
  createCipheriv,
  createHmac,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
  sign,
  verify,
} from 'node:crypto';

export const OPEN = { perAddress: 1000, total: 1000, windowMs: 60_000 };
export const PASS = 'cGFzcy1mb3ItYS1tYWRlLXVwLWRlbW8td29ybGQtMDE';
export const WITH_PASS = { 'x-world-pass': PASS };
const SPKI_HEAD = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');

export interface Signer {
  readonly publicKey: string;
  readonly sign: (text: string) => Promise<string>;
  readonly verify: (publicKey: string, text: string, signature: string) => Promise<boolean>;
}

export type Certificate = { world: string; subject: string; publicKey: string; serial: string };

/** The part of packages/core/src/certify.ts the test calls. */
export interface Core {
  certificateRequest(world: string, subject: string, signer: Signer): Promise<Record<string, string>>;
}

/** A made-up device's ECDSA P-256 key, signing a text's UTF-8 bytes, in base64. */
export function signer(): Signer {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    publicKey: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
    sign: (text) => Promise.resolve(sign('sha256', Buffer.from(text, 'utf8'), privateKey).toString('base64')),
    verify: (key, text, signature) => {
      const pub = createPublicKey({ key: Buffer.from(key, 'base64'), format: 'der', type: 'spki' });
      return Promise.resolve(verify('sha256', Buffer.from(text, 'utf8'), pub, Buffer.from(signature, 'base64')));
    },
  };
}

/** Seals bytes for a receiving key's point, step by step as apps/android's world-key-crypto.ts seals a key. */
export function seal(plain: Buffer, point: string, info: string): string {
  const fresh = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const freshPoint = fresh.publicKey.export({ format: 'der', type: 'spki' }).subarray(-65);
  const theirs = Buffer.from(point, 'hex');
  const publicKey = createPublicKey({ key: Buffer.concat([SPKI_HEAD, theirs]), format: 'der', type: 'spki' });
  const secret = diffieHellman({ privateKey: fresh.privateKey, publicKey });
  const pseudo = createHmac('sha256', Buffer.concat([freshPoint, theirs]))
    .update(secret)
    .digest();
  const key = createHmac('sha256', pseudo)
    .update(Buffer.concat([Buffer.from(info, 'utf8'), Buffer.from([1])]))
    .digest();
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce).setAAD(Buffer.from(info, 'utf8'));
  return Buffer.concat([freshPoint, nonce, cipher.update(plain), cipher.final(), cipher.getAuthTag()]).toString(
    'base64',
  );
}

export const row = (registration: string) => ({
  registration,
  values: { T: 12.5, F: 11, E: 15 },
  average: 13.92,
  appreciation: 'عمل مختلق جيد',
});

export const termExport = (world: string, change: Record<string, unknown> = {}) => ({
  format: 'minhajna/term-export/1',
  world,
  kind: 'marks',
  school: 'school-1',
  term: 1,
  class: '1م2',
  subject: 'math',
  signed: '2026-11-29',
  scale: 20,
  formula: 'cem',
  parts: ['T', 'F', 'E'],
  rows: [row('MADE-UP-0001'), row('MADE-UP-0002')],
  ...change,
});

let ids = 0;
export function freshId(): string {
  ids += 1;
  return `S${String(ids).padStart(4, '0')}`;
}
