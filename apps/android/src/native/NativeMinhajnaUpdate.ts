// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// The PC web app's updates (#250, R-6.6-06, answers 516 and 517): the build on
// the server it was installed from, and installing it once the teacher
// accepts. A phone has no such module, so this is null there: its updates
// come as APKs. Offers and installs are JSON, as `update-offer.ts` reads them.
export interface Spec extends TurboModule {
  /** A newer build on the server, as JSON, or null: none, offline, the app not yet installed, or a failure. */
  available(): Promise<string | null>;
  /** Installs the server's build of that checksum, then reloads the app; rejects when the server holds another. */
  install(sha256: string): Promise<void>;
  /** The update installed before this opening, as JSON, until `forget`; null when there was none. */
  installed(): Promise<string | null>;
  /** Forgets the update installed, once the app has recorded it. */
  forget(): void;
}

export default TurboModuleRegistry.get<Spec>('MinhajnaUpdate');
