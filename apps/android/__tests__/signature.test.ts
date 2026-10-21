// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import vector from '../../../packages/core/test/signature-vector.json';
import signature from '../src/native/NativeMinhajnaSignature';

test('the Jest stand-in checks the shared vector as Android does, and refuses a change', async () => {
  await expect(signature.verify(vector.spki, vector.payload, vector.signature)).resolves.toBe(true);
  await expect(signature.verify(vector.spki, `${vector.payload} `, vector.signature)).resolves.toBe(false);
  await expect(signature.verify('not a key', vector.payload, vector.signature)).resolves.toBe(false);
});
