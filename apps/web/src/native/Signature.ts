// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing and QR codes on the web: in a later part of #250 (answer 501).
// Until then each step is refused as not built yet.

import type { Spec } from '../../../android/src/native/NativeMinhajnaSignature';
import { notYet } from './not-yet.ts';

const Signature: Spec = {
  verify: () => notYet('Checking a signature'),
  teacherKey: () => notYet('The signing key'),
  sign: () => notYet('Signing'),
  keyFingerprint: () => notYet('A key fingerprint'),
  qrMatrix: () => notYet('A QR code'),
};

export default Signature;
