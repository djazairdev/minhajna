// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The pilot's timing store (#220): timings kept beside the history, never
// in it, read back as kept, all or none of a batch, a mid-week day or a
// part of a tenth refused, and deleted by a clear; only once the history is
// open. Made-up figures only.

import { parseDay, type Timing } from '@minhajna/core';
import { FakeStorage } from '../jest/fake-storage';
import { timingStore } from '../src/pilot/timing-store';

const week = parseDay('2026-10-11');
const timings: Timing[] = [
  { kind: 'session', week, tenths: 42, oneTap: true },
  { kind: 'roll', week, tenths: 610, oneTap: false },
];

test('timings are kept beside the history, read back, and cleared', async () => {
  const storage = FakeStorage.unlocked();
  const store = timingStore(storage.asSpec(), 0);
  await store.add(timings);
  await store.add([]);
  expect(await store.load()).toEqual(timings);
  expect(storage.rows).toEqual([]);
  expect(Object.keys(storage.timings[0] ?? {}).sort()).toEqual(['kind', 'oneTap', 'tenths', 'week']);
  await store.clear();
  expect(await store.load()).toEqual([]);
});

test('a batch with a malformed timing or a mid-week day keeps none of it', async () => {
  const storage = FakeStorage.unlocked();
  const store = timingStore(storage.asSpec(), 0);
  await expect(store.add([...timings, { kind: 'roll', week, tenths: -1, oneTap: false }])).rejects.toThrow();
  await expect(store.add([{ kind: 'roll', week: parseDay('2026-10-15'), tenths: 1, oneTap: false }])).rejects.toThrow();
  await expect(store.add([{ ...timings[0], tenths: 1.5 }])).rejects.toThrow();
  expect(await store.load()).toEqual([]);
});

test('nothing is kept or read while the history is locked', async () => {
  const storage = new FakeStorage();
  storage.pin = '1234';
  const store = timingStore(storage.asSpec(), 0);
  await expect(store.add(timings)).rejects.toThrow('not open');
  await expect(store.load()).rejects.toThrow('not open');
});
