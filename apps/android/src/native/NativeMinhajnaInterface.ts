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
  /** A setting of this phone, such as the print screen's choices, kept outside the history; null before any. Synchronous. */
  setting(key: string): string | null;
  /** Keeps a setting of this phone: a key of lowercase letters, digits and hyphens, and a value of at most 4096 characters. */
  setSetting(key: string, value: string): void;
  /** Starts the interface again, so that a new direction applies. */
  restart(): void;
  /** Focuses a mounted UI target, including in touch mode; no label or contents cross this boundary. */
  focusView(reactTag: number): void;
  /** Cancels a queued focus request when its sheet reopens or unmounts. */
  cancelFocusRequest(): void;
  /**
   * Tells Android the first screen with content is drawn. Android then logs
   * the time since launch ("Fully drawn" in adb logcat), so a start can be
   * timed on any phone (PRD §6.8). Nothing leaves the phone.
   */
  reportFullyDrawn(): void;
  /** Keeps the screen on while a code is shown to be scanned, or lets it sleep again (#439). */
  keepScreenOn(on: boolean): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaInterface');
