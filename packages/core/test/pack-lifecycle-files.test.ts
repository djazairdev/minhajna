// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// #612's signed history and fixed-size relay records: real mode and another
// world refuse publications, altered bytes and source contents do not win,
// and a missing draft, stale revision or future date cannot advance a pack.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalJson,
  openPackReleaseBatches,
  openSigned,
  PACK_BYTES,
  PACK_RELEASE_FORMAT,
  packReleaseKey,
  packReleasePlace,
  packReleaseRecords,
  parsePackUpdate,
  sealPackRelease,
  worldSignedFile,
} from '../src/index.ts';
import { country } from './fixtures.ts';
import { day, fixture, source } from './pack-lifecycle-fixtures.ts';
import { nodeVerifier } from './signed-fixtures.ts';
import { cipher, mac } from './world-crypto.ts';

describe('signed demo pack releases', () => {
  it('replays the lifecycle and opens a publication only inside its own world', async () => {
    const f = fixture();
    const published = await f.published('2026.1', 'ministry');
    const read = await packReleaseRecords(f.records, f.keys, country, day, nodeVerifier);
    const found = read.get(packReleaseKey(source.id, '2026.1'))!;
    assert.equal(found.pack.status, 'official');
    assert.deepEqual(found, published);
    const file = found.file!;
    assert.equal((await openSigned(file, f.keys.trusted, nodeVerifier, PACK_BYTES)).ok, false);
    assert.equal((await openSigned(file, f.keys.trusted, nodeVerifier, PACK_BYTES, 'FGHJK')).ok, false);
    const update = await openSigned(file, f.keys.trusted, nodeVerifier, PACK_BYTES, f.keys.world);
    assert.equal(update.ok, true);
    if (update.ok) {
      const parsed = parsePackUpdate(update.payload, country);
      assert.equal(parsed.ok, true);
      if (parsed.ok) assert.deepEqual(parsed.value.pack, found.pack);
    }
  });

  it('keeps publication bytes after withdrawal and ignores duplicates and forged replacements', async () => {
    const f = fixture();
    const published = await f.published();
    const withdrawn = await f.change(published, { stage: 'withdrawn' });
    const tampered = {
      ...withdrawn,
      revision: withdrawn.revision + 1,
      pack: { ...source, provenance: { ...source.provenance, edition: 'Changed after publication' } },
    };
    const signed = await worldSignedFile(
      f.keys,
      'world-ministry',
      canonicalJson({ format: PACK_RELEASE_FORMAT, release: tampered }),
      f.sign,
    );
    const read = await packReleaseRecords([...f.records, ...f.records, signed], f.keys, country, day, nodeVerifier);
    assert.deepEqual([...read.values()], [withdrawn]);
    assert.equal(withdrawn.file, published.file);
  });

  it('does not advance a missing or future draft and refuses a tampered signature or inner publication', async () => {
    const f = fixture();
    const published = await f.published();
    assert.equal((await packReleaseRecords(f.records.slice(1), f.keys, country, day, nodeVerifier)).size, 0);
    const before = [...f.records];
    const raw = JSON.parse(before[2]!) as { payload: string };
    raw.payload = raw.payload.replace('published', 'withdrawn');
    const forged = await worldSignedFile(
      f.keys,
      'world-ministry',
      canonicalJson({
        format: PACK_RELEASE_FORMAT,
        release: { ...published, file: published.file!.replace('2026.1', '2026.2') },
      }),
      f.sign,
    );
    const read = await packReleaseRecords(
      [...before.slice(0, 2), JSON.stringify(raw), forged],
      f.keys,
      country,
      day,
      nodeVerifier,
    );
    assert.equal([...read.values()][0]?.stage, 'under-review');
    const future = await worldSignedFile(
      f.keys,
      'world-ministry',
      canonicalJson({ format: PACK_RELEASE_FORMAT, release: { ...published, day: '2026-11-02' } }),
      f.sign,
    );
    assert.equal(
      [...(await packReleaseRecords([...before.slice(0, 2), future], f.keys, country, day, nodeVerifier)).values()][0]
        ?.stage,
      'under-review',
    );
  });

  it('seals records at one size without source text, with fresh nonces and a bounded atomic upload', async () => {
    const f = fixture();
    await f.published();
    const place = await packReleasePlace(new Uint8Array(32).fill(7), mac);
    const sealed = await sealPackRelease(place, f.records[2]!, 0, cipher);
    assert.equal(
      sealed.every((batch) => batch.bytes.length === 4124),
      true,
    );
    assert.equal(
      Buffer.concat(sealed.map((batch) => Buffer.from(batch.bytes))).includes(Buffer.from(source.id)),
      false,
    );
    assert.deepEqual(await openPackReleaseBatches(place, sealed, cipher), [f.records[2]]);
    assert.notDeepEqual(await sealPackRelease(place, f.records[2]!, 0, cipher), sealed);
    const other = await packReleasePlace(new Uint8Array(32).fill(8), mac);
    await assert.rejects(openPackReleaseBatches(other, sealed, cipher), /E_PACK_HISTORY/);
    assert.ok(sealed.length > 1);
    await assert.rejects(openPackReleaseBatches(place, sealed.slice(1), cipher), /E_PACK_HISTORY/);
    await assert.rejects(openPackReleaseBatches(place, sealed.slice(0, -1), cipher), /E_PACK_HISTORY/);
    assert.deepEqual(await openPackReleaseBatches(place, [sealed[0]!, ...sealed], cipher), [f.records[2]]);
    await assert.rejects(sealPackRelease(place, 'x'.repeat(600000), 0, cipher), RangeError);
  });

  it('refuses an incomplete revision history when the caller will author another change', async () => {
    const f = fixture();
    await f.published();
    await assert.rejects(
      packReleaseRecords(f.records.slice(1), f.keys, country, day, nodeVerifier, true),
      /E_PACK_HISTORY/,
    );
    assert.equal((await packReleaseRecords(f.records, f.keys, country, day, nodeVerifier, true)).size, 1);
  });
});
