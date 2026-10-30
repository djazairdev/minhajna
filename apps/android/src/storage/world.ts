// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's own history (#558, choice D4 of the 0.7.0 demo): the calls
// the history needs, sent to the world's store instead of the teacher's,
// so the record book a world opens is the world's alone. Entering a world
// shuts the teacher's history in the native module, which refuses it every
// call while the world is open, as its lock does, so the app asks for no
// lock status while a world is open; leaving closes the world's, and the
// teacher's opens again through its lock, as it was.

import type { RecordBook } from '@minhajna/core';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import type { Spec as WorldSpec } from '../native/NativeMinhajnaWorld';
import { openRecordBook, type HistorySpec } from './history';

const WORLD_ID = /^[0-9A-HJKMNP-TV-Z]{5}$/;

/** The history's calls for one world: hashing and random bytes from the app's module, records from the world's. */
export function worldSpec(
  storage: Pick<StorageSpec, 'randomBytes' | 'digest'>,
  world: WorldSpec,
  id: string,
): HistorySpec {
  if (!WORLD_ID.test(id)) throw new RangeError('A world is named by the 5 characters of its ID');
  return {
    randomBytes: (length) => storage.randomBytes(length),
    digest: (texts) => storage.digest(texts),
    openHistory: () => world.enterWorld(id),
    loadHistory: () => world.loadHistory(),
    appendEntry: (entry) => world.appendEntry(entry),
    eraseContent: (ids) => world.eraseContent(ids),
  };
}

/** Enters a world and opens its record book, which verifies as the teacher's does; leaves it if it does not. */
export async function openWorldBook(
  storage: Pick<StorageSpec, 'randomBytes' | 'digest'>,
  world: WorldSpec,
  id: string,
): Promise<RecordBook> {
  try {
    return await openRecordBook(worldSpec(storage, world, id));
  } catch (error) {
    await world.leaveWorld().catch(() => undefined);
    throw error;
  }
}
