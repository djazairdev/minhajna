// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signed plan packs (#223 part 2, answers 326 to 329): each trusted key
// says what it may sign, a pack's release reads against the country, and
// adding one puts it in the catalogue beside the bundled packs while each
// class stays on the release it is pinned to. Made-up packs and keys only.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addedPackHolds,
  addPack,
  CALENDAR_UPDATE_FORMAT,
  keySigns,
  makeContext,
  packAddStatus,
  packKey,
  PACK_UPDATE_FORMAT,
  parsePackUpdate,
  parseTrustedKeys,
  recordsForRoute,
  signedKindOf,
  type PackUpdate,
} from '../src/index.ts';
import { cemEvents, d, mathPackSource, openBook, reference } from './fixtures.ts';
import { makeTestKey, nodeVerifier, signedFile } from './signed-fixtures.ts';

const payload = (release: string, changes: Record<string, unknown> = {}) => ({
  format: PACK_UPDATE_FORMAT,
  version: { major: 1, minor: 0 },
  country: 'dz',
  published: '2026-10-03',
  pack: { ...mathPackSource, release },
  ...changes,
});
const read = (release: string): PackUpdate => {
  const result = parsePackUpdate(payload(release), reference.country);
  if (!result.ok) throw new Error(JSON.stringify(result.problems));
  return result.value;
};

test('a trusted key says what it may sign, and a file says what it holds', () => {
  const entry = { ...makeTestKey().trusted };
  assert.ok(parseTrustedKeys({ format: 1, keys: [{ ...entry, signs: ['packs'] }] }).ok);
  const problems = (signs: unknown) => {
    const result = parseTrustedKeys({ format: 1, keys: [{ ...entry, signs }] });
    return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
  };
  assert.deepEqual(problems(undefined), ['keys[0].signs required']);
  assert.deepEqual(problems([]), ['keys[0].signs invalid']);
  assert.deepEqual(problems(['packs', 'packs']), ['keys[0].signs invalid']);
  assert.deepEqual(problems(['timetables']), ['keys[0].signs unknown-reference']);
  const packsOnly = makeTestKey('example-igp', ['packs']).trusted;
  assert.equal(keySigns(packsOnly, 'packs'), true);
  assert.equal(keySigns(packsOnly, 'calendar'), false);
  assert.equal(signedKindOf(payload('2026.2')), 'packs');
  assert.equal(signedKindOf({ format: CALENDAR_UPDATE_FORMAT }), 'calendar');
  assert.equal(signedKindOf({ format: 'minhajna.timetable' }), null);
  assert.equal(signedKindOf('text'), null);
});

test("a signed pack reads for the app's country, and its problems name the pack's own fields", () => {
  assert.equal(read('2026.2').pack.release, '2026.2');
  assert.equal(read('2026.2').published, d('2026-10-03'));
  const problems = (input: unknown) => {
    const result = parsePackUpdate(input, reference.country);
    return result.ok ? [] : result.problems.map((one) => `${one.path} ${one.problem}`);
  };
  assert.deepEqual(problems(payload('2026.2', { country: 'tn' })), ['country unknown-reference']);
  assert.deepEqual(problems(payload('2026.2', { version: { major: 2, minor: 0 } })), ['version invalid']);
  assert.deepEqual(problems(payload('2026.2', { published: '2026-13-01' })), ['published invalid']);
  const foreign = payload('2026.2', { pack: { ...mathPackSource, id: 'tn.cem.1am.math.example' } });
  assert.deepEqual(problems(foreign), ['pack.id unknown-reference']);
  assert.ok(problems(payload('2026.x')).every((one) => one.startsWith('pack.')));
  assert.deepEqual(problems(payload('2026.2', { pack: 'not a pack' })), ['pack invalid']);
  assert.deepEqual(problems({ ...payload('2026.2'), format: CALENDAR_UPDATE_FORMAT }), [' invalid']);
});

test('a newer release joins the catalogue once, and the class stays on its own release (answer 329)', async () => {
  const book = await openBook(cemEvents());
  const context = () => makeContext(reference, book.state);
  assert.equal(packAddStatus(context(), read('2026.1').pack), 'held');
  const update = read('2026.2');
  assert.equal(packAddStatus(context(), update.pack), 'new');
  await book.record(d('2026-10-04'), addPack(context(), update, 'example-ministry', '{}'));
  assert.equal(packAddStatus(context(), update.pack), 'held');
  assert.throws(() => addPack(context(), update, 'example-ministry', '{}'), /can add/);
  assert.ok(context().ref.packs.has(packKey(mathPackSource.id, '2026.2')));
  assert.ok(context().ref.packs.has(packKey(mathPackSource.id, '2026.1')));
  assert.deepEqual(book.state.courses.get('c-math')!.pack, { id: mathPackSource.id, release: '2026.1' });
  assert.equal(book.state.addedPacks.length, 1);
  const sent = recordsForRoute(book.state, 'handover').filter((one) => one.kind === 'pack.added');
  assert.deepEqual(sent, [{ kind: 'pack.added', added: { update, key: 'example-ministry', file: '{}' } }]);
});

test('an older release is not added, unless a class is pinned to it and misses it', async () => {
  const book = await openBook(cemEvents());
  await book.record(d('2026-10-04'), addPack(makeContext(reference, book.state), read('2026.3'), 'k', '{}'));
  assert.equal(packAddStatus(makeContext(reference, book.state), read('2026.2').pack), 'older');
  const packs = new Map([...reference.packs].filter(([key]) => !key.startsWith(mathPackSource.id)));
  const missing = makeContext({ ...reference, packs }, book.state);
  assert.equal(packAddStatus(missing, read('2026.1').pack), 'new');
  assert.equal(packAddStatus(missing, read('2026.2').pack), 'older');
});

test('a bundled release keeps its place over an added copy of the same release', async () => {
  const book = await openBook(cemEvents());
  const copy = { ...read('2026.1'), pack: { ...read('2026.1').pack, items: [] } };
  const packs = new Map([...reference.packs].filter(([key]) => !key.startsWith(mathPackSource.id)));
  await book.record(d('2026-10-04'), addPack(makeContext({ ...reference, packs }, book.state), copy, 'k', '{}'));
  const kept = makeContext(reference, book.state).ref.packs.get(packKey(mathPackSource.id, '2026.1'));
  assert.ok(kept !== undefined && kept.items.length > 0);
});

test("an added pack from another device holds only if its file, its key and the key's kinds all check", async () => {
  const key = makeTestKey();
  const file = signedFile(key, payload('2026.2'));
  const added = { update: read('2026.2'), key: key.trusted.id, file };
  const holds = (one: typeof added, keys = [key.trusted]) => addedPackHolds(one, keys, nodeVerifier, reference.country);
  assert.equal(await holds(added), true);
  assert.equal(await holds({ ...added, update: read('2026.3') }), false);
  assert.equal(await holds({ ...added, key: 'example-other' }), false);
  assert.equal(await holds(added, [{ ...key.trusted, signs: ['calendar'] }]), false);
  assert.equal(await holds(added, []), false);
});
