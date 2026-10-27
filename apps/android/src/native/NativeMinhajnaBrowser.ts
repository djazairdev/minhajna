// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// What a PC's browser offers the web app (#250, answers 511 and 512):
// keeping the site's data when the PC runs short of space, and installing
// the app to run in its own window. A phone has no such module, so this is
// null there: its data is the app's own, and the app is installed.
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
}

export default TurboModuleRegistry.get<Spec>('MinhajnaBrowser');
