// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Spec } from '../src/native/NativeMinhajnaInterface';

/**
 * The interface-language module for Jest, in memory: what MinhajnaInterface
 * keeps in the phone's preferences, and how many times the interface was asked
 * to start again. The direction is the native side's alone, so it is not kept
 * here.
 */
export class FakeInterface {
  kept: string | null = null;
  /** The phone's other settings, such as the print screen's choices, by key. */
  readonly settings = new Map<string, string>();
  restarts = 0;
  /** How many times the app said its first screen with content was drawn. */
  fullyDrawn = 0;

  asSpec(): Spec {
    return {
      language: () => this.kept,
      setLanguage: (code) => {
        this.kept = code;
      },
      setting: (key) => this.settings.get(key) ?? null,
      setSetting: (key, value) => {
        this.settings.set(key, value);
      },
      restart: () => {
        this.restarts += 1;
      },
      focusView: () => undefined,
      cancelFocusRequest: () => undefined,
      reportFullyDrawn: () => {
        this.fullyDrawn += 1;
      },
      getConstants: () => ({}),
    };
  }
}
