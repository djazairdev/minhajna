// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sync over a weak link: drops repeat for a seed; resuming finishes a full
// year over the weakest link, re-sends at most a batch a drop, and arrives
// whole and verified; restarting costs more there. Made-up records only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyHistory } from '@minhajna/core';
import { decodeChanges, encodeChanges, makeKey, openBatches, sealBatches, sealedSize } from '../src/batches.ts';
import { demoYear, deps } from '../src/demo.ts';
import { PROFILES, REQUEST_OVERHEAD_BYTES, SimulatedLink, type LinkProfile } from '../src/link.ts';
import { BatchServer, download, upload } from '../src/transfer.ts';

const year = await demoYear('primary');
const key = await makeKey();
const batches = await sealBatches(key, 'year', 0, await encodeChanges(year.entries), 4096);
const gprs = PROFILES[0]!;
const steady: LinkProfile = { ...gprs, name: 'steady', meanSecondsBetweenDrops: Infinity };

test('the same seed drops the link at the same moments', () => {
  const run = (seed: number) => {
    const link = new SimulatedLink(gprs, seed);
    return Array.from({ length: 20 }, () => link.request(3000, 8).done);
  };
  assert.deepEqual(run(3), run(3));
  assert.notDeepEqual(run(3), run(4));
});

test('a link that never drops sends everything in one request', () => {
  const server = new BatchServer();
  const result = upload(new SimulatedLink(steady, 1), server, 'year', batches, 'resume');
  assert.equal(result.completed, true);
  assert.equal(result.requests, 1);
  assert.equal(result.bytes, result.payload + 8 + REQUEST_OVERHEAD_BYTES);
  assert.equal(server.next('year'), batches.length);
});

test('resuming finishes a full year over GPRS, losing at most a batch and what was in flight a drop', async () => {
  const inFlight = (gprs.roundTripMs / 2) * (gprs.upBitsPerSecond / 8000);
  for (let seed = 1; seed <= 10; seed++) {
    const server = new BatchServer();
    const up = upload(new SimulatedLink(gprs, seed), server, 'year', batches, 'resume');
    assert.equal(up.completed, true);
    assert.ok(
      up.bytes <= up.payload + up.requests * (REQUEST_OVERHEAD_BYTES + 8) + up.drops * (sealedSize(4096) + inFlight),
    );
    const down = download(new SimulatedLink(gprs, seed + 100), server, 'year', 0, 'resume');
    assert.equal(down.result.completed, true);
    const sets = await openBatches(key, 'year', down.batches);
    const entries = (await Promise.all(sets.map(decodeChanges))).flat();
    assert.deepEqual(await verifyHistory(deps.digest, entries), []);
    assert.deepEqual(entries, JSON.parse(JSON.stringify(year.entries)));
  }
});

test('restarting from zero costs more time and data than resuming over GPRS', () => {
  const total = (strategy: 'resume' | 'restart') => {
    let ms = 0;
    let bytes = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const result = upload(new SimulatedLink(gprs, seed), new BatchServer(), 'year', batches, strategy);
      ms += result.ms;
      bytes += result.bytes;
    }
    return { ms, bytes };
  };
  const resume = total('resume');
  const restart = total('restart');
  assert.ok(restart.ms > resume.ms * 1.5);
  assert.ok(restart.bytes > resume.bytes * 1.5);
});

test('the server keeps a batch sent twice once, and refuses a gap', () => {
  const server = new BatchServer();
  server.put('s', batches[0]!);
  server.put('s', batches[0]!);
  assert.equal(server.next('s'), 1);
  assert.throws(() => server.put('s', batches[2]!), /skips/);
});
