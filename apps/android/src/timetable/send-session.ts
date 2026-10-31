// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Sending each teacher their part of the timetable from the director's device
// in a demo world (#577, answer 605). The school key is held, never started
// here, and each of the timetable's teachers is matched to the school's staff
// list by the timetable's name key, under either spelling of the name, both
// spellings of one teacher counting as one; a name two of the staff list share
// matches no one, so no part goes to the wrong teacher. A teacher matched whose
// code or security key has been issued is sent a part on the current issue's
// channel, which the device that joins on it reads; one with none issued yet,
// one not in the staff list, one whose name is shared, and one whose part is
// too long to send, are named apart. A part that does not reach the server
// names its teacher with the problem met, and the others are still sent. The
// device's signing key is made the first time it sends in a world, certified by
// the world's CA for the device's own ID, and kept in memory only, for the last
// world it sent in, so a reload makes a new one. A part's version is one more
// than the highest this key put on the channel, it applies from the next
// Sunday, and it carries the level's bell times. It is put at the channel's
// next number, read again after another write came first. Errors before any
// part carry world-session.ts's codes and those of holding the school key.

import {
  addDays,
  certificateRequest,
  channelParts,
  channelStream,
  checkCertificate,
  isTimetablePart,
  keptIssues,
  partSessions,
  readJoined,
  sealPart,
  signPart,
  teachersOf,
  timetableNameKey,
  toBase64Url,
  weekday,
  type BellTimes,
  type Certificate,
  type Day,
  type DemoSchool,
  type ImportedSession,
  type KeySigner,
  type TimetablePart,
} from '@minhajna/core';
import { assignmentsOf, holdSchool, joinCode, type IssueDesk } from '../director/issue-session';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, unexpected, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';

/** How many times a part is put on its channel before giving up. */
const TRIES = 3;

type SendWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;

/** The teachers sent their part, and those who were not, by the timetable's names. */
export interface SentParts {
  readonly sent: readonly string[];
  /** In the staff list, with no code or key issued yet. */
  readonly noCode: readonly string[];
  /** Not in the school's staff list. */
  readonly notStaff: readonly string[];
  /** Whose name two or more of the staff list share, so the part could go to the wrong teacher. */
  readonly twoNames: readonly string[];
  /** Whose part is longer than one channel carries, or holds a name longer than a part takes. */
  readonly tooLong: readonly string[];
  /** Whose part did not reach the server. */
  readonly failed: readonly string[];
  /** The last problem met while sending, or null. */
  readonly problem: unknown;
}

type Signing = { readonly signer: KeySigner; readonly certificate: Certificate };

/** This device's certified signing key, by world and device, in memory only. */
const signing = new Map<string, Promise<Signing>>();

async function certify(world: string, device: string, ca: string, kit: WorldKit, send: Send): Promise<Signing> {
  const pair = await kitStep(() => kit.newPair());
  const signer = { publicKey: pair.spki, sign: (one: string) => kit.sign(pair.pkcs8, one), verify: kit.verify };
  const request = await kitStep(() => certificateRequest(world, device, signer));
  const answer = await send({ method: 'POST', path: `/worlds/${world}/certificates`, body: request });
  const certificate = answer.body as Certificate;
  const holds = answer.status === 201 && (await checkCertificate(certificate, world, ca, kit));
  if (!holds || certificate.subject !== device || certificate.publicKey !== pair.spki) throw unexpected(answer);
  return { signer, certificate };
}

function signingKey(world: string, desk: IssueDesk, ca: string, kit: WorldKit, send: Send): Promise<Signing> {
  const at = `${world}:${desk.held.device}`;
  for (const one of signing.keys()) if (one !== at) signing.delete(one);
  const kept = signing.get(at) ?? certify(world, desk.held.device, ca, kit, send);
  signing.set(at, kept);
  kept.catch(() => signing.delete(at));
  return kept;
}

/** The day a part sent on `date` applies from: the next Sunday. */
export const partFrom = (date: Day): Day => addDays(date, 7 - weekday(date));

