// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A demo world once it is started or joined (#560 and #562, answers 569, 572,
// 573 and 576): its own store opens, apart from the teacher's, and keeps the
// world's kind and code, and the starter token on the device that started it,
// as a device-layer event that nothing exports; a code entered again on that
// device finds its token there. Opening fails with the network shut and the
// world's store closed. Leaving shuts the network first, then the store; the
// teacher's history opens again only through its lock. A code the server no
// longer knows erases the store this device kept for it, unless the store
// belongs to another code with the same ID, and one kept without its key; to
// find out, the store opens, so a code this device never kept makes an empty
// store that is erased at once. The roles are the world's kind's until #518
// seeds its people; a phone offers only the teacher's and the inspector's, and
// a PC opens the others' workspaces (world-pages.ts).

import { keptWorld, worldIdOfCode, type Day, type RecordBook, type WorldKept, type WorldKind } from '@minhajna/core';
import type { Spec as StorageSpec } from '../native/NativeMinhajnaStorage';
import type { Spec as WorldSpec } from '../native/NativeMinhajnaWorld';
import { leaveWorldNetwork } from '../network/world-network';
import { onPc } from '../text/device-text';
import { openWorldBook } from '../storage/world';

/** Who someone acts as in a world. */
export type WorldRole =
  | 'ministry'
  | 'directorate'
  | 'director'
  | 'preparer'
  | 'inspector'
  | 'teacher'
  | 'curator'
  | 'operator'
  | 'observatory';

/** The roles each kind of world holds, from the Ministry down, then those who serve the system (answer 576). */
export const WORLD_ROLES: Readonly<Record<WorldKind, readonly WorldRole[]>> = {
  national: ['ministry', 'directorate', 'director', 'preparer', 'inspector', 'teacher', 'curator', 'operator'],
  teachers: ['teacher', 'observatory'],
};

/** The roles a phone offers (answer 575); the others are a PC's, for their workspaces (#562). */
const PHONE_ROLES: readonly WorldRole[] = ['inspector', 'teacher'];

/** The roles of a world of a kind this device offers. */
export function rolesHere(kind: WorldKind): readonly WorldRole[] {
  return onPc() ? WORLD_ROLES[kind] : WORLD_ROLES[kind].filter((role) => PHONE_ROLES.includes(role));
}

/** A world as it was started or joined. */
export interface FoundWorld {
  readonly world: string;
  readonly kind: WorldKind;
  readonly code: string;
  readonly date: Day;
  /** The starter token, when this device started the world just now. */
  readonly starter: string | null;
}

/** A world open on this device, with its own record book. */
export interface OpenWorld extends FoundWorld {
  readonly book: RecordBook;
}

/** Opens the world's own store and keeps what it must; leaves the world, network and store, if it cannot. */
export async function openWorld(
  found: FoundWorld,
  storage: Pick<StorageSpec, 'randomBytes' | 'digest'>,
  world: WorldSpec,
): Promise<OpenWorld> {
  let book: RecordBook;
  try {
    book = await openWorldBook(storage, world, found.world);
  } catch (error) {
    leaveWorldNetwork();
    throw error;
  }
  try {
    const kept = keptWorld(book.entries);
    const starter = found.starter ?? (kept?.code === found.code ? kept.starter : null);
    if (kept?.code !== found.code || kept.kind !== found.kind || kept.starter !== starter) {
      await book.record(found.date, { kind: 'world.kept', kept: { kind: found.kind, code: found.code, starter } });
    }
    return { ...found, starter, book };
  } catch (error) {
    await leaveWorld(world).catch(() => undefined);
    throw error;
  }
}

/** Leaves the world: the network first, then its store. */
export async function leaveWorld(world: Pick<WorldSpec, 'leaveWorld'>): Promise<void> {
  leaveWorldNetwork();
  await world.leaveWorld();
}

/** Erases the store kept for a code the server no longer knows, unless it holds another code of the same ID. */
export async function forgetWorld(
  code: string,
  storage: Pick<StorageSpec, 'randomBytes' | 'digest'>,
  world: WorldSpec,
): Promise<void> {
  const id = worldIdOfCode(code);
  let kept: WorldKept | null;
  try {
    kept = keptWorld((await openWorldBook(storage, world, id)).entries);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'E_KEY_LOST') await world.eraseWorld(id);
    throw error;
  }
  try {
    if (kept === null || kept.code === code) await world.eraseWorld(id);
  } finally {
    await world.leaveWorld();
  }
}
