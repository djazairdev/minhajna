// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * A demo world's own history (#558, choice D4 of the 0.7.0 demo): its own
 * folder and Keystore key, written through the same native code as the
 * teacher's history. While a world is open, the teacher's history is closed
 * and refuses every call; one world is open at a time. A world is named by
 * the 5 characters of its ID.
 */
export interface Spec extends TurboModule {
  /** Shuts the teacher's history and opens the world's, creating it and its key on first use. */
  enterWorld(world: string): Promise<void>;
  /** Closes the world's history; the teacher's opens again through its lock. */
  leaveWorld(): Promise<void>;
  /** Every entry of the open world, by sequence, as a JSON array. */
  loadHistory(): Promise<string>;
  /** Adds one entry, given as JSON. Resolves only once the write is committed. */
  appendEntry(entry: string): Promise<void>;
  /** Removes the content and salt of the given entries, in one transaction. */
  eraseContent(ids: readonly string[]): Promise<void>;
  /** Deletes a world's history and key, leaving it first if it is open. */
  eraseWorld(world: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('MinhajnaWorld');
