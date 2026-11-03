// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// Opening the school exams' cut rooms from the director's device (#601, answer
// 632), with the school key held, once the dashboard has read the school's
// signed weeks: for every school exam whose figures day the world's date has
// reached, up to its last day, each grade and subject's chart (exam-charts.ts)
// gets a room, its setters the teachers the timetable names for it whose latest
// code or key a phone joined on, each named as the staff list names them and
// known by that phone's key; a chart with no such setter opens no room, as no
// phone would read it. A room stays under the latest epoch of the school key
// when its room holds the decider's chart, else under the newest older one
// whose room does, a known limit once a device is removed from the key, so a
// rekey after the figures day never splits its setters, and is opened under the
// latest otherwise; its chart, signed by the decider (decider-key.ts) only when
// it is put, goes in unless one is there, then the room is handed on the
// channel of each setter the chart there names, unless a room the school key
// derives for it is there, so setters who join later are left to the director.
// From the day after a school exam's last day to the year's last day (#602,
// answer 634), each room whose chart is in place is handed the same way to
// every teacher the timetable gives its subject in a class of its grade whose
// latest code or key a phone joined on, setters or not, once, so they read the
// cut as published; a room with no chart then is left without one. What is
// already in place is told from the space as read once, and only what is
// missing is put. A room or a setter that fails is passed over, counted, and
// tried again with the next reading; a channel's rooms are read once for all
// the rooms of one reading of the space. A room is found with its decider's key
// worked out only when it holds records or is about to be opened.

import {
  channelRooms,
  channelStream,
  deciderSeed,
  isHeldRoom,
  issuesIn,
  keyText,
  latestEpoch,
  readJoined,
  roomKey,
  roomPlace,
  roomRecords,
  sealRoom,
  sealRoomRecord,
  signRoom,
  signRoomRecord,
  type ChartSetter,
  type DemoSchool,
  type ExamChart,
  type ExamRoom,
  type JoinCode,
  type KeptIssue,
  type RoomName,
  type SealedBatch,
} from '@minhajna/core';
import type { OpenWorld } from '../demo/world-mode';
import { kitStep, type Send, type WorldKit } from '../demo/world-session';
import { assignmentsOf, joinCode } from '../director/issue-session';
import type { ClassRecords } from '../director/records-session';
import type { IssueDesk } from '../director/school-desk';
import type { TermReference } from '../director/seeded-fill';
import { caKey, spaceBatches } from '../school/space-read';
import { putOnce } from '../school/stream-put';
import { putOnChannel } from '../timetable/send-session';
import { deciderKey, deciderSigning } from './decider-key';
import { chartDrafts, examsAfter, examsOpen, type ChartDraft } from './exam-charts';

type RoomWorld = Pick<OpenWorld, 'world' | 'date' | 'book'>;
type Space = ReadonlyMap<string, readonly SealedBatch[]>;

/** A setter as a room is opened for them: as the chart names them, and their channel's code. */
export interface RoomSetter extends ChartSetter {
  readonly code: JoinCode;
}

/** Each teacher's latest issue in the school's space, by teacher ID. */
async function latestIssues(world: RoomWorld, desk: IssueDesk, school: DemoSchool, kit: WorldKit) {
  const assigned = await assignmentsOf(desk, school.teachers, kit);
  const issues = issuesIn(world.book.entries, desk.held.school);
  const latest = new Map<string, KeptIssue>();
  for (const [teacher, assignment] of assigned)
    for (const one of issues)
      if (one.assignment === assignment && one.issue > (latest.get(teacher)?.issue ?? 0)) latest.set(teacher, one);
  return latest;
}

/**
 * The room's epoch, key and place, its decider's public key, its records as read, and the decider's chart or null;
 * the decider's key is worked out only for a room that holds records, null otherwise.
 */
export async function roomFound(desk: IssueDesk, name: RoomName, space: Space, ca: string, kit: WorldKit) {
  const checker = { key: ca, checker: kit };
  const at = async (epoch: number) => {
    const key = await kitStep(() => roomKey(desk.opened, epoch, name, desk.crypto));
    const place = await kitStep(() => roomPlace(key, kit.mac));
    const held = space.get(place.stream) ?? [];
    if (held.length === 0) return { epoch, key, place, decider: null, records: null, chart: null };
    const decider = deciderKey(await kitStep(() => deciderSeed(desk.opened, epoch, name, desk.crypto)));
    const read = await roomRecords(place, held, checker, { name, decider }, kit.cipher);
    return { epoch, key, place, decider, records: read, chart: read.chart?.value ?? null };
  };
  const latest = await at(latestEpoch(desk.opened));
  for (let epoch = latest.epoch - 1; latest.chart === null && epoch >= 0; epoch -= 1) {
    const room = await at(epoch);
    if (room.chart !== null) return room;
  }
  return latest;
}

/** A room as roomFound found it, with its decider's public key worked out when it holds nothing yet. */
async function withDecider(desk: IssueDesk, name: RoomName, room: Awaited<ReturnType<typeof roomFound>>) {
  const seed = () => kitStep(() => deciderSeed(desk.opened, room.epoch, name, desk.crypto));
  return { ...room, decider: room.decider ?? deciderKey(await seed()) };
}

/** The room as roomFound finds it, with its decider's public key worked out when it holds nothing yet. */
export async function roomOf(desk: IssueDesk, name: RoomName, space: Space, ca: string, kit: WorldKit) {
  return withDecider(desk, name, await roomFound(desk, name, space, ca, kit));
}

/** The rooms a channel's batches as read hold, read once for every room a reading of the space opens. */
const handedRead = new WeakMap<readonly SealedBatch[], Promise<ExamRoom[]>>();

