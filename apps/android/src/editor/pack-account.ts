// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Pack-editor accounts on a demo world's server (#612, R-6.7-02, answer 767).
// The device that started the world makes them with its starter token; another
// device signs in with the token that device shows. A device keeps its tokens
// in the world's own store, sealed and erased with it, never in the teacher's.

import { keptWorld, type PackPublisher, type WorldKept } from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { unexpected, type Send } from '../demo/world-session';

const TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

export type PackAccounts = NonNullable<WorldKept['packAccounts']>;

/** Makes the role's account, replacing any before it, and answers its token. */
export async function makePackAccount(
  world: string,
  starter: string,
  role: PackPublisher,
  send: Send,
): Promise<string> {
  const answer = await send({
    method: 'POST',
    path: `/worlds/${world}/packs/accounts`,
    starter,
    body: { role },
  });
  const token = (answer.body as { token?: unknown } | null)?.token;
  if (answer.status !== 201 || typeof token !== 'string' || !TOKEN.test(token)) throw unexpected(answer);
  return token;
}

/** The role the token signs in as; null for a token no account has, which never leaves the device unless it reads. */
export async function signInPackAccount(world: string, token: string, send: Send): Promise<PackPublisher | null> {
  if (!TOKEN.test(token)) return null;
  const answer = await send({ method: 'GET', path: `/worlds/${world}/packs/account`, starter: token });
  if (answer.status === 403) return null;
  const role = (answer.body as { role?: unknown } | null)?.role;
  if (answer.status !== 200 || (role !== 'curator' && role !== 'ministry')) throw unexpected(answer);
  return role;
}

/** The accounts this device keeps for the open world. */
export function keptPackAccounts(open: Pick<OpenWorld, 'book'>): PackAccounts {
  return keptWorld(open.book.entries)?.packAccounts ?? {};
}

const keeping = new WeakMap<object, Promise<unknown>>();

/** Keeps the role's token in the world's own store, one at a time, so one role's keeping never drops another's. */
export function keepPackAccount(
  open: Pick<OpenWorld, 'book' | 'date'>,
  role: PackPublisher,
  token: string,
): Promise<PackAccounts> {
  const keep = async () => {
    const kept = keptWorld(open.book.entries);
    if (kept === null) throw new RangeError('The world keeps nothing to add an account to');
    const packAccounts = { ...kept.packAccounts, [role]: token };
    await open.book.record(open.date, { kind: 'world.kept', kept: { ...kept, packAccounts } });
    return packAccounts;
  };
  const next = (keeping.get(open.book) ?? Promise.resolve()).then(keep, keep);
  keeping.set(open.book, next);
  return next;
}
