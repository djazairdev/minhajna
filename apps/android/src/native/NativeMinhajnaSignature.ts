// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Checks a signed update's signature with Android's own crypto (#223, answer 303). */
export interface Spec extends TurboModule {
  /** True only when `signature` is an ECDSA P-256 signature of the payload's UTF-8 bytes by the key `spki`. */
  verify(spki: string, payload: string, signature: string): Promise<boolean>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaSignature');
