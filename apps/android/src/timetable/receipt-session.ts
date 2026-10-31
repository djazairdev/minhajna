// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The teachers' receipts of the timetable on the director's device in a demo
// world (#579, R-7.4-06, R-7.4-16, answer 607). Reading holds the school key,
// never started here, and opens the channel of each teacher's latest code or
// key issued, so a teacher given a new code is listed once a part is sent on
// it. A teacher sent a part, by any key but the joined device's, is listed in
// the staff list's order with how they joined, the latest standing version sent
// and the day their joined device confirmed it, or else the highest standing
// version it confirmed before, and, for each day still to come from the world's
// date, the latest one-day version for it, with the day it was confirmed or
// none. A teacher is up to date when that standing version and every one-day
// version still to come are confirmed; a teacher who joined with a security key
// confirms from the staffroom PC, which the demo does not offer yet, so is
// shown apart. Receipts count as the core reads them (timetable-receipt.ts):
// only those the joined device signed, each after a part of its version. Errors
// carry world-session.ts's codes and those of holding the school key.

import {
  channelParts,
  channelReceipts,
  channelStream,
  compareDays,
  keptIssues,
  readJoined,
  type Day,
  type DemoSchool,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { assignmentsOf, holdSchool, joinCode } from '../director/issue-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';

/** A version sent, and the world's day the teacher's joined device confirmed it, or null. */
export interface Receipted {
  readonly version: number;
  readonly confirmed: Day | null;
}

/** A teacher sent a part, with their receipts of the versions that apply now or later. */
export interface TeacherReceipt {
  /** The staff list's ID. */
  readonly id: string;
  readonly teacher: string;
  readonly access: 'phone' | 'key';
  /** The latest standing version sent. */
  readonly standing: Receipted;
  /** The highest standing version confirmed before it, with its day, or null. */
  readonly before: { readonly version: number; readonly day: Day } | null;
  /** Each one-day version still to come, with its day. */
  readonly days: readonly (Receipted & { readonly day: Day })[];
}

/** Whether a teacher confirmed the latest standing version and every one-day version still to come. */
export const upToDate = (one: TeacherReceipt) =>
  one.standing.confirmed !== null && one.days.every((day) => day.confirmed !== null);

/** Each teacher sent a part, in the staff list's order, with their receipts. */
export async function readReceipts(
  world: Pick<OpenWorld, 'world' | 'book' | 'date'>,
  school: Pick<DemoSchool, 'teachers'>,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<TeacherReceipt[]> {
  const desk = await holdSchool(world, kit, send, false);
  const space = desk.held.school;
  const issues = keptIssues(world.book.entries, space);
  const assigned = await assignmentsOf(desk, school.teachers, kit);
  const [ca, batches] = [await caKey(world.world, send), await spaceBatches(world.world, space, send)];
  const checker = { key: ca, checker: kit };
  const found: TeacherReceipt[] = [];
  for (const person of school.teachers) {
    const issue = issues.get(assigned.get(person.id) ?? '');
    if (issue === undefined) continue;
    const code = await joinCode(world.world, desk, issue);
    const theirs = batches.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
    const joined = await kitStep(() => readJoined(code, theirs, checker, kit.cipher, kit.mac));
    const read = await kitStep(() => channelParts(code, theirs, checker, joined?.device ?? null, kit.cipher, kit.mac));
    const parts = read
      .filter((one) => one.certificate.publicKey !== joined?.certificate.publicKey)
      .map((one) => one.part);
    const latest = parts.filter((one) => !one.once).at(-1);
    if (latest === undefined) continue;
    const receipts = await kitStep(() => channelReceipts(code, theirs, checker, joined, kit.cipher, kit.mac));
    const on = new Map(receipts.map((one) => [one.value.version, one.value.day]));
    const standing = new Set(parts.filter((one) => !one.once).map((one) => one.version));
    const [last] = [...on]
      .filter(([version]) => standing.has(version) && version < latest.version)
      .sort((a, b) => b[0] - a[0]);
    const coming = parts.filter((one) => one.once && compareDays(one.from, world.date) >= 0);
    const days = [...new Map(coming.map((one) => [one.from, one])).values()]
      .sort((a, b) => compareDays(a.from, b.from))
      .map((one) => ({ version: one.version, day: one.from, confirmed: on.get(one.version) ?? null }));
    found.push({
      id: person.id,
      teacher: person.name,
      access: issue.access,
      standing: { version: latest.version, confirmed: on.get(latest.version) ?? null },
      before: last === undefined ? null : { version: last[0], day: last[1] },
      days,
    });
  }
  return found;
}
