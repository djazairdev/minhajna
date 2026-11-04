// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' console reads of the demo server (#618, answer 655), with
// the world's pass: the server's version and the fingerprint of its built code,
// the parts its code runs, where it keeps worlds, and whether the database
// answers and is set to archive its write-ahead log; while it archives, whether
// archiving works and the newest restore test by its day and result (#620,
// answer 658), which an older server does not say. A 503 that says the
// database is failing is read as such, since the server answers so when it
// cannot check the pass, and its answer that no world has this ID and pass as
// the world erased. The server version this release of the app ships, which the
// console compares the server's with, is kept equal to the server package's own
// by a test.

import { isDay, type Day } from '@minhajna/core';
import { goneWorld } from '../demo/world-gone';
import { unexpected, type Send } from '../demo/world-session';

/** The demo server's version published in the same release as this app. */
export const SERVER_RELEASE = '0.1.0';

/** The parts the server's code may run, in the order the console draws them. */
export const SERVER_PARTS = ['gateway', 'relay', 'totals', 'standins', 'observatory'] as const;
export type ServerPart = (typeof SERVER_PARTS)[number];

/** Whether archiving works: a file archived and no failure since, the last failure newer, or none archived yet. */
export type Archiving = 'ok' | 'failing' | 'waiting';
/** The newest restore test, by its UTC day and result. */
export type RestoreTest = { readonly day: Day; readonly result: 'passed' | 'failed' };

/** Where the server keeps worlds, and how its database answers. */
export type StorageState =
  | { readonly storage: 'memory' }
  | { readonly storage: 'postgresql'; readonly database: 'ok'; readonly archive: 'off' }
  | {
      readonly storage: 'postgresql';
      readonly database: 'ok';
      readonly archive: 'on';
      readonly archiving?: Archiving;
      readonly restore?: RestoreTest | null;
    }
  | { readonly storage: 'postgresql'; readonly database: 'failing' };

/** The server as it describes itself to the console. */
export type SystemView = {
  readonly version: string;
  readonly fingerprint: string | null;
  readonly parts: readonly ServerPart[];
} & StorageState;

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,32})?$/;

const isArchiving = (value: unknown): value is Archiving =>
  value === 'ok' || value === 'failing' || value === 'waiting';

/** The newest restore test as the server gives it, null when none has run, or undefined when shaped otherwise. */
function restoreOf(value: unknown): RestoreTest | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  const { day, result } = value as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || typeof day !== 'string' || !isDay(day)) return undefined;
  return result === 'passed' || result === 'failed' ? { day, result } : undefined;
}

function storageOf(one: Record<string, unknown>): StorageState | null {
  const keys = Object.keys(one).sort().join(' ');
  if (one['storage'] === 'memory') return keys === 'fingerprint parts storage version' ? { storage: 'memory' } : null;
  if (one['storage'] !== 'postgresql') return null;
  if (one['database'] === 'failing' && keys === 'database fingerprint parts storage version')
    return { storage: 'postgresql', database: 'failing' };
  const archive = one['archive'];
  if (one['database'] !== 'ok' || (archive !== 'on' && archive !== 'off')) return null;
  if (keys === 'archive database fingerprint parts storage version')
    return { storage: 'postgresql', database: 'ok', archive };
  const { archiving } = one;
  const restore = restoreOf(one['restore']);
  return archive === 'on' &&
    keys === 'archive archiving database fingerprint parts restore storage version' &&
    isArchiving(archiving) &&
    restore !== undefined
    ? { storage: 'postgresql', database: 'ok', archive, archiving, restore }
    : null;
}

/** The server's description, or null when it is shaped otherwise. */
export function systemView(value: unknown): SystemView | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const one = value as Record<string, unknown>;
  const { version, fingerprint, parts } = one;
  if (typeof version !== 'string' || !VERSION.test(version)) return null;
  if (fingerprint !== null && (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(fingerprint))) return null;
  if (!Array.isArray(parts) || !parts.every((part) => SERVER_PARTS.includes(part as ServerPart))) return null;
  if (new Set(parts).size !== parts.length) return null;
  const storage = storageOf(one);
  return storage === null ? null : { version, fingerprint, parts: parts as ServerPart[], ...storage };
}

/** Reads the server's description through the world. */
export async function readSystem(world: string, send: Send): Promise<SystemView> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/admin/system` });
  goneWorld(answer);
  const view = systemView(answer.body);
  const failing = view?.storage === 'postgresql' && view.database === 'failing';
  if (view === null || !(answer.status === 200 || (answer.status === 503 && failing))) throw unexpected(answer);
  return view;
}

/** A fingerprint in groups of four, as the console writes it. */
export const fingerprintText = (fingerprint: string) => fingerprint.replace(/(.{4})(?=.)/g, '$1 ');
