// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canonicalJson,
  checkStatement,
  fitsInQr,
  progressStatement,
  readStatement,
  signStatement,
  statementPayload,
  STATEMENT_BYTES,
  STATEMENT_QR_LIMIT,
  type ProgressStatement,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { makeTestKey, nodeVerifier } from './signed-fixtures.ts';

const key = makeTestKey('example-teacher');
const fresh = async () => progressStatement(contextOf(await openBook(cemEvents())), 'c-math', d('2026-10-01'))!;
const fields = (text: string) => JSON.parse(text) as Record<string, unknown>;
const sign = (statement: ProgressStatement) =>
  signStatement(statement, key.trusted.spki, (text) => Promise.resolve(key.sign(text)));

test('canonical payloads round trip, ignoring runtime fields and their order at every level', async () => {
  const statement = await fresh();
  const extra = {
    private: 'Never shared',
    ...statement,
    class: { ...statement.class, pupil: 'Never shared' },
    pack: { ...statement.pack, source: 'Never shared' },
    delay: { ...statement.delay, reason: 'Never shared' },
    notHeld: { ...statement.notHeld, dates: ['2026-09-20'] },
    td: { ...statement.td, notes: 'Never shared' },
  };
  assert.equal(statementPayload(extra), canonicalJson(statement));
  assert.deepEqual(readStatement(JSON.stringify(extra)), { ok: true, value: statement });
  const named = {
    ...extra,
    lastUnit: { id: 'u1', title: 'Unit', note: 'Never shared' },
    lastResource: {
      id: 'l1',
      title: 'Lesson',
      status: 'started',
      reason: 'Never shared',
    },
  };
  const read = readStatement(JSON.stringify(named));
  assert.ok(read.ok);
  assert.deepEqual(read.value.lastUnit, { id: 'u1', title: 'Unit' });
  assert.deepEqual(read.value.lastResource, { id: 'l1', title: 'Lesson', status: 'started' });
});

test('new minor versions retain their number, while unsupported majors and invalid fields fail', async () => {
  const statement = await fresh();
  const minor = { ...statement, version: { major: 1, minor: 3 }, added: true };
  const read = readStatement(JSON.stringify(minor));
  assert.ok(read.ok);
  assert.equal(read.value.version.minor, 3);
  assert.equal(statementPayload(read.value), statementPayload(statement));
  const invalid = [
    null,
    [],
    {},
    { ...statement, format: 'other' },
    { ...statement, version: { major: 2, minor: 0 } },
    { ...statement, version: { major: 1, minor: -1 } },
    { ...statement, day: '2026-10-01T08:00:00Z' },
    { ...statement, day: '2026-02-30' },
    { ...statement, class: { ...statement.class, section: 'x'.repeat(129) } },
    { ...statement, class: { ...statement.class, subject: '\u2066hidden' } },
    { ...statement, class: { ...statement.class, stream: '\ud800' } },
    { ...statement, class: { ...statement.class, grade: 'line\nfeed' } },
    { ...statement, pack: { ...statement.pack, release: 'not a release' } },
    { ...statement, lastUnit: undefined },
    { ...statement, lastResource: { id: 'l1', title: 'Lesson' } },
    { ...statement, lastResource: { id: 'l1', title: 'x'.repeat(513), status: 'done' } },
    { ...statement, delay: { ...statement.delay, sessions: -1 } },
    { ...statement, delay: { ...statement.delay, weeks: 1.5 } },
    { ...statement, notHeld: { calendar: 0.5, other: 0 } },
    { ...statement, td: { calendar: 1, other: 0 } },
    { ...statement, notHeld: { calendar: 0, other: 1_000_001 } },
  ];
  for (const value of invalid) assert.equal(readStatement(JSON.stringify(value)).ok, false);
  for (const text of ['{', 'null', '\ud800', ' '.repeat(STATEMENT_BYTES + 1)])
    assert.equal(readStatement(text).ok, false);
  assert.throws(
    () => statementPayload({ ...statement, day: 'not a date' } as ProgressStatement),
    /Invalid progress statement/,
  );
});

test('a fresh platform signature verifies and a changed payload or public key fails', async () => {
  const statement = await fresh();
  const signed = await sign(statement);
  assert.deepEqual(await checkStatement(signed, nodeVerifier), { ok: true, statement, spki: key.trusted.spki });
  const raw = fields(signed);
  const changed = JSON.stringify({ ...raw, payload: statementPayload({ ...statement, day: d('2026-10-02') }) });
  assert.deepEqual(await checkStatement(changed, nodeVerifier), { ok: false, problem: 'signature' });
  const other = makeTestKey('other-teacher');
  assert.deepEqual(await checkStatement(JSON.stringify({ ...raw, spki: other.trusted.spki }), nodeVerifier), {
    ok: false,
    problem: 'signature',
  });
});