/** What opening rooms did: how many setters a room was handed to, and how many rooms or setters failed. */
export interface Opened {
  readonly handed: number;
  readonly failed: number;
}

/**
 * Opens one chart's room from the space as read, with the world CA's key, handed to the setters its chart names; or,
 * `after` its exam, hands the room whose chart is in place to every one of `setters`, the subject's teachers.
 */
export async function openRoom(
  world: Pick<OpenWorld, 'world'>,
  desk: IssueDesk,
  draft: ChartDraft['chart'],
  setters: readonly RoomSetter[],
  space: Space,
  ca: string,
  kit: WorldKit,
  send: Send,
  after = false,
): Promise<Opened> {
  const checker = { key: ca, checker: kit };
  const school = desk.held.school;
  const name = { exam: draft.exam, subject: draft.subject, grade: draft.grade, world: world.world, school };
  const found = await roomFound(desk, name, space, ca, kit);
  if (found.chart === null && after) return { handed: 0, failed: 0 };
  const room = await withDecider(desk, name, found);
  const seed = await kitStep(() => deciderSeed(desk.opened, room.epoch, name, desk.crypto));
  const signing = () => deciderSigning(world.world, desk, seed, ca, kit, send);
  let chart = room.chart;
  if (chart === null) {
    const made: ExamChart = {
      ...draft,
      ...name,
      setters: setters.map(({ assignment, name: who, key }) => ({ assignment, name: who, key })),
    };
    const open = async (held: readonly SealedBatch[]) => {
      const read = await roomRecords(room.place, held, checker, { name, decider: room.decider }, kit.cipher);
      chart = read.chart?.value ?? null;
      return [chart];
    };
    const seal = async (first: number) => {
      const { certificate, signer } = await signing();
      const signed = await kitStep(() => signRoomRecord('chart', made, certificate, signer));
      return sealRoomRecord(room.place, signed, first, kit.cipher);
    };
    const stream = room.place.stream;
    await putOnce(
      { world: world.world, space: school, kind: 'school', stream, open, there: ([one]) => one !== null, seal },
      send,
    );
    chart ??= made;
  }
  const named = new Set(chart.setters.map((one) => one.key));
  const held = async (code: JoinCode, batches: readonly SealedBatch[]) => {
    const read =
      handedRead.get(batches) ?? kitStep(() => channelRooms(code, batches, checker, null, kit.cipher, kit.mac));
    handedRead.set(batches, read);
    for (const one of await read)
      if (one.exam === name.exam && one.subject === name.subject && one.grade === name.grade)
        if (await kitStep(() => isHeldRoom(one, desk.opened, desk.crypto, deciderKey))) return true;
    return false;
  };
  let [handed, failed] = [0, 0];
  for (const one of setters.filter((each) => after || named.has(each.key))) {
    const { code } = one;
    try {
      if (await held(code, space.get(await kitStep(() => channelStream(code, kit.mac))) ?? [])) continue;
      const value = {
        ...name,
        assignment: one.assignment,
        issue: code.issue,
        epoch: room.epoch,
        key: keyText(room.key),
      };
      let sealing = false;
      await putOnChannel(code, ca, kit, send, async ({ batches }, first) => {
        if (await held(code, batches)) return [];
        const { certificate, signer } = await signing();
        const signed = await kitStep(() => signRoom({ ...value, decider: room.decider }, certificate, signer));
        sealing = true;
        return (await kitStep(() => sealRoom(code, signed, first, kit.cipher, kit.mac))).batches;
      });
      if (sealing) handed += 1;
    } catch {
      failed += 1;
    }
  }
  return { handed, failed };
}

/** Opens the rooms of the school exams whose figures day the date has reached, and hands those of exams past. */
export async function openRooms(
  world: RoomWorld,
  desk: IssueDesk,
  school: DemoSchool,
  records: readonly ClassRecords[],
  reference: TermReference,
  kit: WorldKit,
  send: Send,
): Promise<Opened> {
  const exams = [
    ...examsOpen(reference, world.date).map((exam) => ({ exam, after: false })),
    ...examsAfter(reference, world.date).map((exam) => ({ exam, after: true })),
  ];
  if (exams.length === 0) return { handed: 0, failed: 0 };
  const ca = await caKey(world.world, send);
  const checker = { key: ca, checker: kit };
  const latest = await latestIssues(world, desk, school, kit);
  const space = await spaceBatches(world.world, desk.held.school, send);
  const found = new Map<string, RoomSetter | null>();
  const setter = async (teacher: string): Promise<RoomSetter | null> => {
    if (found.has(teacher)) return found.get(teacher)!;
    const [issue, name] = [latest.get(teacher), school.teachers.find((one) => one.id === teacher)?.name];
    let one: RoomSetter | null = null;
    if (issue !== undefined && name !== undefined) {
      const code = await joinCode(world.world, desk, issue);
      const theirs = space.get(await kitStep(() => channelStream(code, kit.mac))) ?? [];
      const joined = await kitStep(() => readJoined(code, theirs, checker, kit.cipher, kit.mac));
      if (joined !== null) one = { assignment: issue.assignment, name, key: joined.certificate.publicKey, code };
    }
    found.set(teacher, one);
    return one;
  };
  let [handed, failed] = [0, 0];
  for (const { exam, after } of exams)
    for (const { chart, teachers } of chartDrafts(exam, school, records, reference)) {
      try {
        const setters = (await Promise.all(teachers.map(setter))).filter((one) => one !== null);
        if (setters.length === 0) continue;
        const opened = await openRoom(world, desk, chart, setters, space, ca, kit, send, after);
        [handed, failed] = [handed + opened.handed, failed + opened.failed];
      } catch {
        failed += 1;
      }
    }
  return { handed, failed };
}
