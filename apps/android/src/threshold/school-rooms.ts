// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school exams' cut rooms on the director's device (#603, D-Threshold,
// answers 632 and 637), with the school key held: up to the year's last day,
// reading takes every school exam the calendar holds, and for each grade and
// subject the timetable gives a class sitting it (exam-charts.ts), the room the
// school key derives for it (room-open.ts), the space read once, each room
// whose decider's chart is in place, its figures day reached, given with where
// its cut stands on the world's date (exam-cuts.ts), so that a room stays shown
// when its exam has moved later since; a room not opened is left out, with no
// decider key worked out for it. The director's decision, the cut proposed or
// no cut, is signed with the room's decider key (decider-key.ts), dated the
// world's date, and put in the room once; it is refused (E_CUT_CLOSED) when the
// room now stands under another epoch or holds no chart, and unless the
// decision has fallen to the director, the cut is unsettled and the world's
// date is before the exam's first day as the chart has it, in the room as read
// when it is put. A decision left untaken until that day has lapsed, until the
// exam is over. Errors carry world-session.ts's codes.

import {
  compareDays,
  cutState,
  deciderSeed,
  roomRecords,
  sealRoomRecord,
  signRoomRecord,
  worldExams,
  type CutState,
  type DemoSchool,
  type ExamChart,
  type ExamCut,
  type RoomRecords,
  type WorldExam,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import type { IssueDesk } from '../director/school-desk';
import type { TermReference } from '../director/seeded-fill';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnce } from '../school/stream-put';
import { deciderSigning } from './decider-key';
import { examGroups } from './exam-charts';
import { roomFound, roomOf } from './room-open';

type RoomWorld = Pick<OpenWorld, 'world' | 'date'>;

/** A room as the director's device reads it. */
export interface SchoolRoom {
  readonly exam: WorldExam;
  readonly chart: ExamChart;
  readonly state: CutState;
  /** The epoch of the school key the room stands under. */
  readonly epoch: number;
  /** The world CA's key the room was read with. */
  readonly ca: string;
}

/** The opened rooms of the year’s school exams whose figures day the date reached, in order. */
export async function readSchoolRooms(
  world: RoomWorld,
  desk: IssueDesk,
  school: DemoSchool,
  reference: Pick<TermReference, 'calendar'>,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<SchoolRoom[]> {
  const { year, entries } = reference.calendar;
  if (compareDays(world.date, year.to) > 0) return [];
  const exams = worldExams(year, entries).filter((one) => one.setBy === 'school');
  exams.sort((a, b) => compareDays(a.from, b.from));
  if (exams.length === 0) return [];
  const ca = await caKey(world.world, send);
  const space = await spaceBatches(world.world, desk.held.school, send);
  const rooms: SchoolRoom[] = [];
  for (const exam of exams)
    for (const { grade, subject } of examGroups(exam, school)) {
      const name = { world: world.world, school: desk.held.school, exam: exam.id, subject, grade };
      const room = await roomFound(desk, name, space, ca, kit);
      const state = room.records === null ? null : cutState(room.records, world.date);
      const { chart } = room;
      if (chart === null || state === null || compareDays(chart.figuresDay, world.date) > 0) continue;
      rooms.push({ exam, chart, state, epoch: room.epoch, ca });
    }
  return rooms;
}

/** Whether the director may still decide a room's cut on a day: it fell to them, unsettled, before the exam. */
export function mayDecide({ chart, state }: Pick<SchoolRoom, 'chart' | 'state'>, date: RoomWorld['date']): boolean {
  return state.director && state.settled === null && compareDays(date, chart.from) < 0;
}

/** Whether the decision fell to the director and was left untaken until the exam's first day, before it is over. */
export function lapsed({ chart, state }: Pick<SchoolRoom, 'chart' | 'state'>, date: RoomWorld['date'], over: boolean) {
  return !over && state.director && state.settled === null && compareDays(date, chart.from) >= 0;
}

/** Signs the director's decision in a room, the cut proposed or null for no cut, and puts it there once. */
export async function decideCut(
  world: RoomWorld,
  desk: IssueDesk,
  read: Pick<SchoolRoom, 'chart' | 'epoch' | 'ca'>,
  item: string | null,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ExamCut> {
  const { chart, epoch, ca } = read;
  const closed = () => failed('The cut can no longer be decided', 'E_CUT_CLOSED');
  if (item !== null && !chart.items.includes(item)) throw new RangeError('A decision names an item of the chart');
  const { world: id, school, exam, subject, grade } = chart;
  const name = { world: id, school, exam, subject, grade };
  const space = await spaceBatches(world.world, desk.held.school, send);
  const room = await roomOf(desk, name, space, ca, kit);
  if (room.epoch !== epoch || room.chart === null) throw closed();
  const seed = await kitStep(() => deciderSeed(desk.opened, epoch, name, desk.crypto));
  const checker = { key: ca, checker: kit };
  const decider = { name, decider: room.decider };
  let records: RoomRecords | null = null;
  const out: { made: { cut: ExamCut; signature: string } | null; shut: boolean } = { made: null, shut: false };
  await putOnce(
    {
      world: world.world,
      space: school,
      kind: 'school',
      stream: room.place.stream,
      open: async (held) => {
        records = await roomRecords(room.place, held, checker, decider, kit.cipher);
        return records.cuts.map((one) => one.record.signature);
      },
      there: (signatures) => {
        if (out.made !== null && signatures.includes(out.made.signature)) return true;
        const state = records === null ? null : cutState(records, world.date);
        out.shut = state === null || !mayDecide({ chart, state }, world.date);
        return out.shut;
      },
      seal: async (first) => {
        const { certificate, signer } = await deciderSigning(world.world, desk, seed, ca, kit, send);
        const cut: ExamCut = { ...name, item, day: world.date, version: 0 };
        const signed = await kitStep(() => signRoomRecord('decision', cut, certificate, signer));
        out.made = { cut, signature: signed.signed.signature };
        return sealRoomRecord(room.place, signed, first, kit.cipher);
      },
    },
    send,
  );
  if (out.made === null || out.shut) throw closed();
  return out.made.cut;
}
