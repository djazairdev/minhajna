// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// What the operators' console reads of the demo server (#618, answer 655),
// with the world's pass: the server's version and the fingerprint of its built
// code, the parts its code runs, where it keeps worlds, and whether the
// database answers and is set to archive its write-ahead log. A 503 that says
// the database is failing is read as such, since the server answers so when it
// cannot check the pass. The server version this release of the app ships,
// which the console compares the server's with, is kept equal to the server
// package's own by a test.

import { unexpected, type Send } from '../demo/world-session';

/** The demo server's version published in the same release as this app. */
export const SERVER_RELEASE = '0.1.0';

/** The parts the server's code may run, in the order the console draws them. */
export const SERVER_PARTS = ['gateway', 'relay', 'totals', 'standins'] as const;
export type ServerPart = (typeof SERVER_PARTS)[number];

/** Where the server keeps worlds, and how its database answers. */
export type StorageState =
  | { readonly storage: 'memory' }
  | { readonly storage: 'postgresql'; readonly database: 'ok'; readonly archive: 'on' | 'off' }
  | { readonly storage: 'postgresql'; readonly database: 'failing' };

/** The server as it describes itself to the console. */
export type SystemView = {
  readonly version: string;
  readonly fingerprint: string | null;
  readonly parts: readonly ServerPart[];
} & StorageState;

const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:-[0-9A-Za-z.-]{1,32})?$/;

function storageOf(one: Record<string, unknown>): StorageState | null {
  const keys = Object.keys(one).sort().join(' ');
  if (one['storage'] === 'memory') return keys === 'fingerprint parts storage version' ? { storage: 'memory' } : null;
  if (one['storage'] !== 'postgresql') return null;
  if (one['database'] === 'failing' && keys === 'database fingerprint parts storage version')
    return { storage: 'postgresql', database: 'failing' };
  const archive = one['archive'];
  if (one['database'] !== 'ok' || (archive !== 'on' && archive !== 'off')) return null;
  return keys === 'archive database fingerprint parts storage version'
    ? { storage: 'postgresql', database: 'ok', archive }
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
  const view = systemView(answer.body);
  const failing = view?.storage === 'postgresql' && view.database === 'failing';
  if (view === null || !(answer.status === 200 || (answer.status === 503 && failing))) throw unexpected(answer);
  return view;
}

/** A fingerprint in groups of four, as the console writes it. */
export const fingerprintText = (fingerprint: string) => fingerprint.replace(/(.{4})(?=.)/g, '$1 ');
