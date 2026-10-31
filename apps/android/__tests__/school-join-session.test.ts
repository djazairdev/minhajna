// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining a school's space inside a demo world (#564, answers 580 and 581),
// against a made-up demo server that keeps the server's own relay and CA: the
// device's key is certified by the world's CA and kept in the world's store,
// and the school reads the joined record back from its channel, while the
// server holds nothing named and no request carries the private key; joining
// again, after a join cut short, or twice at once goes on with one key; junk
// put on the channel first does not hold it back, and the channel is read past
// a page; a code another device joined on first is refused; a text that is no
// code, a code of another world, or a certificate the world's CA did not give
// keeps nothing; and a busy server, a relay that keeps refusing or does not
// page on, and failing cryptography each say so. Every world, school and key is
// made up.

import {
  channelStream,
  joinCodeText,
  keptJoins,
  makeJoinCode,
  newId,
  readJoined,
  type JoinCode,
  type OpenedKeyring,
  type SchoolCalendar,
} from '@minhajna/core';
import { caPublicKey, newCaKey } from '../../server/src/worlds/stand-in-ca';
import { FakeStorage } from '../jest/fake-storage';
import { codeOf, DemoServer, nodeKit as kit } from '../jest/world-server';
import { startWorld } from '../src/demo/world-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { bundledReference, readReference } from '../src/reference';
import { joinSchool } from '../src/school/school-join-session';
import { openRecordBook } from '../src/storage/history';

const read = readReference(bundledReference);
if (!read.ok) throw new Error('The bundled reference does not read');
const calendar: SchoolCalendar = read.calendar;
const server = new DemoServer();
const SCHOOL = 'made-up-school-of-the-demo';

