// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Only bounded text crosses the bridge; no file path, camera image, or persistent URI grant. */
export interface Spec extends TurboModule {
  readFile(): Promise<string | null>;
  scanQr(title: string, instruction: string, cancel: string, rtl: boolean): Promise<string | null>;
  cancel(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaCalendarInput');
