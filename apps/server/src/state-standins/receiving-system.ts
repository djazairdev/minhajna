// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The demo's stand-in for the state's receiving system (#590, choice D9, answer
// 618): one P-256 agreement key for each world, as devices' are (answer 595),
// made the first time the world needs it, kept with the world apart from its CA
// key and erased with it, the one other key the server holds. It opens what a
// device sealed for it alone as apps/android's world-key-crypto.ts seals a key
// to a device: the fresh public half, then AES-256-GCM under a key HKDF-SHA256
// derives from the agreed secret, salted with the fresh and the receiving
// public halves and bound to the delivery's world and kind, which is also the
// cipher's additional data. Node's own import refuses a fresh half that is not
// on the curve, and whatever does not open answers null. It opens nothing else:
// never a school's space.

import { createDecipheriv, createHmac, createPublicKey, diffieHellman, generateKeyPairSync } from 'node:crypto';
import { privateKeyOf } from '../worlds/stand-in-ca.js';

/** The kinds of delivery the state's systems take: marks, and absences where the school chooses. */
export const KINDS = ['marks', 'absences'] as const;
export type DeliveryKind = (typeof KINDS)[number];

/** An uncompressed P-256 point's length, and the DER that makes it an SPKI. */
const POINT = 65;
const SPKI_HEAD = Buffer.from('3059301306072a8648ce3d020106082a8648ce3d030107034200', 'hex');
/** The shortest sealed delivery: the fresh point, the cipher's nonce and its tag. */
export const SHORTEST = POINT + 12 + 16;

/** A new receiving key, as the store keeps it: its PKCS #8 DER in base64. */
export function newReceiverKey(): string {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
}

/** The receiving key's public half, the uncompressed point devices seal for, in hex. */
export function receiverPoint(key: string): string {
  const spki = createPublicKey(privateKeyOf(key)).export({ format: 'der', type: 'spki' });
  return spki.subarray(spki.length - POINT).toString('hex');
}

/** What a delivery of a kind to a world is bound to. */
export const deliveryInfo = (world: string, kind: DeliveryKind) => `minhajna/state-delivery/1\n${world}\n${kind}`;

/** HKDF-SHA256 to 32 bytes: one extract, one block of expand. */
function hkdf(secret: Buffer, salt: Buffer, info: string): Buffer {
  const pseudo = createHmac('sha256', salt).update(secret).digest();
  return createHmac('sha256', pseudo)
    .update(Buffer.concat([Buffer.from(info, 'utf8'), Buffer.from([1])]))
    .digest();
}

/** Opens what a device sealed for the receiving key under `info`, or null when it does not open. */
export function openDelivery(sealed: Buffer, key: string, info: string): Buffer | null {
  if (sealed.length < SHORTEST) return null;
  const fresh = sealed.subarray(0, POINT);
  try {
    const publicKey = createPublicKey({ key: Buffer.concat([SPKI_HEAD, fresh]), format: 'der', type: 'spki' });
    const secret = diffieHellman({ privateKey: privateKeyOf(key), publicKey });
    const sealing = hkdf(secret, Buffer.concat([fresh, Buffer.from(receiverPoint(key), 'hex')]), info);
    const body = sealed.subarray(POINT);
    const open = createDecipheriv('aes-256-gcm', sealing, body.subarray(0, 12)).setAAD(Buffer.from(info, 'utf8'));
    open.setAuthTag(body.subarray(body.length - 16));
    return Buffer.concat([open.update(body.subarray(12, body.length - 16)), open.final()]);
  } catch {
    return null;
  }
}
