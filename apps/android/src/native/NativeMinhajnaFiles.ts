// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Files the teacher keeps or sends (#242): made in the app's cache under a
 * token, the only thing that crosses the bridge back, never a path.
 */
export interface Spec extends TurboModule {
  /** Writes the text as UTF-8 under `fileName`, or in an AES-256 ZIP named after it when a password is given. */
  makeText(text: string, fileName: string, password: string): Promise<string>;
  /** Moves a made PDF under `fileName`, or into an AES-256 ZIP named after it when a password is given. */
  adoptPdf(pdf: string, fileName: string, password: string): Promise<string>;
  /** Asks where to keep a made file, through the system's file picker; false when the teacher cancels. */
  saveFile(token: string): Promise<boolean>;
  /** Hands a made file to Android's share screen; never a link. */
  shareFile(token: string, title: string): Promise<void>;
  /**
   * Asks for a text file through the system's file picker, and gives its text; null when the teacher cancels. A file
   * that is not text, a ZIP archive, an .xlsx or .xls workbook or a PDF, is refused as `E_FILE_BINARY`, and a file
   * over 2 MB as `E_FILE_SIZE`.
   */
  openText(): Promise<string | null>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaFiles');
