// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Joining a school's space inside a demo world (#564, answers 580 and 581),
// once the teacher has scanned the school's joining code and agreed. The
// device makes its signing key with the world kit, asks the world's stand-in
// CA to certify it, checks the certificate against the CA's key, and keeps
// the code, the key and the certificate in the world's own store before
// anything goes to the school, so a join cut short goes on with the same key;
// of two joins of one code at once, the second waits for the first, and the
// store keeps the first key. It then opens the school's space, puts the
// joined record on its channel at the stream's next number, and reads the
// channel back until the first record that holds is found: this device's,
// with its certificate, or another's, which means the code was already used
// and the school must give a new one. As the page opens, every join the
// store keeps is checked again the same way, one after another, the newest
// first. Errors carry a code: E_JOIN_CODE for a text that is no joining code,
// E_JOIN_WORLD for a code of another world, E_JOIN_TAKEN when another device
// joined on it first, world-session.ts's E_WORLD_SERVER, E_WORLD_BUSY and
// E_WORLD_KIT, the network's own (world-network.ts), and the store's when it
// cannot keep the key, or E_WORLD when it kept none; problemOf gives each
// code's words in the catalogue.

import {
  certificateRequest,
  channelStream,
  checkCertificate,
  fromBase64Url,
  isSigningKey,
  keptJoins,
  newId,
  readJoinCode,
  readJoined,
  sealJoined,
  toBase64Url,
  type JoinCode,
  type SchoolJoined,
  type SealedBatch,
} from '@minhajna/core';
import { errorCode } from '../lock/lock-rules';
import { worldRequest } from '../network/world-network';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';

/** How many times the record is put on the channel before giving up. */
const TRIES = 3;

/** The joins on their way, by code, so a second press waits for the first. */
const going = new Map<string, Promise<SchoolJoined>>();

const isBatch = (one: unknown): one is { seq: number; stream: string; number: number; bytes: string } => {
  const { seq, stream, number, bytes } = (one ?? {}) as Record<string, unknown>;
  const counts = Number.isSafeInteger(seq) && Number.isSafeInteger(number) && (number as number) >= 0;
  return counts && typeof stream === 'string' && typeof bytes === 'string';
};

/** The world CA's public key. */
async function caKey(world: string, send: Send): Promise<string> {
  const answer = await send({ method: 'GET', path: `/worlds/${world}/ca` });
  const key = (answer.body as { publicKey?: unknown } | null)?.publicKey;
  if (answer.status !== 200 || !isSigningKey(key)) throw unexpected(answer);
  return key;
}

/** A new signing key, certified by the world's CA for a new device ID, as the store keeps it. */
async function certified(code: JoinCode, text: string, ca: string, kit: WorldKit, send: Send): Promise<SchoolJoined> {
  const pair = await kitStep(() => kit.newPair());
  const signer = { publicKey: pair.spki, sign: (one: string) => kit.sign(pair.pkcs8, one), verify: kit.verify };
  const device = newId(kit.random);
  const request = await kitStep(() => certificateRequest(code.world, device, signer));
  const answer = await send({ method: 'POST', path: `/worlds/${code.world}/certificates`, body: request });
  const certificate = answer.body as SchoolJoined['certificate'];
  const holds = answer.status === 201 && (await checkCertificate(certificate, code.world, ca, kit));
  if (!holds || certificate.subject !== device || certificate.publicKey !== pair.spki) throw unexpected(answer);
  return { code: text, device, pkcs8: pair.pkcs8, certificate };
}

/** The channel's batches in the school's space, in the order the relay keeps them. */
async function channel(code: JoinCode, stream: string, send: Send): Promise<SealedBatch[]> {
  const found: SealedBatch[] = [];
  for (let after = 0, more = true; more;) {
    const path = `/worlds/${code.world}/spaces/${code.school}/batches?after=${after}`;
    const answer = await send({ method: 'GET', path });
    const body = answer.body as { batches?: unknown; more?: unknown } | null;
    if (answer.status !== 200 || !Array.isArray(body?.batches)) throw unexpected(answer);
    const before = after;
    for (const one of body.batches as unknown[]) {
      if (!isBatch(one) || one.seq <= after) throw unexpected(answer);
      after = one.seq;
      const bytes = one.stream === stream ? fromBase64Url(one.bytes) : null;
      if (bytes !== null) found.push({ number: one.number, bytes });
    }
    more = body.more === true;
    if (more && after === before) throw unexpected(answer);
  }
  return found;
}

