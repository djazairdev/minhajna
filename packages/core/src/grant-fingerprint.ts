// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The fingerprint of an inspector's key (#553, #593, answers 563 and 621): 64
// bits of a MAC of its public key, in four groups of hex, which the
// inspector's app shows and the inspectorate's official message carries, and
// how a fingerprint typed compares: without case, spaces, hyphens or dashes,
// on M-Grant and on the director's access page alike.

import { toHex } from './id.ts';
import { ascii, fromHex, type KeyCrypto } from './school-key-shape.ts';

/** The fingerprint of an inspector's key that its app shows and the director confirms: 64 bits in four groups. */
export async function inspectorFingerprint(publicKey: string, crypto: KeyCrypto): Promise<string> {
  const mac = toHex(await crypto.mac(fromHex(publicKey), ascii('minhajna/grant/inspector')));
  return (mac.slice(0, 16).match(/.{4}/gu) ?? []).join('-');
}

/** A fingerprint as typed, to compare: lower case, without spaces, hyphens or dashes. */
export const plainFingerprint = (typed: string) => typed.toLowerCase().replace(/[\s\u2010-\u2015-]/gu, '');
