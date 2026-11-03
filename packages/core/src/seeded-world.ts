// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining a seeded national world's staff to their schools, with their keys
// (#548, choice D2, answer 625), on the device that starts the world. Each
// school gets a space ID drawn at random, a device that holds its key, with an
// agreement pair from the platform, and a keyring started for that device
// alone. Each teacher's assignment is worked out from the space (answer 597)
// and their code is its first issue under the first epoch, as D-Issue makes it;
// the platform makes the teacher's signing key, and a request asks the world's
// CA to certify it. The CA's answers, in the requests' order, are checked
// against the CA's key, the world, the device and the key each was asked for,
// and anything else refused. Then the world's spaces and streams are written
// out: the national space, each directorate's and each school's; for each
// school in turn its keyring, its teachers' joined records on their codes'
// channels, in an order drawn at random so the order of the streams does not
// tell which channel is which seeded teacher, and its listing on its
// directorate's space; and last the seeded keys, sealed under the world's
// sealing key on the national space. They go to the server in bodies of at most
// 128 spaces and 128 batches, spaces first, so a stream's space is opened by
// the time it is written. Nothing named goes: every device rebuilds the world's
// description from its ID (answer 591).

import type { SealedBatch } from './batches.ts';
import { certificateRequest, checkCertificate, type Certificate, type CertificateRequest } from './certify.ts';
import type { DemoWorld } from './demo-world.ts';
import { directorateSpace, listingPlace, schoolListing, sealDirectorateRecord } from './directorate-space.ts';
import { newId, toHex, type RandomBytes } from './id.ts';
import { assignmentId, newSchoolSpace } from './school-issue.ts';
import { makeJoinCode, sealJoined, type JoinCode } from './school-join.ts';
import { startKeyring, type Holder, type KeyCrypto, type OpenedKeyring } from './school-key.ts';
import { sealKeyring } from './school-keyring-stream.ts';
import { SEEDED_KEYS_FORMAT, sealSeededKeys, seededKeysPlace, type SeededKeys } from './seeded-keys.ts';
import type { Verifier } from './signed-read.ts';
import type { WorldCipher, WorldMac, WorldSigner } from './world-keys.ts';

/** The most spaces and batches one seeding request carries, as the server takes them. */
export const SEED_MOST = 128;

/** What seeding needs of the platform. */
export interface SeedKit {
  readonly random: RandomBytes;
  readonly mac: WorldMac;
  readonly cipher: WorldCipher;
  /** Seals a school key for a device. */
  readonly crypto: KeyCrypto;
  readonly sign: WorldSigner;
  readonly verify: Verifier;
  /** A new P-256 signing pair: its public half as SPKI and its private half as PKCS #8, DER in base64. */
  readonly newPair: () => Promise<{ readonly spki: string; readonly pkcs8: string }>;
  /** A new agreement pair: its public half as the platform's point, its private half as PKCS #8 in base64. */
  readonly newAgreement: () => Promise<{ readonly publicKey: Uint8Array; readonly pkcs8: string }>;
}

export interface SeedTeacher {
  readonly seed: string;
  readonly device: string;
  readonly code: JoinCode;
  readonly pkcs8: string;
  readonly request: CertificateRequest;
}

export interface SeedSchool {
  readonly seed: string;
  /** Its directorate's space. */
  readonly directorate: string;
  readonly holder: Holder;
  readonly agreement: string;
  readonly opened: OpenedKeyring;
  readonly teachers: readonly SeedTeacher[];
}

export interface SeedPlan {
  readonly world: string;
  readonly schools: readonly SeedSchool[];
}

export interface SeedStream {
  readonly space: string;
  readonly stream: string;
  readonly first: number;
  readonly batches: readonly SealedBatch[];
}

/** What one seeding request opens and writes. */
export interface SeedBody {
  readonly spaces: readonly { readonly space: string; readonly kind: 'school' | 'directorate' | 'national' }[];
  readonly streams: readonly SeedStream[];
}

async function seedTeacher(world: string, opened: OpenedKeyring, seed: string, kit: SeedKit): Promise<SeedTeacher> {
  const assignment = await assignmentId(opened.ring.school, seed, kit.mac);
  const code = await makeJoinCode(opened, world, assignment, 1, kit.crypto);
  const device = newId(kit.random);
  const { spki, pkcs8 } = await kit.newPair();
  const signer = { publicKey: spki, sign: (text: string) => kit.sign(pkcs8, text), verify: kit.verify };
  return { seed, device, code, pkcs8, request: await certificateRequest(world, device, signer) };
}

/** Every seeded school's key and every teacher's signing key, with the requests the CA is asked to certify. */
export async function planSeed(world: string, demo: DemoWorld, kit: SeedKit): Promise<SeedPlan> {
  const schools: SeedSchool[] = [];
  for (const school of demo.schools) {
    const agreement = await kit.newAgreement();
    const holder = { id: newId(kit.random), publicKey: toHex(agreement.publicKey) };
    const opened = await startKeyring(newSchoolSpace(kit.random), holder, kit.crypto, kit.random);
    const teachers = await Promise.all(school.teachers.map((one) => seedTeacher(world, opened, one.id, kit)));
    const directorate = await directorateSpace(world, school.directorateId, kit.mac);
    schools.push({ seed: school.id, directorate, holder, agreement: agreement.pkcs8, opened, teachers });
  }
  return { world, schools };
}