/** Joins the school whose code was scanned, as this device, and answers what the world's store keeps of it. */
export async function joinSchool(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  text: string,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<SchoolJoined> {
  const code = readJoinCode(text);
  if (code === null) throw failed('Not a joining code', 'E_JOIN_CODE');
  if (code.world !== world.world) throw failed('A joining code of another world', 'E_JOIN_WORLD');
  const before = going.get(text);
  if (before !== undefined) return before;
  const joining = joinOnce(world, code, text, kit, send);
  going.set(text, joining);
  try {
    return await joining;
  } finally {
    going.delete(text);
  }
}

/**
 * Checks again every join the world's store keeps, one after another, the newest first: the joins that hold, newest
 * first, and the errors to say, a code another device took first only when none held. It never fails.
 */
export async function checkKeptJoins(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<{ readonly joins: readonly SchoolJoined[]; readonly problems: readonly unknown[] }> {
  const joins: SchoolJoined[] = [];
  const failures: unknown[] = [];
  for (const { code } of [...keptJoins(world.book.entries)].reverse())
    await joinSchool(world, code, kit, send).then(
      (one) => void joins.push(one),
      (error: unknown) => void failures.push(error),
    );
  const taken = (error: unknown) => (error as { code?: unknown } | null)?.code === 'E_JOIN_TAKEN';
  return { joins, problems: joins.length === 0 ? failures : failures.filter((one) => !taken(one)) };
}

async function joinOnce(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  code: JoinCode,
  exact: string,
  kit: WorldKit,
  send: Send,
): Promise<SchoolJoined> {
  const ca = await caKey(world.world, send);
  const keptFor = () => keptJoins(world.book.entries).find((one) => one.code === exact);
  if (keptFor() === undefined) {
    const made = await certified(code, exact, ca, kit, send);
    await world.book.record(world.date, { kind: 'school.joined', joined: made });
  }
  const kept = keptFor();
  if (kept === undefined) throw failed('The world’s store did not keep the key', 'E_WORLD');
  const space = await send({
    method: 'PUT',
    path: `/worlds/${code.world}/spaces/${code.school}`,
    body: { kind: 'school' },
  });
  if (space.status !== 200 && space.status !== 201) throw unexpected(space);
  const stream = await kitStep(() => channelStream(code, kit.mac));
  for (let tries = 0; tries <= TRIES; tries += 1) {
    const batches = await channel(code, stream, send);
    const joined = await kitStep(() => readJoined(code, batches, { key: ca, checker: kit }, kit.cipher, kit.mac));
    if (joined !== null) {
      const ours = joined.device === kept.device && joined.certificate.publicKey === kept.certificate.publicKey;
      if (!ours || joined.certificate.serial !== kept.certificate.serial) {
        throw failed('Another device joined on this code first', 'E_JOIN_TAKEN');
      }
      return kept;
    }
    if (tries === TRIES) break;
    const first = batches.reduce((next, one) => Math.max(next, one.number + 1), 0);
    const sealed = await kitStep(() => sealJoined(code, kept, kit.cipher, kit.mac, first));
    const body = { stream, first, batches: sealed.batches.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `/worlds/${code.world}/spaces/${code.school}/batches`, body });
    if (answer.status !== 201 && answer.status !== 409) throw unexpected(answer);
  }
  throw failed('The joined record did not stay on the channel', 'E_WORLD_SERVER');
}

const PROBLEMS = {
  E_JOIN_CODE: 'demo.school.problem.code',
  E_JOIN_WORLD: 'demo.school.problem.world',
  E_JOIN_TAKEN: 'demo.school.problem.taken',
  E_CALENDAR_CAMERA: 'demo.school.problem.camera',
  E_WORLD_BUSY: 'demo.problem.busy',
  E_OFFLINE: 'demo.problem.offline',
  E_TIMEOUT: 'demo.problem.offline',
  E_WORLD_KIT: 'demo.problem.device',
  E_WORLD: 'demo.problem.store',
  E_KEY_LOST: 'demo.problem.store',
} as const;

/** The catalogue's words for an error's code. */
export function problemOf(error: unknown): (typeof PROBLEMS)[keyof typeof PROBLEMS] | 'demo.problem.other' {
  const code = errorCode(error);
  return code !== undefined && Object.hasOwn(PROBLEMS, code)
    ? PROBLEMS[code as keyof typeof PROBLEMS]
    : 'demo.problem.other';
}
