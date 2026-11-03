// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining a seeded national world's staff to their schools (#548, answer 625):
// every school of the bundled world gets a keyring for its own device and every
// teacher a certified signing key; once a made-up CA answers, the seeding's
// requests stay within the server's limits, open each space before writing to
// it, and leave on the relay what every reader finds: each school's keyring,
// which its seeded device opens from the keys the world's sealing key alone
// unseals, each teacher joined on their first code's channel with the key the
// seeded keys hold, in an order that does not follow the teachers, and each
// school listed on its directorate's space; each request is under 1 MB. A
// certificate that is not the CA's for the world, the device and the key asked
// for, or one too many or too few, is refused. Every key and name is made up.

import assert from 'node:assert/strict';
import { createPrivateKey, createPublicKey } from 'node:crypto';
import { before, describe, it } from 'node:test';
import {
  assignmentId,
  certificateRequest,
  channelStream,
  checkSeedCertificates,
  issueCertificate,
  keyringStream,
  listedSchools,
  listingPlace,
  makeJoinCode,
  newId,
  openDirectorateRecords,
  openKeyring,
  openSeededKeys,
  parseDay,
  planSeed,
  readJoined,
  readKeyrings,
  SEED_MOST,
  seedBodies,
  seededKeysPlace,
  seedRequests,
  seedStreams,
  type Certificate,
  type CheckedCertificates,
  type DemoWorld,
  type SealedBatch,
  type SeedBody,
  type SeedKit,
  type SeedPlan,
} from '../src/index.ts';
import { keySigner } from './key-signers.ts';
import { opened, random } from './school-devices.ts';
import { cryptoOf, nationalWorld, seedKit } from './seed-kit.ts';
import { cipher, mac } from './world-crypto.ts';

const WORLD = 'K7QF4';
const DAY = parseDay('2026-11-22');
const ca = keySigner();
const sealing = random(32);

