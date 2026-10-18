// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Durations are diagnostic elapsed milliseconds, not times in school records.

import { RecordBook, type Entry } from '../../core/src/index.ts';
import { type DemoLevel } from '../../core/test/demo-year.ts';
import { historyDeps, ITERATIONS, seal, testKey, unseal } from './crypto.ts';
import { read, replace, type RunMeta, type Snapshot } from './database.ts';
import { reference, workload } from './workload.ts';

/** Safe to copy: metrics only, never passphrases, salts, keys or entry bodies. */
export interface Result {
  readonly operation: 'write-read' | 'reopen';
  readonly level: DemoLevel;
  readonly events: number;
  readonly plainJsonBytes: number;
  readonly ciphertextAndIvBytes: number;
  readonly keyDerivationMs: number;
  readonly encryptMs?: number;
  readonly committedWriteMs?: number;
  readonly readMs: number;
  readonly decryptAndVerifyMs: number;
  readonly verified: true;
}

async function timed<T>(action: () => Promise<T>): Promise<{ value: T; ms: number }> {
  const start = performance.now();
  const value = await action();
  return { value, ms: Math.round((performance.now() - start) * 100) / 100 };
}

/** Verification uses the real core, including after a fresh page/browser launch. */
async function verify(snapshot: Snapshot, entries: readonly Entry[]): Promise<void> {
  if (
    entries.length !== snapshot.meta.count ||
    new TextEncoder().encode(JSON.stringify(entries)).length !== snapshot.meta.plainBytes
  )
    throw new Error('count');
  const book = await RecordBook.open(
    {
      load: () => Promise.resolve(entries),
      append: () => Promise.reject(new Error('read-only')),
      eraseContent: () => Promise.reject(new Error('read-only')),
    },
    historyDeps,
  );
  const classId = snapshot.meta.level === 'cem' ? 'k-1am2' : 'k-5apb';
  if (
    !book.state.classes.has(classId) ||
    book.state.pupils.size !== 45 ||
    book.state.sessions.size === 0 ||
    book.state.rollCalls.size === 0
  )
    throw new Error('state');
}

function metrics(snapshot: Snapshot): Pick<Result, 'level' | 'events' | 'plainJsonBytes' | 'ciphertextAndIvBytes'> {
  return {
    level: snapshot.meta.level,
    events: snapshot.meta.count,
    plainJsonBytes: snapshot.meta.plainBytes,
    ciphertextAndIvBytes: snapshot.rows.reduce((sum, row) => sum + row.iv.byteLength + row.ciphertext.byteLength, 0),
  };
}

async function decrypt(snapshot: Snapshot, key: CryptoKey): Promise<void> {
  await verify(snapshot, await unseal(snapshot.rows, key, snapshot.meta));
}

/** Replaces only the explicitly labelled synthetic run, atomically. */
export async function run(passphrase: string, level: DemoLevel): Promise<Result> {
  const fixture = await workload(await reference(), level);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await timed(() => testKey(passphrase, salt));
  const runId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const meta: RunMeta = {
    format: 2,
    runId,
    level,
    count: fixture.entries.length,
    plainBytes: new TextEncoder().encode(JSON.stringify(fixture.entries)).length,
    salt,
    iterations: ITERATIONS,
  };
  const encrypted = await timed(() => seal(fixture.entries, key.value, meta));
  const write = await timed(() => replace({ meta, rows: encrypted.value }));
  const saved = await timed(read);
  if (saved.value === null || saved.value.meta.runId !== runId) throw new Error('changed-run');
  const verified = await timed(() => decrypt(saved.value as Snapshot, key.value));
  return {
    operation: 'write-read',
    ...metrics(saved.value),
    keyDerivationMs: key.ms,
    encryptMs: encrypted.ms,
    committedWriteMs: write.ms,
    readMs: saved.ms,
    decryptAndVerifyMs: verified.ms,
    verified: true,
  };
}

/** No new fixture is generated: this decrypts and verifies the committed run. */
export async function reopen(passphrase: string): Promise<Result> {
  const saved = await timed(read);
  const snapshot = saved.value;
  if (snapshot === null) throw new Error('no-saved-run');
  const key = await timed(() => testKey(passphrase, snapshot.meta.salt));
  const verified = await timed(() => decrypt(snapshot, key.value));
  return {
    operation: 'reopen',
    ...metrics(snapshot),
    keyDerivationMs: key.ms,
    readMs: saved.ms,
    decryptAndVerifyMs: verified.ms,
    verified: true,
  };
}
