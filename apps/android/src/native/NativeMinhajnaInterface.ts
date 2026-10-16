// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// The interface language the teacher chose, kept on the phone (#21). Android
// sets the layout's direction before React Native starts, so the native side
// keeps the direction with the language and applies it at every start.
export interface Spec extends TurboModule {
  /** The language chosen on this phone, or null before any choice. Synchronous. */
  language(): string | null;
  /** Keeps the language and its direction; the direction applies from the next start. */
  setLanguage(code: string, rightToLeft: boolean): void;
  /** Starts the interface again, so that a new direction applies. */
  restart(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaInterface');