/** The requests to certify, in the order the certificates must come back. */
export const seedRequests = (plan: SeedPlan): CertificateRequest[] =>
  plan.schools.flatMap((school) => school.teachers.map((teacher) => teacher.request));

declare const checkedBrand: unique symbol;

/** Certificates that checkSeedCertificates checked, which alone seedStreams takes. */
export type CheckedCertificates = readonly Certificate[] & { readonly [checkedBrand]: true };

/** Each teacher's certificate, in the requests' order, or null when one is not the CA's for the key asked for. */
export async function checkSeedCertificates(
  plan: SeedPlan,
  answered: readonly unknown[],
  ca: string,
  verify: Verifier,
): Promise<CheckedCertificates | null> {
  const requests = seedRequests(plan);
  if (answered.length !== requests.length) return null;
  const checked = await Promise.all(
    requests.map(async (request, at) => {
      const certificate = answered[at];
      if (!(await checkCertificate(certificate, plan.world, ca, { verify }))) return null;
      const { subject, publicKey } = certificate as Certificate;
      return subject === request.subject && publicKey === request.publicKey ? (certificate as Certificate) : null;
    }),
  );
  return checked.some((one) => one === null) ? null : (checked as unknown as CheckedCertificates);
}

/** The items in an order drawn at random. */
function shuffled<T>(items: readonly T[], random: RandomBytes): T[] {
  const order = items.map((item) => ({ item, at: random(4).reduce((sum, byte) => sum * 256 + byte, 0) }));
  return order.sort((one, two) => one.at - two.at).map(({ item }) => item);
}

/** The world's seeded spaces and streams, with each teacher's certificate as checkSeedCertificates gave them. */
export async function seedStreams(
  plan: SeedPlan,
  certificates: CheckedCertificates,
  sealing: Uint8Array,
  kit: SeedKit,
): Promise<SeedBody> {
  if (certificates.length !== seedRequests(plan).length) throw new RangeError('A certificate for every teacher');
  const directorates = [...new Set(plan.schools.map((school) => school.directorate))];
  const spaces = [
    { space: 'national', kind: 'national' as const },
    ...directorates.map((space) => ({ space, kind: 'directorate' as const })),
    ...plan.schools.map((school) => ({ space: school.opened.ring.school, kind: 'school' as const })),
  ];
  const streams: SeedStream[] = [];
  const listed = new Map<string, number>();
  let certified = 0;
  for (const school of plan.schools) {
    const space = school.opened.ring.school;
    streams.push({ space, first: 0, ...(await sealKeyring(school.opened.ring, 0, kit.cipher, kit.mac)) });
    const joins: SeedStream[] = [];
    for (const teacher of school.teachers) {
      const joined = { device: teacher.device, certificate: certificates[certified]! };
      certified += 1;
      joins.push({ space, first: 0, ...(await sealJoined(teacher.code, joined, kit.cipher, kit.mac)) });
    }
    streams.push(...shuffled(joins, kit.random));
    const place = await listingPlace(school.directorate, kit.mac);
    const first = listed.get(school.directorate) ?? 0;
    const listing = schoolListing(plan.world, school.seed, space);
    const batches = await sealDirectorateRecord(place, listing, first, kit.cipher);
    listed.set(school.directorate, first + batches.length);
    streams.push({ space: school.directorate, stream: place.stream, first, batches });
  }
  const keys: SeededKeys = {
    format: SEEDED_KEYS_FORMAT,
    world: plan.world,
    schools: plan.schools.map((school) => ({
      seed: school.seed,
      space: school.opened.ring.school,
      device: school.holder.id,
      agreement: school.agreement,
      teachers: school.teachers.map(({ seed, device, pkcs8 }) => ({ seed, device, signing: pkcs8 })),
    })),
  };
  const place = await seededKeysPlace(sealing, kit.mac);
  const batches = await sealSeededKeys(place, keys, 0, kit.cipher);
  streams.push({ space: 'national', stream: place.stream, first: 0, batches });
  return { spaces, streams };
}

/** The seeding's requests: spaces first, then streams, each request within SEED_MOST spaces and batches. */
export function seedBodies(seed: SeedBody): SeedBody[] {
  const bodies: { spaces: SeedBody['spaces'][number][]; streams: SeedStream[]; batches: number }[] = [];
  let body = { spaces: [] as SeedBody['spaces'][number][], streams: [] as SeedStream[], batches: 0 };
  const next = () => {
    bodies.push(body);
    body = { spaces: [], streams: [], batches: 0 };
  };
  for (const space of seed.spaces) {
    if (body.spaces.length === SEED_MOST) next();
    body.spaces.push(space);
  }
  for (const stream of seed.streams) {
    if (stream.batches.length > SEED_MOST) throw new RangeError('A stream this long cannot be seeded');
    if (body.batches + stream.batches.length > SEED_MOST) next();
    body.streams.push(stream);
    body.batches += stream.batches.length;
  }
  if (body.spaces.length + body.streams.length > 0) next();
  return bodies.map(({ spaces, streams }) => ({ spaces, streams }));
}