/** Sends each of the timetable's teachers their part, and answers who was sent it and who was not. */
export async function sendParts(
  world: SendWorld,
  school: Pick<DemoSchool, 'name' | 'teachers'>,
  sessions: readonly ImportedSession[],
  bells: BellTimes,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<SentParts> {
  const desk = await holdSchool(world, kit, send, false);
  const ca = await caKey(world.world, send);
  const staff = new Map<string, Set<string>>();
  for (const one of school.teachers) {
    for (const key of [one.name, one.latinName].map(timetableNameKey).filter((name) => name !== '')) {
      staff.set(key, (staff.get(key) ?? new Set()).add(one.id));
    }
  }
  const lists = ['sent', 'noCode', 'notStaff', 'twoNames', 'tooLong', 'failed'] as const;
  const found = Object.fromEntries(lists.map((one) => [one, [] as string[]])) as Record<
    (typeof lists)[number],
    string[]
  >;
  let problem: unknown = null;
  let key: Promise<Signing> | null = null;
  const matched = new Map<string, { teacher: string; sessions: ImportedSession[] }>();
  for (const [teacher, theirs] of teachersOf(sessions)) {
    const ids = staff.get(timetableNameKey(teacher)) ?? new Set<string>();
    const [id] = ids;
    if (ids.size > 1) found.twoNames.push(teacher);
    if (id === undefined) found.notStaff.push(teacher);
    if (id === undefined || ids.size > 1) continue;
    const kept = matched.get(id) ?? { teacher, sessions: [] };
    kept.sessions.push(...theirs);
    matched.set(id, kept);
  }
  const issues = keptIssues(world.book.entries, desk.held.school);
  const assignments = await assignmentsOf(desk, school.teachers, kit);
  const from = partFrom(world.date);
  for (const [id, { teacher, sessions: theirs }] of matched) {
    const issue = issues.get(assignments.get(id) ?? '');
    if (issue === undefined) {
      found.noCode.push(teacher);
      continue;
    }
    const part = {
      world: world.world,
      school: desk.held.school,
      schoolName: school.name,
      assignment: issue.assignment,
      issue: issue.issue,
      teacher,
      version: 1,
      from,
      sessions: await kitStep(() => partSessions(desk.held.school, theirs, kit.mac)),
      bells,
    };
    if (!isTimetablePart(part)) {
      found.tooLong.push(teacher);
      continue;
    }
    try {
      key ??= signingKey(world.world, desk, ca, kit, send);
      await putPart(await joinCode(world.world, desk, issue), part, await key, ca, kit, send);
      found.sent.push(teacher);
    } catch (error) {
      found.failed.push(teacher);
      problem = error;
    }
  }
  return { ...found, problem };
}

/**
 * Puts a part on its code's channel at the stream's next number, its version
 * one more than the highest this key put there, reading the channel again when
 * another write came first.
 */
async function putPart(
  code: Awaited<ReturnType<typeof joinCode>>,
  part: TimetablePart,
  key: Signing,
  ca: string,
  kit: WorldKit,
  send: Send,
): Promise<void> {
  const stream = await kitStep(() => channelStream(code, kit.mac));
  for (let tries = 0; tries < TRIES; tries += 1) {
    const batches = (await spaceBatches(code.world, code.school, send)).get(stream) ?? [];
    const checker = { key: ca, checker: kit };
    const joined = await kitStep(() => readJoined(code, batches, checker, kit.cipher, kit.mac));
    const parts = await kitStep(() =>
      channelParts(code, batches, checker, joined?.device ?? null, kit.cipher, kit.mac),
    );
    const ours = parts.filter((one) => one.certificate.publicKey === key.certificate.publicKey);
    const version = ours.reduce((most, one) => Math.max(most, one.part.version), 0) + 1;
    const signed = await kitStep(() => signPart({ ...part, version }, key.certificate, key.signer));
    const first = batches.reduce((next, one) => Math.max(next, one.number + 1), 0);
    const sealed = await kitStep(() => sealPart(code, signed, first, kit.cipher, kit.mac));
    const body = { stream, first, batches: sealed.batches.map((one) => toBase64Url(one.bytes)) };
    const answer = await send({ method: 'POST', path: `/worlds/${code.world}/spaces/${code.school}/batches`, body });
    if (answer.status === 201) return;
    if (answer.status !== 409) throw unexpected(answer);
  }
  throw failed('Another write kept coming first on the channel', 'E_WORLD_BUSY');
}
