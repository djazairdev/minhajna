// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openSigned, parseTrustedKeys, SIGNED_BYTES, SIGNED_FORMAT, utf8Length } from '../src/index.ts';
import { makeTestKey, nodeVerifier, signedFile } from './signed-fixtures.ts';

const key = makeTestKey();
const other = makeTestKey('example-other');
const payload = { hello: 'مرحبا', n: 1 };
const fields = (text: string) => JSON.parse(text) as Record<string, unknown>;

test('opens a file signed by a trusted key and reads its payload', async () => {
  const opened = await openSigned(signedFile(key, payload, 3), [other.trusted, key.trusted], nodeVerifier);
  assert.deepEqual(opened, { ok: true, key: key.trusted, minor: 3, payload });
});

test('refuses a payload changed after signing, before reading it', async () => {
  const file = fields(signedFile(key, payload));
  const changed = JSON.stringify({ ...file, payload: JSON.stringify({ ...payload, n: 2 }) });
  assert.deepEqual(await openSigned(changed, [key.trusted], nodeVerifier), {
    ok: false,
    problem: 'signature',
    key: key.trusted,
  });
  const notJson = JSON.stringify({ ...file, payload: 'not json', signature: key.sign('not json') });
  assert.deepEqual(await openSigned(notJson, [key.trusted], nodeVerifier), {
    ok: false,
    problem: 'payload',
    key: key.trusted,
  });
  const garbled = JSON.stringify({ ...file, payload: 'not json', signature: 'AAAA' });
  assert.equal((await openSigned(garbled, [key.trusted], nodeVerifier)).ok, false);
});

test('refuses a signature by another key under a trusted key ID, and an unknown key', async () => {
  const file = fields(signedFile(other, payload));
  const posing = JSON.stringify({ ...file, key: key.trusted.id });
  assert.equal((await openSigned(posing, [key.trusted], nodeVerifier)).ok, false);
  assert.deepEqual(await openSigned(signedFile(other, payload), [key.trusted], nodeVerifier), {
    ok: false,
    problem: 'unknown-key',
  });
  assert.deepEqual(await openSigned(signedFile(key, payload), [], nodeVerifier), {
    ok: false,
    problem: 'unknown-key',
  });
});

test('a verifier that throws counts as a signature that does not check', async () => {
  const throwing = () => Promise.reject(new Error('Bad key'));
  const opened = await openSigned(signedFile(key, payload), [key.trusted], throwing);
  assert.deepEqual(opened, { ok: false, problem: 'signature', key: key.trusted });
});

test('reads the file strictly', async () => {
  const file = fields(signedFile(key, payload));
  const open = (value: unknown) => openSigned(JSON.stringify(value), [key.trusted], nodeVerifier);
  for (const version of [
    { major: 2, minor: 0 },
    { major: 1, minor: -1 },
    { major: 1 },
    { major: 1, minor: 1.5 },
    { major: 1, minor: 0, extra: 1 },
    1,
  ])
    assert.deepEqual(await open({ ...file, version }), { ok: false, problem: 'version' });
  const invalid = [
    { ...file, format: 'minhajna.calendar-entry' },
    { ...file, extra: true },
    { ...file, key: 'Example Key' },
    { ...file, payload: '' },
    { ...file, payload: payload },
    { ...file, signature: 'not base64!' },
    { ...file, signature: 'AAAAA' },
    { ...file, signature: 'AAA' },
    { ...file, signature: 'AA=' },
    { ...file, signature: 'AAAA=' },
    { ...file, payload: '{"text":"\ud800"}' },
    { ...file, signature: 'A'.repeat(204) },
    [file],
  ];
  for (const value of invalid) assert.deepEqual(await open(value), { ok: false, problem: 'invalid' });
  assert.deepEqual(await openSigned('{', [key.trusted], nodeVerifier), { ok: false, problem: 'invalid' });
  assert.equal(SIGNED_FORMAT, file['format']);
});

test('refuses a file over the size limit, counted in UTF-8 bytes', async () => {
  const text = signedFile(key, { text: 'م'.repeat(100) });
  const bytes = utf8Length(text)!;
  assert.ok(bytes > text.length);
  assert.equal((await openSigned(text, [key.trusted], nodeVerifier, bytes)).ok, true);
  assert.deepEqual(await openSigned(text, [key.trusted], nodeVerifier, bytes - 1), { ok: false, problem: 'invalid' });
  const big = signedFile(key, { text: 'x'.repeat(SIGNED_BYTES) });
  assert.deepEqual(await openSigned(big, [key.trusted], nodeVerifier), { ok: false, problem: 'invalid' });
});

test('counts UTF-8 bytes and refuses lone surrogates', () => {
  assert.equal(utf8Length('a'), 1);
  assert.equal(utf8Length('é'), 2);
  assert.equal(utf8Length('م'), 2);
  assert.equal(utf8Length('€'), 3);
  assert.equal(utf8Length('😀'), 4);
  assert.equal(utf8Length('a\ud800b'), null);
  assert.equal(utf8Length('\udc00'), null);
});

test('reads the trusted key list', () => {
  const list = { format: 1, keys: [key.trusted, other.trusted] };
  assert.deepEqual(parseTrustedKeys(list), { ok: true, value: [key.trusted, other.trusted] });
  assert.deepEqual(parseTrustedKeys({ format: 1, keys: [] }), { ok: true, value: [] });
  const paths = (input: unknown) => {
    const result = parseTrustedKeys(input);
    return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
  };
  assert.deepEqual(paths({ keys: [] }), ['format required']);
  assert.deepEqual(paths({ format: 1, keys: [key.trusted, key.trusted] }), ['keys[1].id duplicate']);
  assert.ok(paths({ format: 1, keys: [{ ...key.trusted, fingerprint: 'ABC' }] }).length > 0);
  assert.ok(paths({ format: 1, keys: [{ ...key.trusted, holder: undefined }] }).length > 0);
  assert.ok(paths({ format: 1, keys: [{ ...key.trusted, spki: 'A'.repeat(204) }] }).length > 0);
  assert.ok(paths({ format: 1, keys: ['example'] }).length > 0);
  assert.deepEqual(paths(null), [' invalid']);
});
