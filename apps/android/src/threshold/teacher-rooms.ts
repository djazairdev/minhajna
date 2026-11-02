// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// The school exams' cut rooms on a teacher's phone (#601, answer 632): reading
// opens the teacher's own channel with the code they joined on, refused while
// no device joined there (E_TIMETABLE_UNJOINED) or when another device joined
// there first (E_JOIN_TAKEN), and takes each room handed there, the last handed
// for an exam, subject and grade, signed by a key other than the phone's; each
// room whose decider's chart is in place is read with where its cut stands on
// the world's date (exam-cuts.ts), whether this phone is one of its setters,
// and this phone's highest cut's version, the rooms in the order of their
// exams, with, when asked, the weeks the phone signed on its channel from the
// same reading, none when they do not read. A setter signs a cut, an item of
// the chart or none for no cut, with the key the phone certified when joining,
// dated the world's date and numbered past their highest in the room as read
// when it is put, put in the room once, so signing twice from one reading keeps
// the later; signing is refused for a phone the chart does not name
// (E_CUT_NOT_SETTER) and once the deadline has passed or, in the room as read
// then, the director has decided (E_CUT_CLOSED). A setter may change their cut,
// a no cut among them, until then. The space is read once for a reading. Errors
// carry world-session.ts's codes and the joining's (school-join-session.ts).

import {
  channelRooms,
  channelStream,
  channelWeeks,
  compareDays,
  cutState,
  handedKey,
  readJoined,
  roomPlace,
  roomRecords,
  sealRoomRecord,
  signRoomRecord,
  type ChartSetter,
  type CutState,
  type ExamChart,
  type ExamCut,
  type ExamRoom,
  type RoomRecords,
  type SchoolJoined,
  type WeekRecord,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { failed, kitStep, type Send, type WorldKit } from '../demo/world-session';
import { worldRequest } from '../network/world-network';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnce } from '../school/stream-put';
import { codeOf } from '../timetable/teacher-session';

type TeacherWorld = Pick<OpenWorld, 'world' | 'date'>;

/** A room as the teacher's phone reads it. */
export interface TeacherRoom {
  readonly room: ExamRoom;
  readonly chart: ExamChart;
  readonly state: CutState;
  /** This phone as the chart names it among the setters, or null when it is not one. */
  readonly mine: ChartSetter | null;
  /** This phone's highest cut's version in the room, or -1 before any. */
  readonly version: number;
  /** The world CA's key the room was read with. */
  readonly ca: string;
}

const nameOf = (room: Pick<ExamRoom, 'world' | 'school' | 'exam' | 'subject' | 'grade'>) => {
  const { world, school, exam, subject, grade } = room;
  return { world, school, exam, subject, grade };
};

