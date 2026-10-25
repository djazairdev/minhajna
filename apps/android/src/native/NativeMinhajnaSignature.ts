// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** One module-pixel per cell, with the four-cell white quiet zone included; 1 is black and 0 is white. */
export type QrMatrix = { size: number; rows: string[] };

/** Platform signing and QR primitives (#223, #437); no private key crosses this bridge. */
export interface Spec extends TurboModule {
  /** True only when `signature` is an ECDSA P-256 signature of the payload's UTF-8 bytes by the key `spki`. */
  verify(spki: string, payload: string, signature: string): Promise<boolean>;
  /** The phone's P-256 public key, base64 SPKI; creates its non-exportable Keystore pair on first use. */
  teacherKey(): Promise<string>;
  /** Base64 DER ECDSA P-256/SHA-256 over exact, well-formed UTF-8 bytes; up to 65,536 bytes. */
  sign(payload: string): Promise<string>;
  /** Full lowercase SHA-256 of decoded P-256 SPKI bytes, like the reference-data keys. */
  keyFingerprint(spki: string): Promise<string>;
  /** UTF-8 QR, M, version 25 or smaller; refuses empty, malformed or over-996-byte text. */
  qrMatrix(text: string): Promise<QrMatrix>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaSignature');