describe('a seeded national world', () => {
  let demo: DemoWorld;
  let kit: SeedKit;
  let plan: SeedPlan;
  let certificates: Certificate[];
  let certified: CheckedCertificates;
  let bodies: SeedBody[];
  const relay = new Map<string, SealedBatch[]>();
  const batchesOf = (space: string, stream: string) => relay.get(`${space}/${stream}`) ?? [];

  before(async () => {
    demo = nationalWorld(WORLD);
    kit = await seedKit();
    plan = await planSeed(WORLD, demo, kit);
    certificates = await Promise.all(
      seedRequests(plan).map((request) => issueCertificate(request, DAY, newId(random), ca)),
    );
    const checked = await checkSeedCertificates(plan, certificates, ca.publicKey, ca.verify);
    assert.ok(checked !== null);
    certified = checked;
    bodies = seedBodies(await seedStreams(plan, certified, sealing, kit));
    for (const body of bodies)
      for (const { space, stream, batches } of body.streams)
        relay.set(`${space}/${stream}`, [...batchesOf(space, stream), ...batches]);
  });

  it('plans every school and teacher, each with a device of its own', () => {
    assert.equal(plan.schools.length, 68);
    assert.deepEqual(
      plan.schools.map((school) => school.seed),
      demo.schools.map((school) => school.id),
    );
    const teachers = plan.schools.flatMap((school) => school.teachers);
    assert.equal(teachers.length, 462);
    const devices = [...plan.schools.map((school) => school.holder.id), ...teachers.map((one) => one.device)];
    assert.equal(new Set(devices).size, devices.length);
    assert.equal(new Set(plan.schools.map((school) => school.opened.ring.school)).size, 68);
    assert.ok(teachers.every((one) => one.code.issue === 1 && one.code.epoch === 0 && one.code.world === WORLD));
  });

  it('sends it in a few requests within the limits, every space opened before it is written', () => {
    assert.ok(bodies.length <= 8, `${bodies.length} requests`);
    const opened = new Set<string>();
    for (const body of bodies) {
      assert.ok(body.spaces.length <= SEED_MOST);
      assert.ok(body.streams.reduce((sum, one) => sum + one.batches.length, 0) <= SEED_MOST);
      for (const { space } of body.spaces) opened.add(space);
      assert.ok(body.streams.every((one) => opened.has(one.space)));
    }
    assert.equal(opened.size, 1 + 12 + 68);
    assert.ok(Math.ceil(seedRequests(plan).length / SEED_MOST) <= 4);
    for (const { spaces, streams } of bodies) {
      const sent = streams.map(({ batches, ...rest }) => ({
        ...rest,
        batches: batches.map((one) => Buffer.from(one.bytes).toString('base64url')),
      }));
      assert.ok(Buffer.byteLength(JSON.stringify({ spaces, streams: sent })) < 1024 * 1024);
    }
  });

  it('writes each school’s joined records in an order that does not follow its teachers', async () => {
    let followed = 0;
    for (const school of plan.schools) {
      const space = school.opened.ring.school;
      const planned = await Promise.all(school.teachers.map((teacher) => channelStream(teacher.code, mac)));
      const written = bodies
        .flatMap((body) => body.streams)
        .filter((one) => one.space === space && planned.includes(one.stream))
        .map((one) => one.stream);
      assert.deepEqual([...written].sort(), [...planned].sort());
      if (written.every((stream, at) => stream === planned[at])) followed += 1;
    }
    assert.ok(followed < plan.schools.length / 2, `${followed} schools in their teachers' order`);
  });

  it('leaves keys sealed under the world alone, each school opening its keyring, its teachers joined', async () => {
    const place = await seededKeysPlace(sealing, mac);
    const keys = await openSeededKeys(place, batchesOf('national', place.stream), WORLD, cipher);
    assert.ok(keys !== null);
    assert.equal(await openSeededKeys(place, batchesOf('national', place.stream), 'ABCDE', cipher), null);
    const other = await seededKeysPlace(random(32), mac);
    assert.equal(await openSeededKeys(other, batchesOf('national', place.stream), WORLD, cipher), null);
    assert.equal(keys.schools.length, 68);
    for (const [at, school] of keys.schools.entries()) {
      const ring = batchesOf(school.space, await keyringStream(school.space, mac));
      const rings = await readKeyrings(school.space, ring, 32, cipher, mac);
      assert.equal(rings.length, 1);
      const held = opened(await openKeyring(rings[0], school.device, await cryptoOf(school.agreement)));
      if (![0, 1, keys.schools.length - 1].includes(at)) continue;
      for (const teacher of school.teachers) {
        const code = await makeJoinCode(
          held,
          WORLD,
          await assignmentId(school.space, teacher.seed, mac),
          1,
          kit.crypto,
        );
        const channel = batchesOf(school.space, await channelStream(code, mac));
        const joined = await readJoined(code, channel, { key: ca.publicKey, checker: ca }, cipher, mac);
        assert.equal(joined?.device, teacher.device);
        const spki = createPublicKey(
          createPrivateKey({ key: Buffer.from(teacher.signing, 'base64'), format: 'der', type: 'pkcs8' }),
        );
        assert.equal(joined.certificate.publicKey, spki.export({ format: 'der', type: 'spki' }).toString('base64'));
      }
    }
  });

  it('lists each school on its directorate’s space', async () => {
    const directorates = [...new Set(plan.schools.map((school) => school.directorate))];
    assert.equal(directorates.length, 12);
    for (const space of directorates) {
      const place = await listingPlace(space, mac);
      const listed = listedSchools(await openDirectorateRecords(place, batchesOf(space, place.stream), cipher), WORLD);
      const ours = plan.schools.filter((school) => school.directorate === space);
      assert.deepEqual(new Map(ours.map((school) => [school.seed, school.opened.ring.school])), listed);
    }
  });

  it('refuses certificates that are not the ones asked for', async () => {
    const requests = seedRequests(plan);
    const [first] = requests as [(typeof requests)[number]];
    const swapped = [certificates[1], certificates[0], ...certificates.slice(2)];
    const issue = async (request: typeof first, by = ca) => issueCertificate(request, DAY, newId(random), by);
    const forged = [await issue(first, keySigner()), ...certificates.slice(1)];
    const otherKey = [
      await issue(await certificateRequest(WORLD, first.subject, keySigner())),
      ...certificates.slice(1),
    ];
    const teacher = plan.schools[0]!.teachers[0]!;
    const own = {
      publicKey: first.publicKey,
      sign: (text: string) => kit.sign(teacher.pkcs8, text),
      verify: kit.verify,
    };
    const otherWorld = [await issue(await certificateRequest('ABCDE', first.subject, own)), ...certificates.slice(1)];
    for (const answered of [
      certificates.slice(1),
      [...certificates, certificates[0]],
      swapped,
      forged,
      otherKey,
      otherWorld,
    ]) {
      assert.equal(await checkSeedCertificates(plan, answered, ca.publicKey, ca.verify), null);
    }
    const fewer = certified.slice(1) as unknown as CheckedCertificates;
    await assert.rejects(seedStreams(plan, fewer, sealing, kit), RangeError);
  });
});

describe('the seeding’s requests', () => {
  const stream = (space: string, count: number) => ({
    space,
    stream: 'a'.repeat(32),
    first: 0,
    batches: Array.from({ length: count }, (_, number) => ({ number, bytes: new Uint8Array(1) })),
  });
  const spaces = Array.from({ length: 130 }, (_, at) => ({
    space: `space-${at}`.padEnd(16, 'x'),
    kind: 'school' as const,
  }));

  it('go spaces first, then streams, never past 128 spaces or batches a request', () => {
    const bodies = seedBodies({ spaces, streams: [stream('one', 100), stream('two', 28), stream('three', 1)] });
    assert.deepEqual(
      bodies.map((body) => [body.spaces.length, body.streams.map((one) => one.space)]),
      [
        [128, []],
        [2, ['one', 'two']],
        [0, ['three']],
      ],
    );
    assert.deepEqual(seedBodies({ spaces: [], streams: [] }), []);
    assert.throws(() => seedBodies({ spaces: [], streams: [stream('long', 129)] }), RangeError);
  });
});
