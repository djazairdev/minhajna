// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// The app's own native module (#19, #75). It wraps the platform's audited
// primitives and SQLCipher; the project writes no cryptography of its own
// (PRD §6.5). It stores only the history, entry by entry, so no other code
// can run SQL against the teacher's records.
export interface Spec extends TurboModule {
  /** Secure random bytes from SecureRandom, as lowercase hex. Synchronous. */
  randomBytes(length: number): string;
  /** SHA-256 of each text's UTF-8 bytes, as lowercase hex. Refuses text that is not well-formed. */
  digest(texts: readonly string[]): Promise<string[]>;
  /** Opens the encrypted history, creating it and its key on first use. */
  openHistory(): Promise<void>;
  /** Every entry, by sequence, as a JSON array. */
  loadHistory(): Promise<string>;
  /** Adds one entry, given as JSON. Resolves only once the write is committed. */
  appendEntry(entry: string): Promise<void>;
  /** Removes the content and salt of the given entries, in one transaction. */
  eraseContent(ids: readonly string[]): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaStorage');
