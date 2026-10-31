// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes handed over to a teacher as a substitute, read on their own
// channel in a demo world (#587, Handover-school, §7.5, R-7.5-07, answer 615):
// the handovers the core reads (class-handover.ts), refused when no device or
// another device joined on the channel, each class with the first day of its
// last signed week, or none, and whether all its records arrived. The receipt,
// signed with the key the teacher joined with on the world's day, replaces the
// paper record of handover; it is put only for a handover still on the channel,
// every class of which arrived whole, and never twice (E_HANDOVER_UNKNOWN,
// E_HANDOVER_PART, E_HANDOVER_RECEIVED).

import {
  channelHandovers,
  sealHandoverReceipt,
  signHandoverReceipt,
  timetableNameKey,
  type Day,
  type JoinCode,
  type Joined,
  type ReadHandover,
  type SchoolJoined,
  type SealedBatch,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { putOnChannel } from '../timetable/send-session';
import { codeOf } from '../timetable/teacher-session';
import { readChannel } from './school-join-session';
import { caKey } from './space-read';

type HandoverWorld = Pick<OpenWorld, 'world' | 'date'>;

/** A class handed over: its name, its last signed week's first day or null, and whether all its records arrived. */
export interface HandedClass {
  readonly name: string;
  readonly last: Day | null;
  readonly whole: boolean;
}

/** The device that joined on the channel, refused when none or another device joined on it. */
export function ownJoin(join: SchoolJoined, joined: Joined | null): Joined {
  if (joined === null) throw failed('No device joined on the channel yet', 'E_TIMETABLE_UNJOINED');
  if (joined.device !== join.device) throw failed('Another device joined first', 'E_JOIN_TAKEN');
  return joined;
}

/** The channel's handovers, refused when no device or another device joined on it. */
async function handoversOn(
  code: JoinCode,
  join: SchoolJoined,
  batches: readonly SealedBatch[],
  joined: Joined | null,
  ca: string,
  kit: WorldKit,
) {
  const own = ownJoin(join, joined);
  return kitStep(() => channelHandovers(code, batches, { key: ca, checker: kit }, own, kit.cipher, kit.mac));
}

/** The handovers on the teacher's channel, in the channel's order. */
export async function readHandovers(
  world: HandoverWorld,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ReadHandover[]> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const { batches, joined } = await readChannel(code, ca, kit, send);
  return handoversOn(code, join, batches, joined, ca, kit);
}

/** Whether every class of a handover arrived whole. */
export const arrivedWhole = (one: ReadHandover) =>
  one.signed.value.classes.every((name) => one.complete.includes(name));

/** A handover's classes, each with its last signed week and whether all its records arrived. */
export const handedClasses = (one: ReadHandover): HandedClass[] =>
  one.signed.value.classes.map((name) => ({
    name,
    last: one.weeks
      .filter(({ week }) => timetableNameKey(week.class) === timetableNameKey(name))
      .reduce<Day | null>((last, { week }) => (last === null || week.week > last ? week.week : last), null),
    whole: one.complete.includes(name),
  }));

/** Signs the receipt of a handover that arrived whole on the world's day and puts it on the channel. */
export async function receiveHandover(
  world: HandoverWorld,
  join: SchoolJoined,
  appointment: string,
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
  const on = { world: code.world, school: code.school, assignment: code.assignment, issue: code.issue };
  const receipt = { ...on, appointment, day: world.date };
  const signed = await kitStep(() => signHandoverReceipt(receipt, join.certificate, signer));
  await putOnChannel(code, ca, kit, send, async ({ batches, joined }, first) => {
    const found = (await handoversOn(code, join, batches, joined, ca, kit)).find(
      (one) => one.signed.value.appointment === appointment,
    );
    if (found === undefined) throw failed('No such handover on the channel', 'E_HANDOVER_UNKNOWN');
    if (found.received !== null) throw failed('This handover is received already', 'E_HANDOVER_RECEIVED');
    if (!arrivedWhole(found)) throw failed('Not all of this handover arrived', 'E_HANDOVER_PART');
    return (await kitStep(() => sealHandoverReceipt(code, signed, first, kit.cipher, kit.mac))).batches;
  });
}
