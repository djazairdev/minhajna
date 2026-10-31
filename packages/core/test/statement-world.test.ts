// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Statements signed in a demo world (#563, answer 577): the world's statement
// names it and signs the world's mark before the payload; it checks only in
// that world, real mode and other worlds refusing it, as a world refuses a
// real statement; a world that is no ID is refused, and a changed statement
// is said to be changed whatever world it names; taking the world out or
// changing it breaks the signature; a store keeps and lists only its own
// world's statements, each as it was checked; a world's ID is checked before
// signing; and a world's statement said to fit one QR code does. Made-up keys
// and statements only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkStatement,
  fitsInQr,
  isWorldId,
  makeWorldCode,
  progressStatement,
  receivedStatements,
  receiveStatement,
  signStatement,
  statementFitsInQr,
  statementPayload,
  worldIdOfCode,
  worldSignedText,
  type ProgressStatement,
} from '../src/index.ts';
import { cemEvents, contextOf, d, openBook } from './fixtures.ts';
import { random } from './school-devices.ts';
import { makeTestKey, nodeVerifier } from './signed-fixtures.ts';

const key = makeTestKey('example-teacher');
const fresh = async () => progressStatement(contextOf(await openBook(cemEvents())), 'c-math', d('2026-10-01'))!;
const sign = (statement: ProgressStatement, world: string | null) =>
  signStatement(statement, key.trusted.spki, (text) => Promise.resolve(key.sign(text)), world);
const fields = (text: string) => JSON.parse(text) as Record<string, unknown>;

test('a world’s statement names it, signs its mark first, and checks only in that world', async () => {
  const statement = await fresh();
  const signed: string[] = [];
  const text = await signStatement(
    statement,
    key.trusted.spki,
    (one) => {
      signed.push(one);
      return Promise.resolve(key.sign(one));
    },
    'ABCDE',
  );
  assert.deepEqual(signed, [worldSignedText('ABCDE', statementPayload(statement))]);
  assert.equal(fields(text)['world'], 'ABCDE');
  const checked = await checkStatement(text, nodeVerifier, 'ABCDE');
  assert.deepEqual(checked, { ok: true, statement, spki: key.trusted.spki });
  assert.deepEqual(await checkStatement(text, nodeVerifier), { ok: false, problem: 'world' });
  assert.deepEqual(await checkStatement(text, nodeVerifier, 'FGHJK'), { ok: false, problem: 'world' });
});

test('a world refuses a real statement, a world that is no ID is refused, and a change is a change', async () => {
  const real = await sign(await fresh(), null);
  assert.equal('world' in fields(real), false);
  assert.equal((await checkStatement(real, nodeVerifier)).ok, true);
  assert.deepEqual(await checkStatement(real, nodeVerifier, 'ABCDE'), { ok: false, problem: 'world' });
  for (const world of [null, '', 'abcde', 5])
    assert.deepEqual(await checkStatement(JSON.stringify({ ...fields(real), world }), nodeVerifier), {
      ok: false,
      problem: 'invalid',
    });
  const forged = JSON.stringify({ ...fields(real), world: 'ABCDE' });
  assert.deepEqual(await checkStatement(forged, nodeVerifier), { ok: false, problem: 'signature' });
  assert.deepEqual(await checkStatement(forged, nodeVerifier, 'ABCDE'), { ok: false, problem: 'signature' });
});

test('a store keeps and lists only the statements of its own world', async () => {
  const statement = await fresh();
  const later = { ...statement, day: d('2026-10-08') };
  const code = makeWorldCode(random);
  const world = worldIdOfCode(code);
  const [real, own, other] = [await sign(statement, null), await sign(statement, world), await sign(later, 'FGHJK')];
  const kept = (text: string, id: string) => ({
    kind: 'statement.received' as const,
    received: { id, text, how: 'file' as const },
  });
  const mine = await openBook([]);
  await mine.recordAll(d('2026-10-09'), [kept(real, 'r-1'), kept(own, 'r-2'), kept(other, 'r-3')]);
  assert.deepEqual(
    receivedStatements(mine.entries).map((one) => one.id),
    ['r-1'],
  );
  const worlds = await openBook([]);
  await worlds.record(d('2026-10-09'), { kind: 'world.kept', kept: { kind: 'national', code, starter: null } });
  await worlds.recordAll(d('2026-10-09'), [kept(real, 'r-1'), kept(own, 'r-2'), kept(other, 'r-3')]);
  assert.deepEqual(
    receivedStatements(worlds.entries).map((one) => one.id),
    ['r-2'],
  );

  const check = async (text: string, named: string | null) => {
    const result = await checkStatement(text, nodeVerifier, named);
    assert.ok(result.ok);
    return result;
  };
  const fresher = await openBook([]);
  await fresher.record(d('2026-10-09'), { kind: 'world.kept', kept: { kind: 'national', code, starter: null } });
  const [ownCheck, realCheck] = [await check(own, world), await check(real, null)];
  assert.notEqual(receiveStatement(fresher.entries, own, ownCheck, 'qr', 'r-4'), null);
  assert.throws(() => receiveStatement(fresher.entries, real, realCheck, 'qr', 'r-5'), RangeError);
  assert.throws(() => receiveStatement(mine.entries, own, ownCheck, 'qr', 'r-6'), RangeError);
  const sameKey = await sign(later, world);
  assert.throws(() => receiveStatement(fresher.entries, sameKey, ownCheck, 'qr', 'r-7'), RangeError);
});

test('taking the world out of a world’s statement, or changing it, breaks the signature', async () => {
  const stripped = fields(await sign(await fresh(), 'ABCDE'));
  delete stripped['world'];
  assert.deepEqual(await checkStatement(JSON.stringify(stripped), nodeVerifier), { ok: false, problem: 'signature' });
  const moved = JSON.stringify({ ...stripped, world: 'FGHJK' });
  assert.deepEqual(await checkStatement(moved, nodeVerifier, 'FGHJK'), { ok: false, problem: 'signature' });
});

test('only a world’s ID is signed in, and a world’s statement said to fit one QR code does', async () => {
  const statement = await fresh();
  for (const bad of ['', 'abcde', 'ABCDEF', 'ABCDI', 'ABCD']) await assert.rejects(sign(statement, bad), TypeError);
  assert.equal(isWorldId('ABCDE'), true);
  assert.equal(isWorldId(['ABCDE']), false);
  assert.equal(statementFitsInQr(statement, 'ABCDE'), true);
  assert.equal(fitsInQr(await sign(statement, 'ABCDE')), true);
  const long = { ...statement, lastResource: { id: 'u1-2', title: 'م'.repeat(66), status: 'started' as const } };
  const exact = [statementFitsInQr(long), statementFitsInQr(long, 'ABCDE')];
  assert.deepEqual(exact, [true, false]);
});
