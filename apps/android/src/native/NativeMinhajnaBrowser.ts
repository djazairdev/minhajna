// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// What a PC's browser offers the web app (#250, answers 511 and 512):
// keeping the site's data when the PC runs short of space, installing the app
// to run in its own window, telling whether this tab erased the PC just before
// (answer 519), and sending a report's text, shared or copied (answer 523). A
// phone has no such module, so this is null there: its data is the app's own,
// and the app is installed.
export interface Spec extends TurboModule {
  /** Whether the browser has agreed to keep the data, without asking it to. */
  dataKept(): Promise<boolean>;
  /** Asks the browser to keep the data; resolves with whether it does. */
  keepData(): Promise<boolean>;
  /** `installed` when the app runs installed, `offered` while the browser offers installing it, else `none`. */
  installState(): string;
  /** Shows the browser's install dialog; resolves with whether it was accepted. */
  install(): Promise<boolean>;
  /** Resolves when the install state next changes. */
  installChanged(): Promise<void>;
  /** Whether this tab erased the PC just before the page loaded. */
  erasedHere(): boolean;
  /**
   * Sends a text through the browser's share menu where it has one, or else copies it: `shared`, `cancelled` when
   * the menu was closed, `copied`, or `failed`.
   */
  sendText(title: string, text: string): Promise<string>;
}

export default TurboModuleRegistry.get<Spec>('MinhajnaBrowser');
