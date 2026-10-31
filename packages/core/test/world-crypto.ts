// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A world's MAC and cipher for the tests, as a platform gives them (#556,
// #564): Node's HMAC-SHA256, and AES-256-GCM with a fresh nonce first.

import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { WorldCipher, WorldMac } from '../src/index.ts';

export const mac: WorldMac = (key, data) =>
  Promise.resolve(new Uint8Array(createHmac('sha256', key).update(data).digest()));

export const cipher: WorldCipher = {
  seal: (key, plain, additional) => {
    const nonce = randomBytes(12);
    const seal = createCipheriv('aes-256-gcm', key, nonce).setAAD(additional);
    const sealed = Buffer.concat([nonce, seal.update(plain), seal.final(), seal.getAuthTag()]);
    return Promise.resolve(new Uint8Array(sealed));
  },
  open: (key, sealed, additional) => {
    try {
      const bytes = Buffer.from(sealed);
      const open = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)).setAAD(additional);
      open.setAuthTag(bytes.subarray(-16));
      return Promise.resolve(new Uint8Array(Buffer.concat([open.update(bytes.subarray(12, -16)), open.final()])));
    } catch {
      return Promise.resolve(null);
    }
  },
};
