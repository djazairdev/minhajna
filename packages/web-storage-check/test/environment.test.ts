// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Browser permission branches without a network or a real permission prompt.

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { storageStatus } from '../src/environment.ts';
import { messages } from '../src/text.ts';

const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

function navigatorWith(storage: unknown): void {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { storage } });
}

afterEach(() => {
  if (descriptor !== undefined) Object.defineProperty(globalThis, 'navigator', descriptor);
});

describe('Storage permission and estimate reporting', () => {
  it('does not ask for persistence while just reading the estimate', async () => {
    let requests = 0;
    navigatorWith({
      estimate: () => Promise.resolve({ usage: 500, quota: 1000 }),
      persisted: () => Promise.resolve(false),
      persist: () => {
        requests += 1;
        return Promise.resolve(true);
      },
    });
    assert.deepEqual(await storageStatus(), { usage: 500, quota: 1000, persisted: false, estimate: 'available' });
    assert.equal(requests, 0);
    assert.equal((await storageStatus(true)).persisted, true);
    assert.equal(requests, 1);
  });

  it('reports a denied grant as false, not a successful storage guarantee', async () => {
    navigatorWith({ persist: () => Promise.resolve(false) });
    assert.equal((await storageStatus(true)).persisted, false);
  });

  it('preserves unsupported APIs and missing estimates instead of fabricating zero', async () => {
    navigatorWith(undefined);
    assert.deepEqual(await storageStatus(true), {
      usage: null,
      quota: null,
      persisted: 'unsupported',
      estimate: 'unsupported',
    });
    navigatorWith({ estimate: () => Promise.resolve({}) });
    assert.deepEqual(await storageStatus(), {
      usage: null,
      quota: null,
      persisted: 'unsupported',
      estimate: 'available',
    });
  });

  it('reports permission and estimate errors independently', async () => {
    navigatorWith({
      persisted: () => Promise.reject(new Error('invented')),
      estimate: () => Promise.resolve({ quota: 1000 }),
    });
    assert.deepEqual(await storageStatus(), { usage: null, quota: 1000, persisted: 'error', estimate: 'available' });
    navigatorWith({
      persisted: () => Promise.resolve(true),
      estimate: () => Promise.reject(new Error('invented')),
    });
    assert.deepEqual(await storageStatus(), { usage: null, quota: null, persisted: true, estimate: 'error' });
  });

  it('has the same nonempty message keys in Arabic, French and English', () => {
    const keys = Object.keys(messages('en')).sort();
    for (const language of ['ar', 'fr', 'en']) {
      assert.deepEqual(Object.keys(messages(language)).sort(), keys);
      assert.ok(Object.values(messages(language)).every((text) => text.trim().length > 0));
    }
    assert.deepEqual(messages('unknown'), messages('ar'));
  });
});
