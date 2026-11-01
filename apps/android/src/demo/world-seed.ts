// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Seeding a national demo world on the device that starts it (#548, answer
// 625), before its code is shown: every seeded school's key and every teacher's
// signing key are made through the core with the platform's cryptography, the
// world's CA certifies the teachers' keys 128 at a time, and the spaces, the
// keyrings, the joined records, the listings and the seeded keys go up in a few
// requests, each under the starter token. The certificates are checked against
// the CA's key and the keys they were asked for; any that is not is the
// server's fault. Each seeding request waits SEED_TIMEOUT_MS for its answer,
// since the largest carry about 720 KB. A refusal anywhere fails the start as a
// whole, with world-session.ts's codes, and shuts the network to that world
// again, so the code is never shown and nothing is retried: the start is made
// again, with a new code, and the half-seeded world is erased on its seventh
// day. A teachers' world, or one started without the bundled reference data, is
// not seeded.

import {
  checkSeedCertificates,
  planSeed,
  seedBodies,
  seedRequests,
  seedStreams,
  toBase64Url,
  type DemoWorld,
  type SchoolCalendar,
  type SeedKit,
  type WorldKind,
} from '@minhajna/core';
import { seededWorld } from '../director/director-world';
import { leaveWorldNetwork, worldNetworkOpen, worldRequest } from '../network/world-network';
import type { ReferenceResult } from '../reference';
import { caKey } from '../school/space-read';
import { sealingCrypto } from './world-key-crypto';
import { failed, kitStep, startWorld, unexpected, type Send, type StartedWorld, type WorldKit } from './world-session';

/** The most certificate requests one seeding request carries, as the server takes them. */
const CERTIFICATES = 128;

/** How long a seeding request waits for its answer: 720 KB in two minutes needs about 50 kbit/s of upload. */
export const SEED_TIMEOUT_MS = 120_000;

/** What the core's seeding needs, from the world kit. */
export function seedKitOf(kit: WorldKit): SeedKit {
  const { random, mac, cipher, sign, verify, newPair, newAgreement } = kit;
  return { random, mac, cipher, crypto: sealingCrypto(kit), sign, verify, newPair, newAgreement };
}

/** Joins a national world's seeded staff to their schools and uploads it, under the starter token. */
export async function seedWorld(
  started: Pick<StartedWorld, 'keys' | 'starter' | 'sealing'>,
  demo: DemoWorld,
  kit: WorldKit,
  send: Send,
): Promise<void> {
  const { world } = started.keys;
  const seeding = seedKitOf(kit);
  const plan = await kitStep(() => planSeed(world, demo, seeding));
  const requests = seedRequests(plan);
  const answered: unknown[] = [];
  for (let at = 0; at < requests.length; at += CERTIFICATES) {
    const body = { requests: requests.slice(at, at + CERTIFICATES) };
    const path = `/worlds/${world}/seed/certificates`;
    const answer = await send({ method: 'POST', path, body, starter: started.starter, timeoutMs: SEED_TIMEOUT_MS });
    const certificates = (answer.body as { certificates?: unknown } | null)?.certificates;
    if (answer.status !== 201 || !Array.isArray(certificates)) throw unexpected(answer);
    answered.push(...(certificates as unknown[]));
  }
  const ca = await caKey(world, send);
  const certified = await kitStep(() => checkSeedCertificates(plan, answered, ca, kit.verify));
  if (certified === null) throw failed('The CA answered other certificates', 'E_WORLD_SERVER');
  const seed = await kitStep(() => seedStreams(plan, certified, started.sealing, seeding));
  for (const { spaces, streams } of seedBodies(seed)) {
    const body = {
      spaces,
      streams: streams.map(({ batches, ...rest }) => ({
        ...rest,
        batches: batches.map((one) => toBase64Url(one.bytes)),
      })),
    };
    const answer = await send({
      method: 'POST',
      path: `/worlds/${world}/seed/batches`,
      body,
      starter: started.starter,
      timeoutMs: SEED_TIMEOUT_MS,
    });
    if (answer.status !== 201) throw unexpected(answer);
  }
}

/** Starts a world of a kind, a national one seeded before it is given; the network is shut again if seeding fails. */
export async function startSeededWorld(
  kind: WorldKind,
  calendar: SchoolCalendar,
  reference: Extract<ReferenceResult, { ok: true }> | undefined,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<StartedWorld> {
  const started = await startWorld(kind, calendar, kit, send);
  if (kind !== 'national' || reference === undefined) return started;
  try {
    await seedWorld(started, seededWorld(started.keys.world, reference), kit, send);
  } catch (error) {
    if (worldNetworkOpen() === started.keys.world) leaveWorldNetwork();
    throw error;
  }
  return started;
}
