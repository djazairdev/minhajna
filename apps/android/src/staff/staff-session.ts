// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Signing in on a staffroom PC in a national demo world (#572, answer 602). The
// teacher's phone offers the PC a session of the joining codes its store kept,
// of the one teacher the first names, with the names the seeded school gives
// them, seals it once to the PC's key as soon as it asks, so every approval
// puts that same answer, and puts it in the PC's drop space at the stream's
// next number, putting it again when another took it; it answers the check to
// show. The PC makes a fresh pair and secret, held in memory only, opens the
// drop space and reads it for its world's session; once open, it reads, from
// the school's space, whether and when each of the session's channels was
// joined. Errors carry world-session.ts's codes, and E_PC_NOT_JOINED on a phone
// that kept no joining code of the world, or whose code names no teacher of the
// seeded school.

import {
  assignmentId,
  channelStream,
  keptJoins,
  newHolderSecret,
  pcAnswerBatches,
  pcDrop,
  pcQr,
  PC_SESSION_JOINS,
  readJoinCode,
  readJoined,
  readPcAnswer,
  sealPcAnswer,
  toBase64Url,
  type Day,
  type DemoSchool,
  type DemoTeacher,
  type JoinCode,
  type KeyCrypto,
  type PcAnswer,
  type PcRequest,
  type PcSession,
  type SealedAnswer,
} from '@minhajna/core';
import { newDevicePair, worldKeyCrypto } from '../demo/world-key-crypto';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { personName } from '../director/dashboard-text';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';

type StaffWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** How long a staffroom PC's session, or an answer waiting to be compared, stays unused, in milliseconds. */
export const STAFF_IDLE = 5 * 60 * 1000;

/** How many times the answer is put again when another record took its number. */
const TRIES = 3;

/** The seeded teacher of the school whose assignment a joining code names, or null. */
export async function teacherOf(school: DemoSchool, code: JoinCode, kit: WorldKit): Promise<DemoTeacher | null> {
  for (const teacher of school.teachers) {
    if ((await kitStep(() => assignmentId(code.school, teacher.id, kit.mac))) === code.assignment) return teacher;
  }
  return null;
}

/** The session the teacher's phone offers a PC: the joining codes it kept in the world, with their names. */
export async function phoneSession(world: StaffWorld, school: DemoSchool, kit: WorldKit): Promise<PcSession> {
  const codes = keptJoins(world.book.entries)
    .map((one) => ({ text: one.code, code: readJoinCode(one.code) }))
    .filter((one): one is { text: string; code: JoinCode } => one.code?.world === world.world);
  const first = codes[0];
  if (first === undefined) throw failed('This phone kept no joining code of the world', 'E_PC_NOT_JOINED');
  const teacher = await teacherOf(school, first.code, kit);
  if (teacher === null) throw failed('The joining code names no teacher of the school', 'E_PC_NOT_JOINED');
  const of: { text: string; code: JoinCode }[] = [];
  for (const one of codes) {
    if (one.code.school !== first.code.school || of.length >= PC_SESSION_JOINS) continue;
    if ((await teacherOf(school, one.code, kit))?.id === teacher.id) of.push(one);
  }
  return {
    world: world.world,
    schoolName: personName(school),
    teacher: personName(teacher),
    joins: of.map((one) => one.text),
  };
}

async function putDrop(world: string, space: string, send: Send): Promise<string> {
  const path = `/worlds/${world}/spaces/${space}`;
  const opened = await send({ method: 'PUT', path, body: { kind: 'school' } });
  if (opened.status !== 200 && opened.status !== 201) throw unexpected(opened);
  return path;
}

/** Seals the session to the PC that asked, once, as the phone asks: every approval then puts this same answer. */
export async function sealAnswer(request: PcRequest, session: PcSession, kit: WorldKit): Promise<SealedAnswer> {
  const pair = await kitStep(() => newDevicePair(kit));
  return kitStep(() => sealPcAnswer(request, session, worldKeyCrypto(kit, pair), kit.mac));
}

/** Puts a sealed answer in the PC's drop space at the stream's next number, and answers the check to show. */
export async function putAnswer(
  world: StaffWorld,
  sealed: SealedAnswer,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<string> {
  const drop = await kitStep(() => pcDrop(sealed.secret, kit.mac));
  const path = await putDrop(world.world, drop.space, send);
  for (let tries = 0; tries < TRIES; tries += 1) {
    const there = (await spaceBatches(world.world, drop.space, send)).get(drop.stream) ?? [];
    const first = there.reduce((most, one) => Math.max(most, one.number + 1), 0);
    const put = await kitStep(() => pcAnswerBatches(sealed, first, kit.cipher, kit.mac));
    const body = { stream: put.stream, first, batches: put.batches.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `${path}/batches`, body });
    if (answer.status === 201) return sealed.check;
    if (answer.status !== 409) throw unexpected(answer);
  }
  throw failed('The PC’s drop space kept changing', 'E_WORLD_SERVER');
}

/** What a PC shows to be signed in, and the key, in memory only, that opens the answer. */
export interface PcAsk {
  readonly request: PcRequest;
  readonly code: string;
  readonly crypto: KeyCrypto;
}

/** Makes the PC's pair and secret, opens its drop space, and answers what to show. */
export async function askPc(world: StaffWorld, kit: WorldKit, send: Send = worldRequest): Promise<PcAsk> {
  const pair = await kitStep(() => newDevicePair(kit));
  const request = { publicKey: pair.publicKey, secret: newHolderSecret(kit.random) };
  const drop = await kitStep(() => pcDrop(request.secret, kit.mac));
  await putDrop(world.world, drop.space, send);
  return { request, code: pcQr(request), crypto: worldKeyCrypto(kit, pair) };
}

/** The session the PC's drop space holds for it, with its check; null before one, 'contested' for two. */
export async function readPc(
  world: StaffWorld,
  ask: PcAsk,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<PcAnswer | null | 'contested'> {
  const drop = await kitStep(() => pcDrop(ask.request.secret, kit.mac));
  const batches = (await spaceBatches(world.world, drop.space, send)).get(drop.stream) ?? [];
  return kitStep(() => readPcAnswer(ask.request.secret, world.world, batches, ask.crypto, kit.cipher, kit.mac));
}

/** One of the session's channels: its code, the seeded teacher it names, and the day it was joined, or null. */
export interface SessionChannel {
  readonly code: JoinCode;
  readonly teacher: DemoTeacher | null;
  readonly joined: Day | null;
}

/** What the school's space holds of a session's channels. */
export async function sessionChannels(
  session: PcSession,
  school: DemoSchool,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<readonly SessionChannel[]> {
  const codes = session.joins.map((one) => readJoinCode(one)).filter((one): one is JoinCode => one !== null);
  const first = codes[0];
  if (first === undefined) return [];
  const ca = await caKey(session.world, send);
  const batches = await spaceBatches(session.world, first.school, send);
  const channels: SessionChannel[] = [];
  for (const code of codes) {
    const channel = batches.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
    const joined = await kitStep(() => readJoined(code, channel, { key: ca, checker: kit }, kit.cipher, kit.mac));
    channels.push({ code, teacher: await teacherOf(school, code, kit), joined: joined?.certificate.issued ?? null });
  }
  return channels;
}
