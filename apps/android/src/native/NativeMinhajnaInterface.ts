// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// The interface language the teacher chose, kept on the phone (#21). Android
// sets the layout's direction before React Native starts, so the native side
// works the direction out from the kept language and applies it at every start.
export interface Spec extends TurboModule {
  /** The language chosen on this phone, or null before any choice. Synchronous. */
  language(): string | null;
  /** Keeps the language; its direction, which the native side derives from the code, applies from the next start. */
  setLanguage(code: string): void;
  /** Starts the interface again, so that a new direction applies. */
  restart(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaInterface');
