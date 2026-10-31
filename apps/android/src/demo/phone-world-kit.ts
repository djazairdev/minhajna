// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The cryptography a demo world needs on the phone (#561, answers 568 and
// 572), from the phone's own native code, as the PC's comes from Web Crypto:
// the world kit module for the derivation, the MAC, the sealing and the
// world's stand-in signing key, the storage's SecureRandom for random bytes,
// and the signature module's check, which every signed file already uses.
// Bytes cross the bridge as lowercase hex. The phone's start hands it to the
// app, so the PC's bundle never asks for it.

import { toHex } from '@minhajna/core';
import type { Spec as SignatureSpec } from '../native/NativeMinhajnaSignature';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import type { Spec as KitSpec } from '../native/NativeMinhajnaWorldKit';
import { fromHex } from '../storage/history';
import type { WorldKit } from './world-session';

/** A world kit over the phone's native modules. */
export function phoneWorldKit(
  kit: KitSpec,
  storage: Pick<StorageSpec, 'randomBytes'>,
  signature: Pick<SignatureSpec, 'verify'>,
): WorldKit {
  return {
    random: (length) => fromHex(storage.randomBytes(length)),
    kdf: async (secret, salt, rounds) => fromHex(await kit.derive(toHex(secret), toHex(salt), rounds)),
    mac: async (key, data) => fromHex(await kit.mac(toHex(key), toHex(data))),
    cipher: {
      seal: async (key, plain, additional) => fromHex(await kit.seal(toHex(key), toHex(plain), toHex(additional))),
      async open(key, sealed, additional) {
        const plain = await kit.open(toHex(key), toHex(sealed), toHex(additional));
        return plain === null ? null : fromHex(plain);
      },
    },
    sign: (pkcs8, text) => kit.sign(pkcs8, text),
    verify: (spki, payload, signed) => signature.verify(spki, payload, signed),
    newPair: () => kit.newPair(),
  };
}
