// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's security key in a national demo world (#572, answer 602). On the
// director's PC, with the teacher beside it, setting the key up for a key issue
// reads the world's CA and the issue's channel first, so that being offline
// fails before the key is touched, and a key already set up and joined is
// refused (E_KEY_SET_UP) rather than set up again, which would replace the
// credential its session opens with. It then asks the key for a credential,
// under a user handle worked out from the world and the assignment, keyed with
// the school's space, which only the school's devices know, and its PRF output.
// The director's device makes a signing key the CA certifies for the teacher's
// channel and puts the session, signing key included, at the place the PRF
// output and the world name, at the stream's next number; only then does it put
// the joined record on the channel, so the issue waits until the session is
// there. A setup that fails partway keeps its signing key in memory for that
// issue, so setting it up again joins with it; a channel another device joined
// first says so (E_KEY_TAKEN). The PRF output is forgotten either way. At a
// staffroom PC, signing in asks the key, with its PIN, and reads the latest
// session at its place, a place never made reading as empty while the world is
// there; a key set up in no session of the world says so (E_KEY_NOT_SET), and a
// world erased says that instead.

import {
  joinedKey,
  keyPlace,
  readJoinCode,
  readKeySession,
  sealKeySession,
  toBase64Url,
  type JoinCode,
  type PcSession,
  type SchoolIssued,
  type SchoolJoined,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { keyCodeText } from '../director/issue-session';
import type { IssueDesk } from '../director/school-desk';
import { worldRequest } from '../network/world-network';
import { certified, putJoined, readChannel } from '../school/school-join-session';
import { caKey, spaceBatches } from '../school/space-read';
import type { StaffKey } from './security-key';

type KeyWorld = Pick<OpenWorld, 'world'>;

/** How many times the session is put again when another record took its number. */
const TRIES = 3;

/** The signing keys of setups that failed partway, by world and issue, to join with when set up again. */
const pending = new Map<string, SchoolJoined>();

const ascii = (text: string) => Uint8Array.from(text, (one) => one.charCodeAt(0));
const codeOf = (error: unknown) => (error as { code?: unknown } | null)?.code;

async function handleOf(code: JoinCode, kit: WorldKit): Promise<Uint8Array> {
  const label = ascii(`minhajna/staff-key/user\n${code.world}\n${code.assignment}`);
  const mac = await kitStep(() => kit.mac(ascii(code.school), label));
  return mac.slice(0, 16);
}

async function putSession(prf: Uint8Array, session: PcSession, kit: WorldKit, send: Send): Promise<void> {
  const place = await kitStep(() => keyPlace(prf, session.world, kit.mac));
  const path = `/worlds/${session.world}/spaces/${place.space}`;
  const space = await send({ method: 'PUT', path, body: { kind: 'school' } });
  if (space.status !== 200 && space.status !== 201) throw unexpected(space);
  for (let tries = 0; tries < TRIES; tries += 1) {
    const there = (await spaceBatches(session.world, place.space, send)).get(place.stream) ?? [];
    const first = there.reduce((most, one) => Math.max(most, one.number + 1), 0);
    const put = await kitStep(() => sealKeySession(prf, session, first, kit.cipher, kit.mac));
    const body = { stream: put.stream, first, batches: put.batches.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `${path}/batches`, body });
    if (answer.status === 201) return;
    if (answer.status !== 409) throw unexpected(answer);
  }
  throw failed('The key’s place kept changing', 'E_WORLD_SERVER');
}

/** Sets up a key issue's security key for its teacher, with the school's and the teacher's names. */
export async function setUpKey(
  world: KeyWorld,
  desk: IssueDesk,
  issue: SchoolIssued,
  names: { readonly schoolName: string; readonly teacher: string },
  key: StaffKey,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const text = await keyCodeText(world.world, desk, issue);
  const code = readJoinCode(text);
  if (code === null || issue.keyNumber === null) throw failed('The key’s joining code does not read', 'E_WORLD');
  const ca = await caKey(world.world, send);
  const of = `${world.world}:${joinedKey(issue.assignment, issue.issue)}`;
  const { joined } = await readChannel(code, ca, kit, send);
  const ours = pending.get(of);
  if (joined !== null && (ours === undefined || joined.device !== ours.device)) {
    throw failed('The key was set up and joined already', 'E_KEY_SET_UP');
  }
  const handle = await handleOf(code, kit);
  const prf = await key.setUp({ teacher: names.teacher, number: issue.keyNumber, handle }).catch((error: unknown) => {
    throw codeOf(error) === 'E_KEY_PRF' ? failed('The key cannot be set up', 'E_KEY_SETUP_PRF') : error;
  });
  try {
    const made = ours ?? (await certified(code, text, ca, kit, send));
    pending.set(of, made);
    const signing = { pkcs8: made.pkcs8, certificate: made.certificate };
    await putSession(prf, { world: world.world, ...names, joins: [text], signing }, kit, send);
    await putJoined(code, made, ca, kit, send).catch((error: unknown) => {
      if (codeOf(error) !== 'E_JOIN_TAKEN') throw error;
      pending.delete(of);
      throw failed('Another device joined on the key’s code first', 'E_KEY_TAKEN');
    });
    pending.delete(of);
  } finally {
    prf.fill(0);
  }
}

/** Asks the security key, with its PIN, for the teacher's latest session in the world, until the signal aborts. */
export async function signInWithKey(
  world: KeyWorld,
  key: StaffKey,
  kit: WorldKit,
  send: Send = worldRequest,
  signal?: AbortSignal,
): Promise<PcSession> {
  const prf = await key.ask(signal);
  try {
    const place = await kitStep(() => keyPlace(prf, world.world, kit.mac));
    const reading: Send = async (request) => {
      const answer = await send(request);
      if (answer.status !== 404) return answer;
      const there = await send({ method: 'GET', path: `/worlds/${world.world}/ca` });
      if (there.status === 404) throw failed('The world was erased', 'E_NO_SUCH_WORLD');
      return { ...answer, status: 200, body: { batches: [], more: false } };
    };
    const batches = (await spaceBatches(world.world, place.space, reading)).get(place.stream) ?? [];
    const session = await kitStep(() => readKeySession(prf, world.world, batches, kit.cipher, kit.mac));
    if (session === null) throw failed('This key holds no session of the world', 'E_KEY_NOT_SET');
    return session;
  } finally {
    prf.fill(0);
  }
}
