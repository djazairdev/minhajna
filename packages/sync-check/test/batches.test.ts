// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Fixed batches: every batch the same size whatever it holds, the entries
// back exactly as sent, and a batch that was changed, moved, swapped or
// opened with another key refused. Made-up entries only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  decodeChanges,
  encodeChanges,
  makeKey,
  openBatches,
  pieceRoom,
  sealBatches,
  sealedSize,
} from '../src/batches.ts';
import { between, demoYear } from '../src/demo.ts';
import { parseDay } from '@minhajna/core';

const year = await demoYear('cem');
const week = between(year.entries, parseDay('2026-10-11'), parseDay('2026-10-15'));

test('seals every batch to the same size, an empty change set included', async () => {
  const key = await makeKey();
  const full = await sealBatches(key, 's', 0, await encodeChanges(year.entries), 4096);
  const empty = await sealBatches(key, 's', full.length, new Uint8Array(0), 4096);
  assert.ok(full.length > 1);
  assert.equal(empty.length, 1);
  for (const batch of [...full, ...empty]) assert.equal(batch.bytes.length, sealedSize(4096));
  assert.deepEqual(
    [...full, ...empty].map((batch) => batch.number),
    Array.from({ length: full.length + 1 }, (_, index) => index),
  );
});

test('gives back the entries exactly, across batches and change sets', async () => {
  const key = await makeKey();
  const first = await encodeChanges(year.entries);
  const sealed = [
    ...(await sealBatches(key, 's', 0, first, 2048)),
    ...(await sealBatches(key, 's', Math.ceil(first.length / pieceRoom(2048)), await encodeChanges(week), 2048)),
  ];
  const sets = await openBatches(key, 's', sealed);
  assert.equal(sets.length, 2);
  assert.deepEqual(await decodeChanges(sets[0]!), JSON.parse(JSON.stringify(year.entries)));
  assert.deepEqual(await decodeChanges(sets[1]!), JSON.parse(JSON.stringify(week)));
});

test('a change set that fills its batches exactly still ends', async () => {
  const key = await makeKey();
  const changes = new Uint8Array(pieceRoom(256) * 3).fill(7);
  const sealed = await sealBatches(key, 's', 0, changes, 256);
  assert.equal(sealed.length, 3);
  assert.deepEqual(await openBatches(key, 's', sealed), [changes]);
});

test('refuses a batch changed, moved, swapped, cut short or under another key', async () => {
  const key = await makeKey();
  const sealed = await sealBatches(key, 's', 0, await encodeChanges(week), 512);
  assert.ok(sealed.length >= 2);
  const [first, second] = sealed as [(typeof sealed)[0], (typeof sealed)[0]];
  const flipped = first.bytes.slice();
  flipped[40] = flipped[40]! ^ 1;
  await assert.rejects(openBatches(key, 's', [{ ...first, bytes: flipped }, ...sealed.slice(1)]));
  await assert.rejects(openBatches(key, 'other', sealed));
  await assert.rejects(
    openBatches(key, 's', [
      { ...first, number: 1 },
      { ...second, number: 0 },
    ]),
  );
  await assert.rejects(openBatches(key, 's', sealed.slice(0, -1)), /cut short/);
  await assert.rejects(openBatches(await makeKey(), 's', sealed));
});
