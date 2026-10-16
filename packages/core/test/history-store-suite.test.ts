// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A contract suite must reject faulty adapters, not just pass MemoryStore.
// Deferred writes are controlled by promises, never timing or network access.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as core from '@minhajna/core';
import { MemoryStore, type HistoryStore } from '@minhajna/core';
import { historyStoreTests, type CreateStoreFixture, type StoreFixture } from '@minhajna/core/test-support';
import { deps } from './support.ts';

function memoryFixture(): StoreFixture {
  const store = new MemoryStore();
  return { store, readCommitted: () => store.load() };
}

function overrideStore(store: HistoryStore, overrides: Partial<HistoryStore>): HistoryStore {
  return {
    load: () => store.load(),
    append: (entry) => store.append(entry),
    eraseContent: (ids) => store.eraseContent(ids),
    ...overrides,
  };
}

function collect(create: CreateStoreFixture) {
  const checks = new Map<string, () => Promise<void>>();
  historyStoreTests(
    (name, run) => {
      assert.ok(!checks.has(name));
      checks.set(name, run);
    },
    create,
    deps,
  );
  return checks;
}

function check(name: string, create: CreateStoreFixture): Promise<void> {
  const run = collect(create).get(name);
  assert.ok(run, `The store suite must register: ${name}`);
  return run();
}

describe('the reusable store suite', () => {
  it('keeps test support out of the production entry point', () => {
    assert.ok(!('historyStoreTests' in core));
  });

  it('creates and disposes a fresh async fixture for every registered check', async () => {
    const stores = new Set<HistoryStore>();
    let disposed = 0;
    const checks = collect(() => {
      const fixture = memoryFixture();
      stores.add(fixture.store);
      return Promise.resolve({
        ...fixture,
        dispose: () => {
          disposed += 1;
        },
      });
    });
    assert.equal(stores.size, 0);
    assert.equal(checks.size, 8);
    for (const run of checks.values()) await run();
    assert.equal(stores.size, checks.size);
    assert.equal(disposed, checks.size);
  });

  it('disposes a fixture even when a check fails', async () => {
    let disposed = false;
    const error = new Error('Synthetic unreadable store');
    await assert.rejects(
      check('loads an empty store', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, { load: () => Promise.reject(error) }),
          dispose: () => {
            disposed = true;
          },
        };
      }),
      error,
    );
    assert.equal(disposed, true);
  });

  it('awaits asynchronous disposal before a check completes', { timeout: 2000 }, async () => {
    let started!: () => void;
    let release!: () => void;
    const disposing = new Promise<void>((resolve) => {
      started = resolve;
    });
    const cleanup = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    const running = check('loads an empty store', () => ({
      ...memoryFixture(),
      dispose: async () => {
        started();
        await cleanup;
      },
    })).then(() => {
      finished = true;
    });
    try {
      await disposing;
      assert.equal(finished, false);
    } finally {
      release();
      await running;
    }
    assert.equal(finished, true);
  });

  it('rejects a store that returns entries in reverse order', async () => {
    await assert.rejects(
      check('keeps append order and every entry field', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, { load: async () => [...(await fixture.store.load())].reverse() }),
        };
      }),
      { code: 'ERR_ASSERTION' },
    );
  });

  it('rejects an append that mutates the entry supplied to it', async () => {
    await assert.rejects(
      check('keeps append order and every entry field', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, {
            append: (entry) => fixture.store.append(Object.assign(entry, { kind: 'synthetic corruption' })),
          }),
        };
      }),
      { code: 'ERR_ASSERTION' },
    );
  });

  it('rejects sorting by date instead of append order', async () => {
    await assert.rejects(
      check('keeps append order and every entry field', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, {
            load: async () => [...(await fixture.store.load())].sort((a, b) => b.day.localeCompare(a.day)),
          }),
        };
      }),
      { code: 'ERR_ASSERTION' },
    );
  });

  it('rejects early acknowledgement even when the writer cache looks correct', async () => {
    const visible = new MemoryStore();
    const committed = new MemoryStore();
    await assert.rejects(
      check('acknowledges only committed appends', () => ({
        store: visible,
        readCommitted: () => committed.load(),
      })),
      { code: 'ERR_ASSERTION' },
    );
    assert.equal((await visible.load()).length, 1);
    assert.deepEqual(await committed.load(), []);
  });

  it('waits for a correctly delayed append before checking committed data', { timeout: 2000 }, async () => {
    const fixture = memoryFixture();
    let started!: () => void;
    let release!: () => void;
    const writing = new Promise<void>((resolve) => {
      started = resolve;
    });
    const commit = new Promise<void>((resolve) => {
      release = resolve;
    });
    let finished = false;
    const running = check('acknowledges only committed appends', () => ({
      ...fixture,
      store: overrideStore(fixture.store, {
        append: async (entry) => {
          started();
          await commit;
          await fixture.store.append(entry);
        },
      }),
    })).then(() => {
      finished = true;
    });
    try {
      await writing;
      assert.equal(finished, false);
      assert.deepEqual(await fixture.readCommitted(), []);
    } finally {
      release();
      await running;
    }
    assert.equal(finished, true);
  });

  it('rejects an erasure that retains a salt or a content wrapper', async () => {
    await assert.rejects(
      check('erases only the requested content and preserves headers', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, {
            load: async () =>
              (await fixture.store.load()).map((entry) =>
                entry.content === null ? { ...entry, content: { salt: '0'.repeat(32), body: null } } : entry,
              ),
          }),
        };
      }),
      { code: 'ERR_ASSERTION' },
    );
  });

  it('rejects an erasure that also removes unrelated content', async () => {
    await assert.rejects(
      check('erases only the requested content and preserves headers', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, {
            eraseContent: async () => fixture.store.eraseContent((await fixture.store.load()).map((entry) => entry.id)),
          }),
        };
      }),
      { code: 'ERR_ASSERTION' },
    );
  });

  it('rejects an erasure that rewrites a retained header', async () => {
    await assert.rejects(
      check('erases only the requested content and preserves headers', () => {
        const fixture = memoryFixture();
        return {
          ...fixture,
          store: overrideStore(fixture.store, {
            eraseContent: async (ids) => {
              for (const entry of await fixture.store.load()) {
                if (ids.includes(entry.id)) Object.assign(entry, { hash: 'f'.repeat(64) });
              }
              await fixture.store.eraseContent(ids);
            },
          }),
        };
      }),
      { code: 'ERR_ASSERTION' },
    );
  });

  it('rejects erasure acknowledgement when committed content is still present', async () => {
    const fixture = memoryFixture();
    const committed = new MemoryStore();
    await assert.rejects(
      check('erases only the requested content and preserves headers', () => ({
        store: overrideStore(fixture.store, {
          append: async (entry) => {
            await fixture.store.append(entry);
            await committed.append(entry);
          },
        }),
        readCommitted: () => committed.load(),
      })),
      { code: 'ERR_ASSERTION' },
    );
    assert.ok((await committed.load()).every((entry) => entry.content !== null));
  });
});
