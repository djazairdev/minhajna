// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { createHash, createPublicKey } from 'node:crypto';
import signature from '../src/native/NativeMinhajnaSignature';
import { teacherKeyFingerprint } from '../src/sharing/teacher-key';

test('the teacher key is a stable P-256 public key across calls', async () => {
  const spki = await signature.teacherKey();
  expect(await signature.teacherKey()).toBe(spki);
  const key = createPublicKey({ key: Buffer.from(spki, 'base64'), type: 'spki', format: 'der' });
  expect(key.asymmetricKeyDetails?.namedCurve).toBe('prime256v1');
});

test('the native stand-in signs exact UTF-8 bytes and rejects a changed payload', async () => {
  const payload = '{"example":"\u0628\u064a\u0627\u0646 \u062a\u062c\u0631\u064a\u0628\u064a","day":"2026-10-24"}';
  const spki = await signature.teacherKey();
  const signed = await signature.sign(payload);
  await expect(signature.verify(spki, payload, signed)).resolves.toBe(true);
  await expect(signature.verify(spki, `${payload} `, signed)).resolves.toBe(false);
});

test('fingerprints hash decoded public-key bytes, not the base64 spelling', async () => {
  const spki = await signature.teacherKey();
  const hash = createHash('sha256').update(Buffer.from(spki, 'base64')).digest('hex');
  await expect(signature.keyFingerprint(spki)).resolves.toBe(hash);
  await expect(teacherKeyFingerprint(spki)).resolves.toBe(hash.slice(0, 32));
  expect(hash).not.toBe(createHash('sha256').update(spki).digest('hex'));
  await expect(signature.keyFingerprint('not a key')).rejects.toThrow();
});

test('a malformed platform fingerprint is not printed as if it were valid', async () => {
  const mocked = jest.spyOn(signature, 'keyFingerprint').mockResolvedValueOnce('Private platform detail');
  await expect(teacherKeyFingerprint('ignored')).rejects.toThrow('Invalid public-key fingerprint');
  mocked.mockRestore();
});

test('signing refuses empty, oversized and malformed Unicode text', async () => {
  for (const text of ['', '\ud800', 'x'.repeat(65_537), '\u0645'.repeat(32_769)]) {
    await expect(signature.sign(text)).rejects.toThrow('Signing failed');
  }
});

test('the QR stand-in supplies only a matrix contract and enforces the complete UTF-8 limit', async () => {
  const matrix = await signature.qrMatrix('\u0645'.repeat(498));
  expect(matrix.size).toBe(29);
  expect(matrix.rows).toHaveLength(matrix.size);
  expect(matrix.rows.every((row) => row.length === matrix.size && /^[01]+$/.test(row))).toBe(true);
  for (const text of ['', '\ud800', 'x'.repeat(997), '\u0645'.repeat(498) + 'x']) {
    await expect(signature.qrMatrix(text)).rejects.toThrow('QR encoding failed');
  }
});