afterEach(() => {
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

/** A started world, a store of its own on this device, and a school's code for a new assignment. */
async function world() {
  const started = await startWorld('national', calendar, kit, server.send);
  const id = started.keys.world;
  const opened = { ring: { school: SCHOOL }, keys: [kit.random(32)] } as unknown as OpenedKeyring;
  const code = await makeJoinCode(opened, id, newId(kit.random), 1, { mac: kit.mac } as never);
  const device = async () => ({
    world: id,
    date: started.date,
    book: await openRecordBook(new FakeStorage().asSpec()),
  });
  return { id, code, text: joinCodeText(code), here: await device(), device };
}

/** What the school reads back from the code's channel, as its own device would. */
async function schoolReads(code: JoinCode) {
  const stream = await channelStream(code, kit.mac);
  const kept = await server.relay.spaces.batchesAfter(code.world, SCHOOL, 0, 1000);
  const batches = kept.filter((one) => one.stream === stream);
  const key = caPublicKey(server.relay.caKey(code.world));
  return readJoined(code, batches, { key, checker: kit }, kit.cipher, kit.mac);
}

const asked = (path: string) => server.seen.filter((one) => one.path.endsWith(path)).length;

test('a device joins with a certified key kept in the world’s store, and the server holds nothing named', async () => {
  const { code, text, here } = await world();
  const joined = await joinSchool(here, text, kit, server.send);
  expect(joined.code).toBe(text);
  expect(joined.certificate).toMatchObject({ standIn: true, world: code.world, subject: joined.device });
  expect(keptJoins(here.book.entries)).toEqual([joined]);
  expect(await schoolReads(code)).toEqual({ device: joined.device, certificate: joined.certificate });
  const held = JSON.stringify(await server.relay.spaces.batchesAfter(code.world, SCHOOL, 0, 1000));
  for (const named of [code.assignment, joined.device, code.key, joined.pkcs8]) expect(held).not.toContain(named);
  const sent = JSON.stringify(server.seen);
  for (const secret of [code.key, code.assignment, joined.pkcs8]) expect(sent).not.toContain(secret);
  expect(server.seen.some((one) => one.body?.includes(joined.certificate.publicKey))).toBe(true);
});

test('joining again, or after a cut, goes on with the same key, and junk first does not hold it back', async () => {
  const { code, text, here } = await world();
  await server.relay.spaces.addSpace(code.world, SCHOOL, 'school');
  const stream = await channelStream(code, kit.mac);
  await server.relay.spaces.addBatches(code.world, SCHOOL, stream, 0, [new Uint8Array(4124)]);
  const adding = jest.spyOn(server.relay.spaces, 'addBatches').mockResolvedValue('full');
  expect(await codeOf(joinSchool(here, text, kit, server.send))).toBe('E_WORLD_SERVER');
  const [cut] = keptJoins(here.book.entries);
  adding.mockRestore();
  const joined = await joinSchool(here, text, kit, server.send);
  expect(joined).toEqual(cut);
  expect(await joinSchool(here, text, kit, server.send)).toEqual(cut);
  expect(asked('/certificates')).toBe(1);
  expect(await schoolReads(code)).toMatchObject({ device: cut.device });
  const numbers = (await server.relay.spaces.batchesAfter(code.world, SCHOOL, 0, 1000)).map((one) => one.number);
  expect(numbers).toEqual([0, 1]);
});

test('a code another device joined on first is refused, and the first stays joined', async () => {
  const { code, text, here, device } = await world();
  const first = await joinSchool(here, text, kit, server.send);
  const other = await device();
  expect(await codeOf(joinSchool(other, text, kit, server.send))).toBe('E_JOIN_TAKEN');
  expect(await schoolReads(code)).toMatchObject({ device: first.device });
});

test('no code, a code of another world, or a certificate the world’s CA did not give keeps nothing', async () => {
  const { id, code, text, here } = await world();
  expect(await codeOf(joinSchool(here, 'not a joining code', kit, server.send))).toBe('E_JOIN_CODE');
  expect(await codeOf(joinSchool(here, `${text} `, kit, server.send))).toBe('E_JOIN_CODE');
  const elsewhere = joinCodeText({ ...code, world: id === 'ABCDE' ? 'FGHJK' : 'ABCDE' });
  expect(await codeOf(joinSchool(here, elsewhere, kit, server.send))).toBe('E_JOIN_WORLD');
  const [key, another] = [server.relay.caKey(id), newCaKey()];
  jest.spyOn(server.relay, 'caKey').mockImplementation(() => (asked('/certificates') > 0 ? another : key));
  expect(await codeOf(joinSchool(here, text, kit, server.send))).toBe('E_WORLD_SERVER');
  expect(keptJoins(here.book.entries)).toEqual([]);
});

test('two joins of one code at once settle on one key, which the school registers', async () => {
  const { code, text, here } = await world();
  const [one, two] = await Promise.all([
    joinSchool(here, text, kit, server.send),
    joinSchool(here, text, kit, server.send),
  ]);
  expect(two).toEqual(one);
  expect(asked('/certificates')).toBe(1);
  expect(keptJoins(here.book.entries)).toEqual([one]);
  expect(await schoolReads(code)).toMatchObject({ device: one.device });
});

test('the channel is read past a page, and a relay that keeps refusing gives up', async () => {
  const { code, text, here, device } = await world();
  await server.relay.spaces.addSpace(code.world, SCHOOL, 'school');
  const filler = Array.from({ length: 130 }, () => new Uint8Array(4124));
  await server.relay.spaces.addBatches(code.world, SCHOOL, 'made-up-other-stream', 0, filler);
  const routed = jest.spyOn(server.relay, 'route');
  const joined = await joinSchool(here, text, kit, server.send);
  expect(await schoolReads(code)).toMatchObject({ device: joined.device });
  expect(routed.mock.calls.some(([request]) => request.query.get('after') === '128')).toBe(true);
  routed.mockRestore();
  expect(await codeOf(joinSchool(await device(), text, kit, server.send))).toBe('E_JOIN_TAKEN');
  leaveWorldNetwork();
  const other = await world();
  jest.spyOn(server.relay.spaces, 'addBatches').mockResolvedValue('taken');
  expect(await codeOf(joinSchool(other.here, other.text, kit, server.send))).toBe('E_WORLD_SERVER');
  expect(
    server.seen.filter((one) => one.method === 'POST' && one.path.startsWith(`/worlds/${other.id}/spaces/`)).length,
  ).toBe(3);
});

test('a busy server, a server that does not page on, and failing cryptography each say so', async () => {
  const { text, here } = await world();
  server.busy = true;
  expect(await codeOf(joinSchool(here, text, kit, server.send))).toBe('E_WORLD_BUSY');
  server.busy = false;
  const failing = { ...kit, newPair: () => Promise.reject(new Error('made-up failure')) };
  expect(await codeOf(joinSchool(here, text, failing, server.send))).toBe('E_WORLD_KIT');
  expect(keptJoins(here.book.entries)).toEqual([]);
  const original = server.relay.route.bind(server.relay);
  jest
    .spyOn(server.relay, 'route')
    .mockImplementation((request) =>
      request.method === 'GET' && request.segments.at(-1) === 'batches'
        ? Promise.resolve(new Response(JSON.stringify({ batches: [], more: true }), { status: 200 }))
        : original(request),
    );
  expect(await codeOf(joinSchool(here, text, kit, server.send))).toBe('E_WORLD_SERVER');
});
