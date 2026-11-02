// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school exam's cut room opened for one teacher's phone (#601, answer 632),
// on the made-up school of timetable-send.ts: term 1's mathematics exam for the
// first grade, its figures taken on the world's date, signed by two days later,
// the exam a week on, one class two items into a made-up pack, and the joined
// phone its one setter.

import { addDays, readJoinCode, type ExamChart } from '@minhajna/core';
import { holdSchool } from '../src/director/issue-session';
import { caKey, spaceBatches } from '../src/school/space-read';
import { openRoom } from '../src/threshold/room-open';
import { server, setting, STAFF } from './timetable-send';
import { reference } from './world-calendar';
import { nodeKit as kit } from './world-server';

/** The room opened, with the world, its date, the joined phone, the pack and its items, and the director's desk. */
export async function openedRoom() {
  const { id, here, joined } = await setting();
  const desk = await holdSchool(here, kit, server.send, false);
  const pack = reference.packs.find((one) => one.items.length >= 3)!;
  const items = pack.items.map((one) => one.id);
  const date = here.date;
  const draft: Omit<ExamChart, 'world' | 'school' | 'setters'> = {
    exam: 'term-1',
    subject: 'math',
    grade: '1am',
    from: addDays(date, 7),
    figuresDay: date,
    signBy: addDays(date, 2),
    forecastDay: addDays(date, 5),
    pack: { id: pack.id, release: pack.release },
    items,
    classes: [{ name: '1م2', position: items[1], forecast: items[2] }],
  };
  const code = readJoinCode(joined.code)!;
  const setter = { assignment: code.assignment, name: STAFF[0].name, key: joined.certificate.publicKey, code };
  const space = await spaceBatches(id, desk.held.school, server.send);
  const ca = await caKey(id, server.send);
  const opened = await openRoom({ world: id }, desk, draft, [setter], space, ca, kit, server.send);
  return { id, date, joined, items, pack, desk, opened };
}