test('checks the signature before parsing the payload and discards unrecognised signed fields', async () => {
  const raw = fields(await sign(await fresh()));
  const notJson = { ...raw, payload: 'not JSON', signature: key.sign('not JSON') };
  assert.deepEqual(await checkStatement(JSON.stringify(notJson), nodeVerifier), { ok: false, problem: 'payload' });
  assert.deepEqual(await checkStatement(JSON.stringify({ ...notJson, signature: 'AAAA' }), nodeVerifier), {
    ok: false,
    problem: 'signature',
  });
  const payload = JSON.stringify({ ...(await fresh()), pupils: ['Never returned'] });
  const checked = await checkStatement(
    JSON.stringify({ ...raw, payload, signature: key.sign(payload), extra: true }),
    nodeVerifier,
  );
  assert.ok(checked.ok);
  assert.equal(JSON.stringify(checked).includes('Never returned'), false);
});

test('rejects malformed envelopes and bounds the complete file before calling crypto', async () => {
  const raw = fields(await sign(await fresh()));
  const invalid = [
    null,
    [],
    {},
    { ...raw, format: 'minhajna.signed' },
    { ...raw, spki: '' },
    { ...raw, spki: 'A'.repeat(204) },
    { ...raw, signature: '!' },
    { ...raw, signature: 'A'.repeat(100) },
    { ...raw, payload: {} },
    { ...raw, payload: '' },
    { ...raw, payload: '\ud800' },
    { ...raw, payload: '\u0645'.repeat(STATEMENT_BYTES) },
  ];
  let calls = 0;
  const verifier = () => {
    calls += 1;
    return Promise.resolve(true);
  };
  for (const value of invalid)
    assert.deepEqual(await checkStatement(JSON.stringify(value), verifier), { ok: false, problem: 'invalid' });
  assert.equal(calls, 0);
  assert.deepEqual(await checkStatement(JSON.stringify({ ...raw, version: { major: 2, minor: 0 } }), verifier), {
    ok: false,
    problem: 'version',
  });
  assert.deepEqual(await checkStatement('{', verifier), { ok: false, problem: 'invalid' });
});

test('platform failures expose neither payloads nor underlying exception details', async () => {
  const statement = await fresh();
  const failing = () => {
    throw new Error('Private platform detail');
  };
  await assert.rejects(signStatement(statement, key.trusted.spki, failing), { message: 'Statement signing failed' });
  assert.deepEqual(await checkStatement(await sign(statement), failing), { ok: false, problem: 'signature' });
  await assert.rejects(
    signStatement(statement, '!', () => Promise.resolve('AAAA')),
    /Invalid statement public key/,
  );
  await assert.rejects(
    signStatement(statement, key.trusted.spki, () => Promise.resolve('!')),
    /Invalid statement signature/,
  );
});

test('signing captures a detached payload before asynchronous platform work', async () => {
  const statement = await fresh();
  const signed = await signStatement(statement, key.trusted.spki, (text) => {
    (statement.class as { section: string }).section = 'Changed later';
    return Promise.resolve(key.sign(text));
  });
  const checked = await checkStatement(signed, nodeVerifier);
  assert.ok(checked.ok);
  assert.equal(checked.statement.class.section, '1AM2');
});

test('QR capacity counts the whole UTF-8 text, reserving the UTF-8 ECI header', () => {
  assert.equal(STATEMENT_QR_LIMIT, 996);
  assert.equal(fitsInQr('x'.repeat(996)), true);
  assert.equal(fitsInQr('x'.repeat(997)), false);
  assert.equal(fitsInQr('\u0645'.repeat(498)), true);
  assert.equal(fitsInQr('\u0645'.repeat(498) + 'x'), false);
  assert.equal(fitsInQr('\ud83d\ude00'.repeat(249)), true);
  assert.equal(fitsInQr('\ud800'), false);
  assert.equal(fitsInQr(''), false);
});

test('an oversized QR keeps the complete signed statement for file sharing instead of truncating it', async () => {
  const statement = await fresh();
  const long = { ...statement, lastResource: { id: 'l1', title: '\u0645'.repeat(512), status: 'started' as const } };
  const signed = await sign(long);
  assert.equal(fitsInQr(signed), false);
  const checked = await checkStatement(signed, nodeVerifier);
  assert.ok(checked.ok);
  assert.deepEqual(checked.statement, long);
  assert.deepEqual(await checkStatement(signed.slice(0, 996), nodeVerifier), { ok: false, problem: 'invalid' });
});
