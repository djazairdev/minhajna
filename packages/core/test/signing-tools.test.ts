// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { CALENDAR_UPDATE_FORMAT, openSigned, parseTrustedKeys } from '../src/index.ts';
import {
  insideRepository,
  makeKey,
  openPrivateKey,
  QR_BYTES,
  readBundled,
  REPOSITORY,
  signUpdate,
} from '../scripts/signing.ts';
import { nodeVerifier } from './signed-fixtures.ts';

const passphrase = 'example passphrase, made up';
const holder = { ar: 'جهة تجريبية', en: 'Example holder' };
const update = (release: string, entries: unknown[] = [holiday('example-a', '2026-11-26')]) => ({
  format: CALENDAR_UPDATE_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  year: '2026-2027',
  release,
  published: '2026-10-13',
  entries,
  removed: [],
});
const holiday = (id: string, day: string, source = 'Example notice, not an official announcement') => ({
  id,
  layer: 'national',
  from: day,
  to: day,
  effect: 'no-school',
  name: { en: 'Example holiday' },
  source,
  confidence: 'announced',
});

test('makes a P-256 key whose entry the app reads, its private half encrypted', () => {
  const made = makeKey('example-ministry', holder, passphrase);
  const read = parseTrustedKeys({ format: 1, keys: [made.entry] });
  assert.ok(read.ok);
  const der = Buffer.from(made.entry.spki, 'base64');
  assert.equal(createHash('sha256').update(der).digest('hex'), made.entry.fingerprint);
  assert.match(made.privatePem, /^-----BEGIN ENCRYPTED PRIVATE KEY-----/);
  const key = openPrivateKey(made.privatePem, passphrase);
  assert.equal(createPublicKey(key).export({ type: 'spki', format: 'der' }).toString('base64'), made.entry.spki);
  assert.throws(() => openPrivateKey(made.privatePem, 'another passphrase'), /wrong passphrase/);
  assert.throws(() => openPrivateKey(made.entry.spki, passphrase), /does not open/);
  assert.throws(() => makeKey('example-ministry', holder, 'too short'), /at least 20/);
  assert.throws(() => makeKey('Not An ID', holder, passphrase), /does not read/);
});

test('signs an update that opens as the phone opens it, and says whether it fits a QR code', async () => {
  const made = makeKey('example-ministry', holder, passphrase);
  const bundled = { ...readBundled(), keys: [made.entry] };
  const key = openPrivateKey(made.privatePem, passphrase);
  const signed = await signUpdate(update('2026.5'), key, 'example-ministry', bundled);
  const opened = await openSigned(signed.file, bundled.keys, nodeVerifier);
  assert.ok(opened.ok);
  assert.deepEqual(opened.payload, update('2026.5'));
  assert.equal(signed.update.release, '2026.5');
  assert.equal(signed.bytes, Buffer.byteLength(signed.file, 'utf8'));
  assert.equal(signed.qr, true);
  const long = Array.from({ length: 30 }, (_, index) =>
    holiday(`example-${index}`, '2026-11-26', 'Example notice, not an official announcement, repeated to fill'),
  );
  const large = await signUpdate(update('2026.5', long), key, 'example-ministry', bundled);
  assert.ok(large.bytes > QR_BYTES);
  assert.equal(large.qr, false);
});

test('refuses what the phone would refuse, before writing anything', async () => {
  const made = makeKey('example-ministry', holder, passphrase);
  const bundled = { ...readBundled(), keys: [made.entry] };
  const key = openPrivateKey(made.privatePem, passphrase);
  const sign = (input: unknown, id = 'example-ministry', with_ = key) => signUpdate(input, with_, id, bundled);
  await assert.rejects(sign(update('2026.4')), /not after the bundled calendar's 2026.4/);
  await assert.rejects(sign(update('2026.2')), /not after/);
  await assert.rejects(sign({ ...update('2026.5'), year: '2027-2028' }), /does not read: year/);
  await assert.rejects(sign({ ...update('2026.5'), extra: true }), /as written, such as a misspelled field: extra$/);
  const misspelled = { ...holiday('example-b', '2026-11-25'), layer: 'zone', zon: '16' };
  await assert.rejects(sign(update('2026.5', [misspelled])), /does not read/);
  const scoped = { ...holiday('example-b', '2026-11-25'), levels: ['cem'], level: 'cem' };
  await assert.rejects(sign(update('2026.5', [holiday('example-a', '2026-11-26'), scoped])), /: entries\/1$/);
  await assert.rejects(sign({ ...update('2026.5'), version: { major: 1, minor: 1 } }), /: version$/);
  await assert.rejects(sign(update('2026.5'), 'example-other'), /lists no key example-other/);
  const other = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey;
  await assert.rejects(sign(update('2026.5'), 'example-ministry', other), /not the one/);
  const many = Array.from({ length: 200 }, (_, index) => holiday(`example-${index}`, '2026-11-26'));
  await assert.rejects(sign(update('2026.5', many)), /the app reads at most 16384/);
});

test('the bundled data reads, and the private half is never written inside a Git working copy', () => {
  const bundled = readBundled();
  assert.equal(bundled.calendar.release, '2026.4');
  assert.equal(insideRepository(REPOSITORY), true);
  const data = new URL('../../../data/dz/', import.meta.url).pathname;
  assert.equal(insideRepository(data), true);
  const shouted = data.replace(/\/data\/dz\/$/, '/DATA/DZ/');
  if (existsSync(shouted)) assert.equal(insideRepository(shouted), true);
  const outside = mkdtempSync(join(tmpdir(), 'minhajna-key-'));
  try {
    assert.equal(insideRepository(outside), false);
    mkdirSync(join(outside, 'clone', '.git'), { recursive: true });
    mkdirSync(join(outside, 'clone', 'keys'));
    assert.equal(insideRepository(join(outside, 'clone', 'keys')), true);
    assert.throws(() => insideRepository(join(outside, 'missing')), /does not exist/);
  } finally {
    rmSync(outside, { recursive: true });
  }
});

test('an update written without its empty removals signs, as the phone reads it so', async () => {
  const made = makeKey('example-ministry', holder, passphrase);
  const bundled = { ...readBundled(), keys: [made.entry] };
  const short: Record<string, unknown> = update('2026.5');
  delete short['removed'];
  const signed = await signUpdate(short, openPrivateKey(made.privatePem, passphrase), 'example-ministry', bundled);
  assert.deepEqual(signed.update.removed, []);
});
