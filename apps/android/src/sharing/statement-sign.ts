// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing a statement the moment it is printed or saved (#438, R-5.5-07):
// the phone's own key, made on first use and never leaving the Keystore
// (#437), signs the allowlisted text; the page then shows the key's
// fingerprint and, when the signed text fits one code, its QR matrix. Any
// failure stops the print or save, so nothing unsigned leaves.

import { fitsInQr, signStatement, type ProgressStatement } from '@minhajna/core';
import signature, { type QrMatrix } from '../native/NativeMinhajnaSignature';
import { teacherKeyFingerprint } from './teacher-key';

/** A statement signed now: the signed text, the key's fingerprint, and its QR matrix when it fits. */
export interface SignedStatement {
  readonly text: string;
  readonly fingerprint: string;
  readonly qr: QrMatrix | null;
}

/** Signs `statement` with the teacher's key; throws when it cannot be signed. */
export async function signedNow(statement: ProgressStatement): Promise<SignedStatement> {
  const spki = await signature.teacherKey();
  const text = await signStatement(statement, spki, (payload) => signature.sign(payload));
  const fingerprint = await teacherKeyFingerprint(spki);
  const qr = fitsInQr(text) ? await signature.qrMatrix(text) : null;
  return { text, fingerprint, qr };
}
