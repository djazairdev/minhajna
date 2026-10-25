// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/** Only bounded text crosses the bridge; no file path, camera image, or persistent URI grant. */
export interface Spec extends TurboModule {
  readFile(): Promise<string | null>;
  /** A statement's signed file, or a statement PDF's `minhajna-statement:` link and nothing else of it (#246). */
  readStatement(): Promise<string | null>;
  scanQr(title: string, instruction: string, cancel: string, rtl: boolean): Promise<string | null>;
  /** A QR code of short text, at most 200 characters, as rows of `1` (dark) and `0` (light), with no quiet zone. */
  qrRows(text: string): string;
  cancel(): void;
  /** Shares a JSON file the app wrote, up to 1 MB, by its file name, through Android's share sheet. */
  shareText(name: string, text: string, title: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaCalendarInput');
