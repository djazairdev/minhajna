// SPDX-FileCopyrightText: 2026 The Minhajna contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

// A school exam's cut as published on the teacher's threshold pages (#602,
// T-Threshold-after, answers 634 and 636, R-3.3-39, R-7.10-04), on the made-up
// room of cut-room.ts, its state set by hand: on the exam's last day the page
// still shows where the cut stands, with no choice past the deadline; from the
// day after, by the world's date, the page and the exams list show the cut
// that applied and who settled it, every setter's or the director's, or that
// none applied, with each setter's cut and day, that it was published with the
// figures it was built on and is kept with them, with no choice, no note on who
// sees it before the exam and no same-chart line; and a room the director's
// device hands after the exam to a joined teacher the chart does not name, who
// read no room before, reads as published on that phone, the setter who signed
// nothing said so. Every school, teacher and pack is made up.

import { addDays, readJoinCode, type Day } from '@minhajna/core';
import { Platform } from 'react-native';
import { openedRoom, roomDraft } from '../jest/cut-room';
import { server, setting, STAFF } from '../jest/timetable-send';
import { controls, props, quoted, show, texts, unmount } from '../jest/threshold-page';
import { reference } from '../jest/world-calendar';
import { nodeKit as kit } from '../jest/world-server';
import { holdSchool } from '../src/director/issue-session';
import { leaveWorldNetwork } from '../src/network/world-network';
import { caKey, spaceBatches } from '../src/school/space-read';
import ar from '../src/text/ar.json';
import { ExamThreshold } from '../src/threshold/ExamThreshold';
import { ExamThresholds } from '../src/threshold/ExamThresholds';
import { openRoom } from '../src/threshold/room-open';
import * as teacherRooms from '../src/threshold/teacher-rooms';
import { examsOf, roomId } from '../src/threshold/threshold-text';
import { isolate } from '../src/week/grid-labels';

const page = ar.demo.threshold;
const ROOM = roomId({ exam: 'term-2', subject: 'math', grade: '1am' });
const CHOICES = ['threshold-sign', 'threshold-propose', 'threshold-none'];
const last = examsOf(reference).get('term-2')!.to;
const MADE_UP_KEY = `MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE${'A'.repeat(85)}A==`;

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual<{ default: unknown }>('react-native-safe-area-context/jest/mock').default,
);

beforeEach(() => {
  jest.replaceProperty(Platform, 'OS', 'web');
});

afterEach(async () => {
  await unmount();
  leaveWorldNetwork();
  server.reset();
  jest.restoreAllMocks();
});

type State = teacherRooms.TeacherRoom['state'];

/** The room as read on a day, its state replaced, and this phone a setter or not. */
async function stated(date: Day, state: (items: readonly string[], mine: string) => Partial<State>, setter = true) {
  const { id, joined, items, pack } = await openedRoom();
  const [room] = await teacherRooms.readTeacherRooms({ world: id, date }, joined, kit, server.send);
  const mine = room.mine!.assignment;
  const made = { ...room, mine: setter ? room.mine : null, state: { ...room.state, ...state(items, mine) } };
  jest.spyOn(teacherRooms, 'readTeacherExams').mockResolvedValue({ rooms: [made], weeks: null });
  const shown = props({ world: id, date }, joined);
  return { shown, items, pack, figures: room.chart.figuresDay };
}

/** Signed by this phone's setter on a day, up to an item. */
const signedBy = (mine: string, item: string | null, day: Day): Partial<State> => ({
  signed: new Map([[mine, item]]),
  days: new Map([[mine, day]]),
});

test('on the exam’s last day the page still shows where the cut stands', async () => {
  const { shown } = await stated(last, () => ({}));
  await show(<ExamThreshold {...shown} said={page.title} room={ROOM} />);
  expect(texts()).toEqual(expect.arrayContaining([page.cut, page.state.toDirector, page.closed, page.roomNotes.seen]));
  expect(texts()).not.toContain(page.after.cut);
});

