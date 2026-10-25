// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Jest has no Android crypto: Node's checks the same ECDSA P-256
// signatures, the way the core's own tests do, and refuses any key that is
// not on P-256, as the phone does. Its ephemeral teacher key lives in test
// memory only. The deliberately blank QR matrix is a bridge/layout stand-in,
// never an encoding oracle; Android tests decode the real ZXing output.

import { createHash, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from 'node:crypto';
import { utf8Length } from '@minhajna/core';
import type { Spec } from '../src/native/NativeMinhajnaSignature';

let teacher: { publicKey: KeyObject; privateKey: KeyObject } | undefined;

function key() {
  teacher ??= generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return teacher;
}

function validText(text: string, limit: number): boolean {
  const bytes = text.length > limit ? null : utf8Length(text);
  return bytes !== null && bytes > 0 && bytes <= limit;
}

export const fakeSignature: Pick<Spec, 'verify' | 'teacherKey' | 'sign' | 'keyFingerprint' | 'qrMatrix'> = {
  teacherKey: () => Promise.resolve(key().publicKey.export({ type: 'spki', format: 'der' }).toString('base64')),
  sign: (payload) => {
    if (!validText(payload, 65_536)) return Promise.reject(new Error('Signing failed'));
    return Promise.resolve(sign('sha256', Buffer.from(payload, 'utf8'), key().privateKey).toString('base64'));
  },
  keyFingerprint: (spki) => {
    try {
      if (spki.length > 200 || !/^[A-Za-z0-9+/]+={0,2}$/.test(spki)) throw new Error('Invalid key');
      const bytes = Buffer.from(spki, 'base64');
      const publicKey = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
      if (publicKey.asymmetricKeyType !== 'ec' || publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1')
        throw new Error('Invalid key');
      return Promise.resolve(createHash('sha256').update(bytes).digest('hex'));
    } catch {
      return Promise.reject(new Error('Signing failed'));
    }
  },
  qrMatrix: (text) =>
    validText(text, 996)
      ? Promise.resolve({ size: 29, rows: Array.from({ length: 29 }, () => '0'.repeat(29)) })
      : Promise.reject(new Error('QR encoding failed')),
  verify: (spki, payload, signature) => {
    try {
      const key = createPublicKey({ key: Buffer.from(spki, 'base64'), format: 'der', type: 'spki' });
      if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1')
        return Promise.resolve(false);
      return Promise.resolve(verify('sha256', Buffer.from(payload, 'utf8'), key, Buffer.from(signature, 'base64')));
    } catch {
      return Promise.resolve(false);
    }
  },
};
