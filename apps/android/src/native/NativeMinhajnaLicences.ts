// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Public attribution text from the APK, never teacher records. */
export type LicenceNotice = { name: string; text: string };
/** Installed version and every file in the APK's flat licences directory. */
export type AppLicences = { version: string; notices: LicenceNotice[] };
/** Asset reads run off the UI thread; no arbitrary path crosses the bridge. */
export interface Spec extends TurboModule {
  readNotices(): Promise<AppLicences>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaLicences');
