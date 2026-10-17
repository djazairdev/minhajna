// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** The installed build: what anyone can compare with the checksums published with it (choice F9, #49). */
export type BuildFacts = {
  version: string;
  versionCode: number;
  /** The SHA-256 of the installed APK file, as lowercase hex. */
  apkSha256: string;
  /** The SHA-256 of the signing certificate, or null when Android gives none. */
  signerSha256: string | null;
};
/** Reads only the app's own APK, off the UI thread. */
export interface Spec extends TurboModule {
  describe(): Promise<BuildFacts>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaBuild');
