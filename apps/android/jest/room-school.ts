// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A seeded school whose cut rooms the director's device opens (#601, #602), on
// a made-up demo server: its term filled as a seeded school's is, then read as
// one whose key the device took, with the director's device, its desk and the
// school's records; and the channel rooms each joined teacher holds for an
// exam, subject and grade, with the assignment each is handed to.

import {
  channelRooms,
  channelStream,
  directorSchool,
  issuesIn,
  seedNationalWorld,
  type ExamRoom,
} from '@minhajna/core';
import { startSeededWorld } from '../src/demo/world-seed';
import { holdSchool, joinCode } from '../src/director/issue-session';
import { recordsOf } from '../src/director/records-session';
import { fillSeededTerm } from '../src/director/seeded-fill';
import { seededKeyOf, takeSeededKey } from '../src/director/seeded-key';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRecordBook } from '../src/storage/history';
import { FakeStorage } from './fake-storage';
import { calendar, reference } from './world-calendar';
import { DemoServer, nodeKit } from './world-server';

export const server = new DemoServer();

/** The seeded school filled and read, with the world, the director's device, its desk and the records. */
export async function filled() {
  const started = await startSeededWorld('national', calendar, reference, nodeKit, server.send);
  const id = started.keys.world;
  const { zones = [], workingDays } = reference.profile;
  const school = directorSchool(seedNationalWorld(id, zones, workingDays, reference.packs))!;
  const held = { world: id, keys: started.keys, sealing: started.sealing };
  const director = { world: id, date: started.date, book: await openRecordBook(new FakeStorage().asSpec()) };
  await takeSeededKey(director, held, school, nodeKit, server.send);
  const desk = await holdSchool(director, nodeKit, server.send, false);
  const seeded = (await seededKeyOf(held, school.id, nodeKit, server.send))!;
  await fillSeededTerm(director, desk, seeded, reference, nodeKit, server.send);
  const records = await recordsOf(director, desk, school, nodeKit, server.send);
  return { id, school, director, desk, records };
}

/** The rooms of an exam, subject and grade on every issued channel of the school, as the space now holds them. */
export async function handedRooms(
  { id, director, desk }: Awaited<ReturnType<typeof filled>>,
  name: Pick<ExamRoom, 'exam' | 'subject' | 'grade'>,
): Promise<ExamRoom[]> {
  const batches = await spaceBatches(id, desk.held.school, server.send);
  const checker = { key: await caKey(id, server.send), checker: nodeKit };
  const rooms: ExamRoom[] = [];
  for (const issue of issuesIn(director.book.entries, desk.held.school)) {
    const code = await joinCode(id, desk, issue);
    const theirs = batches.get(await channelStream(code, nodeKit.mac)) ?? [];
    for (const room of await channelRooms(code, theirs, checker, null, nodeKit.cipher, nodeKit.mac))
      if (room.exam === name.exam && room.subject === name.subject && room.grade === name.grade) rooms.push(room);
  }
  return rooms;
}