/** The rooms handed on the channel of the code this phone joined on, each with its chart in place. */
export async function readTeacherRooms(
  world: TeacherWorld,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<TeacherRoom[]> {
  return (await readTeacherExams(world, join, kit, send, false)).rooms;
}

/**
 * The rooms handed on the phone's channel and, when asked, the weeks it signed
 * there, from one reading of the space; weeks that do not read are null.
 */
export async function readTeacherExams(
  world: TeacherWorld,
  join: SchoolJoined,
  kit: WorldKit,
  send: Send = worldRequest,
  own = true,
): Promise<{ readonly rooms: TeacherRoom[]; readonly weeks: WeekRecord[] | null }> {
  const code = codeOf(join);
  const ca = await caKey(world.world, send);
  const checker = { key: ca, checker: kit };
  const space = await spaceBatches(world.world, code.school, send);
  const batches = space.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
  const joined = await kitStep(() => readJoined(code, batches, checker, kit.cipher, kit.mac));
  if (joined === null) throw failed('No device joined on the channel yet', 'E_TIMETABLE_UNJOINED');
  if (joined.device !== join.device) throw failed('Another device joined first', 'E_JOIN_TAKEN');
  const handed = new Map<string, ExamRoom>();
  for (const room of await kitStep(() => channelRooms(code, batches, checker, joined, kit.cipher, kit.mac)))
    handed.set(JSON.stringify([room.exam, room.subject, room.grade]), room);
  const rooms: TeacherRoom[] = [];
  for (const room of handed.values()) {
    const place = await kitStep(() => roomPlace(handedKey(room), kit.mac));
    const held = space.get(place.stream) ?? [];
    const records = await kitStep(() =>
      roomRecords(place, held, checker, { name: nameOf(room), decider: room.decider }, kit.cipher),
    );
    const state = cutState(records, world.date);
    if (records.chart === null || state === null) continue;
    const key = join.certificate.publicKey;
    const mine = records.chart.value.setters.find((one) => one.key === key) ?? null;
    rooms.push({ room, chart: records.chart.value, state, mine, version: versionOf(records, key), ca });
  }
  rooms.sort((a, b) => compareDays(a.chart.from, b.chart.from));
  if (!own) return { rooms, weeks: null };
  const weeks = await channelWeeks(code, batches, checker, joined, kit.cipher, kit.mac).then(
    (read) => read.map((one) => one.week),
    () => null,
  );
  return { rooms, weeks };
}

/** The highest version of a key's cuts in a room's records, or -1 before any. */
const versionOf = (records: RoomRecords, key: string) =>
  records.cuts
    .filter((one) => one.kind === 'cut' && one.record.certificate.publicKey === key)
    .reduce((most, one) => Math.max(most, one.record.value.version), -1);

/**
 * Signs this phone's cut in a room, an item of its chart or null for no cut,
 * numbered past its highest in the room as read when it is put, and puts it
 * there once; the room as read then also says whether the director decided.
 */
export async function signCut(
  world: TeacherWorld,
  join: SchoolJoined,
  read: Pick<TeacherRoom, 'room' | 'chart' | 'mine' | 'ca'>,
  item: string | null,
  kit: WorldKit,
  send: Send = worldRequest,
): Promise<ExamCut> {
  const { room, chart, mine } = read;
  const closed = () => failed('The cut can no longer be signed', 'E_CUT_CLOSED');
  if (mine === null) throw failed('This phone is not one of the exam’s setters', 'E_CUT_NOT_SETTER');
  if (compareDays(world.date, chart.signBy) > 0) throw closed();
  if (item !== null && !chart.items.includes(item)) throw new RangeError('A cut names an item of the chart');
  const signer = {
    publicKey: join.certificate.publicKey,
    sign: (one: string) => kit.sign(join.pkcs8, one),
    verify: kit.verify,
  };
  const place = await kitStep(() => roomPlace(handedKey(room), kit.mac));
  const checker = { key: read.ca, checker: kit };
  const decider = { name: nameOf(room), decider: room.decider };
  let records: RoomRecords | null = null;
  let made: { cut: ExamCut; signature: string } | null = null;
  let decided = false;
  await putOnce(
    {
      world: world.world,
      space: room.school,
      kind: 'school',
      stream: place.stream,
      open: async (held) => {
        records = await roomRecords(place, held, checker, decider, kit.cipher);
        return records.cuts.map((one) => one.record.signature);
      },
      there: (signatures) => {
        decided = records !== null && cutState(records, world.date)?.settled?.by === 'director';
        return decided || (made !== null && signatures.includes(made.signature));
      },
      seal: async (first) => {
        if (records === null) throw new RangeError('The room was not read');
        const cut: ExamCut = {
          ...nameOf(room),
          item,
          day: world.date,
          version: versionOf(records, signer.publicKey) + 1,
        };
        const signed = await signRoomRecord('cut', cut, join.certificate, signer);
        made = { cut, signature: signed.signed.signature };
        return sealRoomRecord(place, signed, first, kit.cipher);
      },
    },
    send,
  );
  if (decided) throw closed();
  return made!.cut;
}
