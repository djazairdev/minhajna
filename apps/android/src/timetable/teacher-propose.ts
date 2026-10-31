// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A teacher's proposal to move one of their sessions, from their phone in a
// demo world (#579, TT-propose, R-7.8-04, answer 607). It is made on the newest
// standing part on the teacher's channel, the one closest to the school's
// standing version. A session taught to several classes together is not
// offered, since moving one class alone would split it. A session may move to a
// school day and a start of the part's bell times, keeping its length and
// ending where a bell ends, the bells between following one another; the slots
// offered are those where it meets none of the teacher's other sessions that
// day in a week they share, never its own place, each saying whether it makes
// the teacher's day longer or adds a day to their week, which a day's only
// session moving to a free day does not. The class and the room are left to the
// school, which alone sees the whole timetable. The proposal names the part's
// version and the session's ID, the day, times and room, the room cleaned of
// hidden characters and kept to a name's length, with an optional note kept to
// 280 characters, and is signed with the key the device certified when joining
// and put on the channel (send-session.ts). Errors carry world-session.ts's
// codes and the joining's.

import {
  jointRows,
  sealTimetableRecord,
  signProposal,
  type PartSession,
  type SchoolJoined,
  type TimetablePart,
  type Weekday,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey } from '../school/space-read';
import { noteOf } from './proposal-session';
import { putOnChannel } from './send-session';
import { codeOf, type TeacherChannel } from './teacher-session';

/** A slot a session may move to, keeping its length, and what it does to the teacher's week. */
export interface Slot {
  readonly start: number;
  readonly end: number;
  /** Whether it starts before or ends after the teacher's other sessions that day. */
  readonly longer: boolean;
  /** Whether the teacher has no other session that day, while the session's own day keeps some. */
  readonly newDay: boolean;
}

/** Where a proposal moves a session, and the teacher's note. */
export interface Move {
  readonly day: Weekday;
  readonly start: number;
  readonly end: number;
  readonly room: string;
  readonly note: string;
}

/** The newest standing part on the channel, the one proposals are made on, or null. */
export const proposedOn = (channel: TeacherChannel): TimetablePart | null =>
  [...channel.parts].reverse().find((one) => !one.part.once)?.part ?? null;

const asRow = (one: PartSession) => ({ ...one, teacher: '', row: 0 });

/** Whether a session of a part is taught to several classes together. */
export const jointIn = (part: TimetablePart, session: PartSession) =>
  part.sessions.some((one) => one.id !== session.id && jointRows(asRow(one), asRow(session)));

const weeksMeet = (one: PartSession, other: PartSession) =>
  one.week === 'both' || other.week === 'both' || one.week === other.week;

/** The slots of a day where a session fits, keeping its length, meeting none of the teacher's other sessions. */
export function freeSlots(part: TimetablePart, session: PartSession, day: Weekday): Slot[] {
  const length = session.end - session.start;
  const besides = (on: Weekday) =>
    part.sessions.filter((one) => one.id !== session.id && one.day === on && weeksMeet(one, session));
  const others = besides(day);
  const first = Math.min(...others.map((one) => one.start));
  const last = Math.max(...others.map((one) => one.end));
  const bells = [...part.bells].sort((a, b) => a[0] - b[0]);
  const follows = (start: number, end: number) =>
    bells.reduce((at, [from, to]) => (from === at && to <= end ? to : at), start) === end;
  return [...new Set(bells.map(([start]) => start))]
    .map((start) => ({ start, end: start + length }))
    .filter(({ start, end }) => follows(start, end) && !(day === session.day && start === session.start))
    .filter(({ start, end }) => !others.some((one) => one.start < end && start < one.end))
    .map((slot) => ({
      ...slot,
      longer: others.length > 0 && (slot.start < first || slot.end > last),
      newDay: others.length === 0 && day !== session.day && besides(session.day).length > 0,
    }));
}

/** Sends a proposal to move a session of a part, signed by this device, on its channel. */
export async function propose(
  world: Pick<OpenWorld, 'world'>,
  join: SchoolJoined,
  part: TimetablePart,
  session: PartSession,
  move: Move,
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
  const proposal = {
    ...{ world: code.world, school: code.school, assignment, issue, version: part.version, session: session.id },
    ...{ day: move.day, start: move.start, end: move.end },
    ...{ room: noteOf(move.room, 80).trim(), note: noteOf(move.note) },
  };
  const signed = await kitStep(() => signProposal(proposal, join.certificate, signer));
  await putOnChannel(code, ca, kit, send, async (_read, first) => {
    return (await kitStep(() => sealTimetableRecord(code, signed, first, kit.cipher, kit.mac))).batches;
  });
}
