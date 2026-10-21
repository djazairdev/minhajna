// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Jest has no Android crypto: Node's checks the same ECDSA P-256
// signatures, the way the core's own tests do, and refuses any key that is
// not on P-256, as the phone does.

import { createPublicKey, verify } from 'node:crypto';
import type { Spec } from '../src/native/NativeMinhajnaSignature';

export const fakeSignature: Pick<Spec, 'verify'> = {
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
