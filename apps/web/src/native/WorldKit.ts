// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The world kit module on a PC (#561): the PC hands the app its Web Crypto kit
// directly (world-kit.ts), so this is that kit behind the phone's module, bytes
// as lowercase hex, its key agreement too, for any code that reaches the
// module, and every failure is E_WORLD_KIT, as on the phone. A PC may always
// connect to the demo server, which its page's policy names.

import { toHex } from '@minhajna/core';
import type { Spec } from '../../../android/src/native/NativeMinhajnaWorldKit';
import { fromHex } from '../../../android/src/storage/history.ts';
import { refused } from './files/picked.ts';
import { worldKit } from './world-kit.ts';

/** The kit's answer, or E_WORLD_KIT for any failure, saying nothing of the bytes. */
async function kitted<T>(step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch {
    throw refused('E_WORLD_KIT', "The world's cryptography failed");
  }
}

const WorldKit: Spec = {
  canConnect: () => true,
  derive: (secret, salt, rounds) =>
    kitted(async () => toHex(await worldKit.kdf(fromHex(secret), fromHex(salt), rounds))),
  mac: (key, data) => kitted(async () => toHex(await worldKit.mac(fromHex(key), fromHex(data)))),
  seal: (key, plain, additional) =>
    kitted(async () => toHex(await worldKit.cipher.seal(fromHex(key), fromHex(plain), fromHex(additional)))),
  open: (key, sealed, additional) =>
    kitted(async () => {
      const plain = await worldKit.cipher.open(fromHex(key), fromHex(sealed), fromHex(additional));
      return plain === null ? null : toHex(plain);
    }),
  sign: (pkcs8, text) => kitted(() => worldKit.sign(pkcs8, text)),
  newPair: () => kitted(() => worldKit.newPair()),
  newAgreement: () =>
    kitted(async () => {
      const pair = await worldKit.newAgreement();
      return { publicKey: toHex(pair.publicKey), pkcs8: pair.pkcs8 };
    }),
  agree: (pkcs8, publicKey) => kitted(async () => toHex(await worldKit.agree(pkcs8, fromHex(publicKey)))),
};

export default WorldKit;
