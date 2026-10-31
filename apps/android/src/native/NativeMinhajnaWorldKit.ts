// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** A new P-256 pair: its public half as SPKI and its private half as PKCS #8, both DER in base64. */
export type WorldPair = { spki: string; pkcs8: string; fingerprint: string };

/**
 * The cryptography a demo world needs (#561, answers 568 and 572), as the
 * PC's Web Crypto gives it, on a worker so a slow derivation never holds the
 * screen. Bytes cross as lowercase hex, keys as base64; nothing here keeps a
 * key, and no key is the Keystore's, since a world's keys are made up and
 * travel sealed with the world.
 */
export interface Spec extends TurboModule {
  /** Whether the app holds the network permission a world needs, which release builds get with #559's notice. */
  canConnect(): boolean;
  /** PBKDF2-HMAC-SHA256 to 32 bytes. */
  derive(secret: string, salt: string, rounds: number): Promise<string>;
  /** HMAC-SHA256. */
  mac(key: string, data: string): Promise<string>;
  /** AES-256-GCM under a fresh random 12-byte nonce, the nonce first. */
  seal(key: string, plain: string, additional: string): Promise<string>;
  /** The plain bytes, or null for anything that does not open. */
  open(key: string, sealed: string, additional: string): Promise<string | null>;
  /** Base64 DER ECDSA P-256/SHA-256 by a PKCS #8 private key over exact, well-formed UTF-8 bytes. */
  sign(pkcs8: string, text: string): Promise<string>;
  /** A new pair, with the lowercase SHA-256 of its SPKI's bytes. */
  newPair(): Promise<WorldPair>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaWorldKit');
