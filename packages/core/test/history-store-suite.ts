// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Shared storage checks for #76 (PRD sections 5.5 and 6.8). This test-only
// entry keeps Node's assertions out of the platform-independent runtime.

import assert from 'node:assert/strict';
import {
  HistoryLog,
  MemoryStore,
  parseDay,
  verifyHistory,
  type Entry,
  type HistoryDeps,
  type HistoryStore,
} from '../src/index.ts';

/** One fresh, empty test store; persistent adapters own their isolated backing data. */
export interface StoreFixture {
  readonly store: HistoryStore;
  /**
   * Reads committed data, not the writer's cache, without flushing or waiting
   * for pending writes. Persistent adapters use an independent reader. Memory
   * is its own backing store, so MemoryStore can use load directly.
   */
  readonly readCommitted: () => Promise<readonly Entry[]>;
  /** Closes handles and removes only this fixture's synthetic test data, even on failure. */
  readonly dispose?: () => void | Promise<void>;
}

/** Called once per check, so adapters never share a database between checks. */
export type CreateStoreFixture = () => StoreFixture | Promise<StoreFixture>;

/** A test runner's registrar, such as node:test's it or Jest's test; it awaits run. */
export type RegisterStoreTest = (name: string, run: () => Promise<void>) => unknown;

type Check = (fixture: StoreFixture) => Promise<void>;

/**
 * Registers the same storage contract for any adapter, using its own hashing
 * and randomness. The probe checks observable acknowledgement, not power-loss
 * safety: platform crash tests remain separate. Import only in Node-based tests.
 */
export function historyStoreTests(register: RegisterStoreTest, create: CreateStoreFixture, deps: HistoryDeps): void {
  const test = (name: string, run: Check) => registerCheck(register, create, name, run);

  test('loads an empty store', async ({ store, readCommitted }) => {
    assert.deepEqual(await store.load(), []);
    assert.deepEqual(await readCommitted(), []);
  });

  test('keeps append order and every entry field', async ({ store, readCommitted }) => {
    const entries = await seed(store, deps);
    assert.deepEqual(await store.load(), entries);
    assert.deepEqual(await store.load(), entries);
    assert.deepEqual(await readCommitted(), entries);
  });

  test('acknowledges only committed appends', async ({ store, readCommitted }) => {
    const entries = await sampleEntries(deps);
    for (const [index, entry] of entries.entries()) {
      await store.append(structuredClone(entry));
      assert.deepEqual(await readCommitted(), entries.slice(0, index + 1));
    }
  });

  test('erases only the requested content and preserves headers', async ({ store, readCommitted }) => {
    const entries = await seed(store, deps);
    const first = entries[0];
    const last = entries[2];
    assert.ok(first && last);
    const ids = [first.id, last.id];
    const expected = entries.map((entry) => (ids.includes(entry.id) ? { ...entry, content: null } : entry));
    await store.eraseContent(ids);
    assert.deepEqual(await readCommitted(), expected);
    assert.deepEqual(await store.load(), expected);
  });

  test('keeps empty and repeated erasures harmless', async ({ store, readCommitted }) => {
    const entries = await seed(store, deps);
    const first = entries[0];
    assert.ok(first);
    await store.eraseContent([]);
    assert.deepEqual(await readCommitted(), entries);
    const expected = entries.map((entry) => (entry.id === first.id ? { ...entry, content: null } : entry));
    await store.eraseContent([first.id]);
    await store.eraseContent([first.id]);
    await store.eraseContent([]);
    assert.deepEqual(await readCommitted(), expected);
    assert.deepEqual(await store.load(), expected);
  });

  test('opens the same history again and continues its sequence', async ({ store, readCommitted }) => {
    const log = await HistoryLog.open(store, deps);
    await log.append(parseDay('2026-09-21'), 'lesson-record', 'note', { text: 'Synthetic note' });
    const reopened = await HistoryLog.open(store, deps);
    assert.deepEqual(reopened.entries, log.entries);
    const next = await reopened.append(parseDay('2026-09-22'), 'lesson-record', 'note', { text: 'Another note' });
    assert.equal(next.seq, 1);
    const committed = await readCommitted();
    assert.deepEqual(committed, reopened.entries);
    assert.deepEqual(await verifyHistory(deps.digest, committed), []);
  });

  test('keeps log appends in order when not awaited one by one', async ({ store, readCommitted }) => {
    const log = await HistoryLog.open(store, deps);
    await Promise.all(
      Array.from({ length: 20 }, (_, n) => log.append(parseDay('2026-09-21'), 'lesson-record', 'note', { n })),
    );
    const committed = await readCommitted();
    assert.deepEqual(
      committed.map((entry) => entry.seq),
      Array.from({ length: 20 }, (_, n) => n),
    );
    assert.deepEqual(committed, log.entries);
    assert.deepEqual(await store.load(), log.entries);
    assert.deepEqual(await verifyHistory(deps.digest, committed), []);
  });

  test('reopens a verifiable history after content erasure', async ({ store, readCommitted }) => {
    const entries = await seed(store, deps);
    const first = entries[0];
    const last = entries[2];
    assert.ok(first && last);
    const log = await HistoryLog.open(store, deps);
    await log.erase(parseDay('2026-10-01'), [first.id, last.id]);
    const committed = await readCommitted();
    assert.deepEqual(committed, log.entries);
    assert.deepEqual(await verifyHistory(deps.digest, committed), []);
    const reopened = await HistoryLog.open(store, deps);
    assert.deepEqual(reopened.entries, committed);
  });
}

function registerCheck(register: RegisterStoreTest, create: CreateStoreFixture, name: string, run: Check): void {
  register(name, async () => {
    const fixture = await create();
    try {
      await run(fixture);
    } finally {
      await fixture.dispose?.();
    }
  });
}

/** Same-day and backdated changes must stay in append order, with exact Unicode and JSON values. */
async function sampleEntries(deps: HistoryDeps): Promise<readonly Entry[]> {
  const log = await HistoryLog.open(new MemoryStore(), deps);
  for (const [index, day] of ['2026-09-21', '2026-09-20', '2026-09-21'].entries()) {
    await log.append(parseDay(day), index === 1 ? 'lesson-record' : 'pupil-records', 'note', {
      n: index,
      text: 'ملاحظة تجريبية — séance fictive 😀',
      values: [null, true, 1.5, ''],
    });
  }
  return log.entries;
}

/** The expected entries never alias the adapter's input, so mutation cannot hide a fault. */
async function seed(store: HistoryStore, deps: HistoryDeps): Promise<readonly Entry[]> {
  const entries = await sampleEntries(deps);
  for (const entry of entries) await store.append(structuredClone(entry));
  return entries;
}
