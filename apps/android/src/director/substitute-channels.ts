// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The staff's channels as the director's substitute page reads them (#587,
// #588, answers 615 and 616): each staff teacher's channel, its code, its
// batches and the device that joined on it, read with the school key once, or
// none for a teacher with no code or key issued; whether a teacher of the staff
// list is the one a timetable's teacher names, by name key in either script;
// and the records passing an appointment's classes, each class's signed weeks
// in records of at most 64, numbered within the class, a class with no week
// signed still named in one of its own.

import {
  channelStream,
  HANDOVER_WEEKS,
  keptIssues,
  readJoined,
  timetableNameKey,
  type ClassHandover,
  type DemoSchool,
  type Joined,
  type SealedBatch,
  type SignedWeek,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { caKey, spaceBatches } from '../school/space-read';
import { assignmentsOf, joinCode, type IssueDesk } from './issue-session';

type ChannelWorld = Pick<OpenWorld, 'world' | 'book' | 'date'>;
export type Staff = Pick<DemoSchool, 'name' | 'teachers'>;
export type Person = Staff['teachers'][number];

/** A staff teacher's channel: its code, its batches and the device that joined on it, or null. */
export type Channel = {
  readonly code: Awaited<ReturnType<typeof joinCode>>;
  readonly theirs: readonly SealedBatch[];
  readonly joined: Joined | null;
};

/** Whether a staff teacher is the one a timetable's teacher names, by name key. */
export const owns = (person: Person, teacher: string) =>
  [person.name, person.latinName]
    .map(timetableNameKey)
    .filter((one) => one !== '')
    .includes(timetableNameKey(teacher));

/** Each staff teacher's channel as read with the school key: its code, its batches and who joined, or null. */
export async function channels(world: ChannelWorld, desk: IssueDesk, school: Staff, kit: WorldKit, send: Send) {
  const space = desk.held.school;
  const issues = keptIssues(world.book.entries, space);
  const assigned = await assignmentsOf(desk, school.teachers, kit);
  const [ca, batches] = [await caKey(world.world, send), await spaceBatches(world.world, space, send)];
  const checker = { key: ca, checker: kit };
  const read = new Map<string, Channel | null>();
  for (const person of school.teachers) {
    const issue = issues.get(assigned.get(person.id) ?? '');
    if (issue === undefined) {
      read.set(person.id, null);
      continue;
    }
    const code = await joinCode(world.world, desk, issue);
    const theirs = batches.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
    const joined = await kitStep(() => readJoined(code, theirs, checker, kit.cipher, kit.mac));
    read.set(person.id, { code, theirs, joined });
  }
  return { ca, checker, read };
}

/** Each class's signed weeks in parts of at most `HANDOVER_WEEKS`, a class with none in a part of its own. */
export function passedParts(classes: readonly string[], weeks: ReadonlyMap<string, readonly SignedWeek[]>) {
  return classes.flatMap((of) => {
    const theirs = weeks.get(timetableNameKey(of)) ?? [];
    const parts = Math.max(1, Math.ceil(theirs.length / HANDOVER_WEEKS));
    return Array.from({ length: parts }, (_, at) => ({
      class: of,
      part: at,
      parts,
      weeks: theirs.slice(at * HANDOVER_WEEKS, (at + 1) * HANDOVER_WEEKS),
    }));
  });
}

/** The handover's records for an appointment: each class's signed weeks, at most `HANDOVER_WEEKS` a record. */
export const handoverRecords = (
  base: Omit<ClassHandover, 'class' | 'part' | 'parts' | 'weeks'>,
  weeks: ReadonlyMap<string, readonly SignedWeek[]>,
): ClassHandover[] => passedParts(base.classes, weeks).map((one) => ({ ...base, ...one }));
