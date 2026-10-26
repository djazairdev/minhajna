// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Files the teacher keeps or sends (#242): made in the app's cache under a
 * token, the only thing that crosses the bridge back, never a path. An
 * archive picked for a restore (#247) is kept there under a token too.
 */
export interface Spec extends TurboModule {
  /** Writes the text as UTF-8 under `fileName`, or in an AES-256 ZIP named after it when a password is given. */
  makeText(text: string, fileName: string, password: string): Promise<string>;
  /**
   * Writes each text as UTF-8 under its name, all in one ZIP named `fileName` and `.zip`: an AES-256 one when a
   * password is given, else a plain one (#248).
   */
  makeZip(names: readonly string[], texts: readonly string[], fileName: string, password: string): Promise<string>;
  /** Moves a made PDF under `fileName`, or into an AES-256 ZIP named after it when a password is given. */
  adoptPdf(pdf: string, fileName: string, password: string): Promise<string>;
  /** Asks where to keep a made file, through the system's file picker; false when the teacher cancels. */
  saveFile(token: string): Promise<boolean>;
  /** Hands a made file to Android's share screen; never a link. */
  shareFile(token: string, title: string): Promise<void>;
  /**
   * Asks for a local text file through the system's file picker, from the phone, an SD card or a USB key, never a
   * cloud provider (#477), and gives its text; null when the teacher cancels. A file
   * that is not text, a ZIP archive, an .xlsx or .xls workbook or a PDF, is refused as `E_FILE_BINARY`, and a file
   * over 2 MB as `E_FILE_SIZE`.
   */
  openText(): Promise<string | null>;
  /**
   * Asks for a local ZIP archive through the system's file picker, from the phone, an SD card or a USB key, never a
   * cloud provider (#477), and keeps a copy under a token, given with the name the
   * picker shows; null when the teacher cancels. A file over 16 MB is refused as `E_ZIP_TOO_LARGE`.
   */
  openZip(): Promise<{ token: string; name: string } | null>;
  /**
   * The kept archive's file named `entry`, as UTF-8 text, opened with `password` when it is encrypted, as it must be
   * when `sealed`. Refusals are `E_ZIP_NOT_ARCHIVE`, `E_ZIP_PASSWORD`, `E_ZIP_CHANGED` (a wrong password, once in
   * 65,536, reads as one), `E_ZIP_TOO_LARGE` and `E_ZIP_PLAIN`, a file without a password when it is `sealed`.
   */
  readZip(token: string, entry: string, password: string, sealed: boolean): Promise<string>;
  /** Deletes a kept archive. */
  dropFile(token: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaFiles');
