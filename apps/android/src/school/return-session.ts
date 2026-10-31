// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The classes come back to a teacher at the end of a substitution, read on
// their own channel in a demo world (#588, Handover-end, §7.5, R-7.5-07, answer
// 616): the returns the core reads (class-return.ts), refused when no device or
// another device joined on the channel, as for a handover
// (handover-session.ts); each class with how many weeks the substitute signed
// in the substitution, from the first one's first day to the last one's last
// working day, or none, and whether all its records arrived.

import {
  channelReturns,
  timetableNameKey,
  type Day,
  type ReadReturn,
  type SchoolJoined,
  type Weekday,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { codeOf } from '../timetable/teacher-session';
import { weekEnd } from '../week/week-sign-session';
import { ownJoin } from './handover-session';
import { readChannel } from './school-join-session';
import { caKey } from './space-read';

/** A class come back: its name, its weeks signed in the substitution, their first and last days, and whether whole. */
export interface ReturnedClass {
  readonly name: string;
  readonly count: number;
  readonly from: Day | null;
  readonly to: Day | null;
  readonly whole: boolean;
}

/** The returns on the teacher's channel, in the channel's order. */
export async function readReturns(
  world: Pick<OpenWorld, 'world' | 'date'>,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ReadReturn[]> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const { batches, joined } = await readChannel(code, ca, kit, send);
  const own = ownJoin(join, joined);
  return kitStep(() => channelReturns(code, batches, { key: ca, checker: kit }, own, kit.cipher, kit.mac));
}

/** A return's classes, each with its weeks' count and span, to the last week's last working day, and whether whole. */
export const returnedClasses = (one: ReadReturn, workingDays: readonly Weekday[]): ReturnedClass[] =>
  one.signed.value.classes.map((name) => {
    const days = one.weeks
      .filter(({ week }) => timetableNameKey(week.class) === timetableNameKey(name))
      .map(({ week }) => week.week)
      .sort();
    const [first, last] = [days[0] ?? null, days.at(-1) ?? null];
    return {
      name,
      count: new Set(days).size,
      from: first,
      to: last === null ? null : weekEnd(last, workingDays),
      whole: one.complete.includes(name),
    };
  });
