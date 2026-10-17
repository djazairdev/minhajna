// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

// Debug builds only (#19): throwaway histories for the storage check, each in
// its own folder with its own Keystore key, written through the same native
// code as the teacher's history. Release builds have no such module, so this
// is null there. A name is 1 to 40 lowercase letters, digits or hyphens.
export interface Spec extends TurboModule {
  /** Opens the named history, creating it and its key on first use. */
  openHistory(name: string): Promise<void>;
  /** Every entry, by sequence, as a JSON array, as the app's own module returns them. */
  loadHistory(name: string): Promise<string>;
  /** Adds one entry, given as JSON. Resolves only once the write is committed. */
  appendEntry(name: string, entry: string): Promise<void>;
  /** Removes the content and salt of the given entries, in one transaction. */
  eraseContent(name: string, ids: readonly string[]): Promise<void>;
  /** The committed entries, read through a second connection that the writer does not share. */
  readCommitted(name: string): Promise<string>;
  /** Closes the history, then deletes its folder and its Keystore key. */
  deleteHistory(name: string): Promise<void>;
}

export default TurboModuleRegistry.get<Spec>('MinhajnaStorageCheck');