test('after the exam the page shows the cut every setter signed, as published, with no choice', async () => {
  const after = addDays(last, 1);
  const { shown, pack, figures } = await stated(after, (items, mine) => ({
    ...signedBy(mine, items[0], addDays(last, -10)),
    settled: { item: items[0], by: 'setters' },
  }));
  await show(<ExamThreshold {...shown} said={page.title} room={ROOM} />);
  const item = quoted(pack.items[0].title);
  const lead = page.after.lead.replace('{{figures}}', `day ${figures}`);
  const setter = texts().find((line) => line.includes(item) && line.includes(`day ${addDays(last, -10)}`));
  expect(texts()).toEqual(
    expect.arrayContaining([page.after.cut, lead, page.after.setters.replace('{{item}}', item), page.roomNotes.kept]),
  );
  const hidden = [page.roomNotes.seen, page.sameView, page.closed].filter((line) => texts().includes(line));
  expect([setter !== undefined, hidden, CHOICES.flatMap((one) => controls(one))]).toEqual([true, [], []]);
  await unmount();
  await show(<ExamThresholds {...shown} said="" onRoom={jest.fn()} onTotals={jest.fn()} />);
  expect(texts()).toContain(page.after.setters.replace('{{item}}', item));
});

test('after the exam the director’s decision, a no cut, or none settled is said as published', async () => {
  const after = addDays(last, 1);
  const states: ((items: readonly string[]) => Partial<State>)[] = [
    (items) => ({ settled: { item: items[1], by: 'director' }, director: true }),
    () => ({ settled: { item: null, by: 'director' }, director: true }),
    () => ({ director: true }),
  ];
  const words = (item: string) => [
    page.after.director.replace('{{item}}', item),
    page.after.directorNone,
    page.after.none,
  ];
  const cases = states.map((state, at) => [state, (item: string) => words(item)[at]] as const);
  for (const [state, said] of cases) {
    const { shown, pack } = await stated(after, state, false);
    await show(<ExamThreshold {...shown} said={page.title} room={ROOM} />);
    expect(texts()).toContain(said(quoted(pack.items[1].title)));
    expect([texts().includes(page.notSetter), CHOICES.flatMap((one) => controls(one)).length]).toEqual([false, 0]);
    await unmount();
    await show(<ExamThresholds {...shown} said="" onRoom={jest.fn()} onTotals={jest.fn()} />);
    expect(texts()).toContain(said(quoted(pack.items[1].title)));
    await unmount();
    leaveWorldNetwork();
    server.reset();
    jest.restoreAllMocks();
  }
});

test('a room handed after the exam to a teacher the chart does not name reads as published', async () => {
  const { id, here, joined, keyCode } = await setting();
  const desk = await holdSchool(here, kit, server.send, false);
  const pack = reference.packs.find((one) => one.items.length >= 3)!;
  const draft = roomDraft(here.date, pack);
  const code = readJoinCode(joined.code)!;
  const other = { assignment: keyCode.assignment, name: STAFF[1].name, key: MADE_UP_KEY, code: keyCode };
  const mine = { assignment: code.assignment, name: STAFF[0].name, key: joined.certificate.publicKey, code };
  const ca = await caKey(id, server.send);
  const space = async () => spaceBatches(id, desk.held.school, server.send);
  await openRoom({ world: id }, desk, draft, [other], await space(), ca, kit, server.send);
  const after = addDays(last, 1);
  expect(await teacherRooms.readTeacherRooms({ world: id, date: after }, joined, kit, server.send)).toEqual([]);
  const handed = await openRoom({ world: id }, desk, draft, [mine], await space(), ca, kit, server.send, true);
  expect(handed).toEqual({ handed: 1, failed: 0 });
  const [room] = await teacherRooms.readTeacherRooms({ world: id, date: after }, joined, kit, server.send);
  expect([room.mine, room.chart.setters.map((one) => one.assignment)]).toEqual([null, [keyCode.assignment]]);
  await show(<ExamThreshold {...props({ world: id, date: after }, joined)} said={page.title} room={ROOM} />);
  expect(texts()).toEqual(
    expect.arrayContaining([page.after.none, page.after.unsigned.replace('{{name}}', isolate(STAFF[1].name))]),
  );
  expect([texts().includes(page.notSetter), CHOICES.flatMap((one) => controls(one)).length]).toEqual([false, 0]);
});
