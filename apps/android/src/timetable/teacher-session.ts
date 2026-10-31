// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teacher's timetable from the school on the teacher's phone in a demo
// world (#579, TT-change, TT-change-day, R-7.4-04 to R-7.4-07, answer 607).
// Reading opens the teacher's own channel with the code they joined on, and is
// refused while no device joined there (E_TIMETABLE_UNJOINED) or when another
// device joined there first (E_JOIN_TAKEN); it answers the parts the school
// sent, in the channel's order, the versions this device confirmed, with the
// world's day of each, and the teacher's proposals with the decision on each.
// On a day, the part that applies is a one-day part for it or the standing part
// in force; before any applies, the page shows what applies on the first day of
// any standing part. The week's hours count a session of week A or B half. Each
// part is shown as a version received, newest first: a standing part with what
// it changes from the standing part before it, a one-day part with what it
// changes on its day alone from the standing part in force then, its sessions
// being those of that day, and the first with the whole timetable. Confirming
// receipt signs a receipt with the key the device certified when joining, kept
// in the world's store, names the version and the world's date, and puts it on
// the channel (send-session.ts). Errors carry world-session.ts's codes and the
// joining's (school-join-session.ts).

import {
  channelParts,
  channelProposals,
  channelReceipts,
  compareDays,
  partChanges,
  partOn,
  readJoinCode,
  sealTimetableRecord,
  signReceipt,
  weekday,
  type Day,
  type JoinCode,
  type PartChange,
  type PartSession,
  type ProposalOnChannel,
  type SchoolJoined,
  type SignedPart,
  type TimetablePart,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { readChannel } from '../school/school-join-session';
import { caKey } from '../school/space-read';
import { putOnChannel } from './send-session';

type TeacherWorld = Pick<OpenWorld, 'world' | 'date'>;

/** The parts on the teacher's channel, and the versions this device confirmed, with the day of each. */
export interface TeacherChannel {
  readonly parts: readonly SignedPart[];
  readonly receipts: ReadonlyMap<number, Day>;
  /** The teacher's proposals on the channel, each with the decision that settled it, or null. */
  readonly proposals: readonly ProposalOnChannel[];
}

/** A version received: the part, the part it changes from, or null for the first, and what changes. */
export interface Received {
  readonly part: TimetablePart;
  readonly base: TimetablePart | null;
  readonly changes: readonly PartChange[];
  /** The world's day this device confirmed it, or null. */
  readonly confirmed: Day | null;
}

/** A join's code, which must read. */
export function codeOf(join: SchoolJoined): JoinCode {
  const code = readJoinCode(join.code);
  if (code === null) throw failed('Not a joining code', 'E_JOIN_CODE');
  return code;
}

/** The parts and receipts on the channel of the code this device joined on. */
export async function readTeacherChannel(
  world: TeacherWorld,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<TeacherChannel> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const { batches, joined } = await readChannel(code, ca, kit, send);
  if (joined === null) throw failed('No device joined on the channel yet', 'E_TIMETABLE_UNJOINED');
  if (joined.device !== join.device) throw failed('Another device joined first', 'E_JOIN_TAKEN');
  const checker = { key: ca, checker: kit };
  const parts = await kitStep(() => channelParts(code, batches, checker, joined.device, kit.cipher, kit.mac));
  const receipts = await kitStep(() => channelReceipts(code, batches, checker, joined, kit.cipher, kit.mac));
  const proposals = await kitStep(() => channelProposals(code, batches, checker, joined, kit.cipher, kit.mac));
  return { parts, receipts: new Map(receipts.map((one) => [one.value.version, one.value.day])), proposals };
}

/** The part that applies on a day, a one-day part for it or the standing part in force, or null. */
export const inForce = (channel: TeacherChannel, day: Day) => partOn(channel.parts, day)?.part ?? null;

/** The part that applies on the first day of any standing part, when none applies yet, or null. */
export function firstToCome(channel: TeacherChannel): TimetablePart | null {
  const [first] = channel.parts
    .filter((one) => !one.part.once)
    .map((one) => one.part.from)
    .sort(compareDays);
  return first === undefined ? null : inForce(channel, first);
}

/** Each version received, newest first, with what it changes. */
export function receivedVersions(channel: TeacherChannel): Received[] {
  const standing = channel.parts.filter((one) => !one.part.once);
  return channel.parts
    .map(({ part }, at) => {
      const before = channel.parts.slice(0, at).filter((one) => !one.part.once);
      const base = part.once ? (partOn(standing, part.from)?.part ?? null) : (before.at(-1)?.part ?? null);
      const day = weekday(part.from);
      const onDay = (change: PartChange) => !part.once || [change.before?.day, change.after?.day].includes(day);
      const changes = base === null ? [] : partChanges(base.sessions, part.sessions).filter(onDay);
      return { part, base, changes, confirmed: channel.receipts.get(part.version) ?? null };
    })
    .reverse();
}

/** A part's sessions as they apply: for a one-day part, those of its day alone. */
export const sessionsOf = (part: TimetablePart) =>
  part.once ? part.sessions.filter((one) => one.day === weekday(part.from)) : part.sessions;

/** A week's teaching hours: a weekly session counts whole, a session of week A or B half. */
export const hoursOf = (sessions: readonly PartSession[]) =>
  sessions.reduce((sum, one) => sum + ((one.end - one.start) * (one.week === 'both' ? 1 : 0.5)) / 60, 0);

/** Confirms receipt of a version: a receipt signed by this device, put on its channel. */
export async function confirmReceipt(
  world: TeacherWorld,
  join: SchoolJoined,
  version: number,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<void> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const signer = {
    publicKey: join.certificate.publicKey,
    sign: (one: string) => kit.sign(join.pkcs8, one),
    verify: kit.verify,
  };
  const { assignment, issue } = code;
  const receipt = { world: code.world, school: code.school, assignment, issue, version, day: world.date };
  const signed = await kitStep(() => signReceipt(receipt, join.certificate, signer));
  await putOnChannel(code, ca, kit, send, async (_read, first) => {
    return (await kitStep(() => sealTimetableRecord(code, signed, first, kit.cipher, kit.mac))).batches;
  });
}
