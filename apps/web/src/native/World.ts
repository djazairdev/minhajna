// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world's own history on the web (#558, choice D4 of the 0.7.0 demo,
// answer 569), as the phone's world module keeps it: each world in its own
// database under its own key (vault/world-store.ts). Entering a world shuts
// the teacher's history in this tab once its steps are done, forgetting its
// keys, so it refuses every step until the world is left and then opens
// again through its passphrase. One world is open at a time, and every call
// runs after the one before. Errors carry the phone's codes: E_KEY_LOST for
// a world kept without its key, E_WORLD for anything else.

import type { Spec } from '../../../android/src/native/NativeMinhajnaWorld';
import { coded, openAfterWorld, openWorld, shutForWorld } from './vault/lock.ts';
import {
  appendToWorld,
  closeWorldStore,
  eraseWorldContent,
  eraseWorldStore,
  loadWorld,
  openWorldStore,
} from './vault/world-store.ts';

const WORLD_ID = /^[0-9A-HJKMNP-TV-Z]{5}$/u;

let queue: Promise<unknown> = Promise.resolve();

/** Runs the step after the ones before it, its errors given the phone's codes. */
function inTurn<T>(step: () => Promise<T>): Promise<T> {
  const next = queue.then(step, step).catch((error: unknown) => {
    const code = (error as { code?: unknown } | null)?.code;
    const message = error instanceof Error ? error.message : String(error);
    throw code === 'E_KEY_LOST' ? error : coded(message, 'E_WORLD');
  });
  queue = next.catch(() => undefined);
  return next;
}

function named(world: string): void {
  if (!WORLD_ID.test(world)) throw coded('A world is named by the 5 characters of its ID', 'E_WORLD');
}

async function leave(): Promise<void> {
  closeWorldStore();
  await openAfterWorld();
}

/** The world open here, checked against the gate that shuts the teacher's history. */
function inWorld<T>(step: () => Promise<T>): Promise<T> {
  return inTurn(() => (openWorld() === null ? Promise.reject(coded('No world is open', 'E_WORLD')) : step()));
}

const World: Spec = {
  enterWorld: (world) =>
    inTurn(async () => {
      named(world);
      await shutForWorld(world);
      try {
        await openWorldStore(world);
      } catch (error) {
        await leave();
        throw error;
      }
    }),
  leaveWorld: () => inTurn(leave),
  loadHistory: () => inWorld(loadWorld),
  appendEntry: (entry) => inWorld(() => appendToWorld(entry)),
  eraseContent: (ids) => inWorld(() => eraseWorldContent(ids)),
  eraseWorld: (world) =>
    inTurn(async () => {
      named(world);
      if (openWorld() === world) await leave();
      await eraseWorldStore(world);
    }),
};

export default World;
